import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Loads the real public/sw.js into a fake ServiceWorkerGlobalScope so its
// routing decisions can be asserted directly. The worker is plain JS with no
// imports, so injecting `self`/`caches`/`fetch` as parameters is enough to
// run it exactly as the browser would.

const ORIGIN = 'https://example.test';

interface FakeRequest {
    url: string;
    method: string;
    mode?: string;
}

function req(url: string, mode = 'no-cors'): FakeRequest {
    return { url: url.startsWith('http') ? url : ORIGIN + url, method: 'GET', mode };
}

function loadServiceWorker(network: (url: string) => Promise<Response>) {
    const listeners = new Map<string, (event: unknown) => void>();
    const caches_ = new Map<string, Map<string, Response>>();

    const cacheStorage = {
        async open(name: string) {
            if (!caches_.has(name)) caches_.set(name, new Map());
            const entries = caches_.get(name)!;
            return {
                async addAll(urls: string[]) {
                    for (const u of urls) entries.set(ORIGIN + u, await network(ORIGIN + u));
                },
                async put(request: FakeRequest | string, response: Response) {
                    entries.set(typeof request === 'string' ? ORIGIN + request : request.url, response);
                },
            };
        },
        async match(request: FakeRequest | string) {
            const key = typeof request === 'string' ? ORIGIN + request : request.url;
            for (const entries of caches_.values()) if (entries.has(key)) return entries.get(key);
            return undefined;
        },
        async keys() {
            return [...caches_.keys()];
        },
        async delete(name: string) {
            return caches_.delete(name);
        },
    };

    const scope = {
        location: { origin: ORIGIN },
        addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
        skipWaiting: () => {},
        clients: { claim: () => {} },
    };

    const source = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');
    new Function('self', 'caches', 'fetch', 'Response', 'URL', source)(
        scope,
        cacheStorage,
        (request: FakeRequest | string) => network(typeof request === 'string' ? request : request.url),
        Response,
        URL
    );

    /** Returns the Response the worker answered with, or `undefined` when it
     * declined to intercept and let the request go straight to the network. */
    async function handleFetch(request: FakeRequest): Promise<Response | undefined> {
        let answered: Promise<Response> | undefined;
        const event = { request, respondWith: (p: Promise<Response>) => { answered = p; } };
        listeners.get('fetch')!(event);
        return answered ? await answered : undefined;
    }

    async function install() {
        const waits: Promise<unknown>[] = [];
        listeners.get('install')!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
        await Promise.all(waits);
    }

    return { handleFetch, install };
}

describe('service worker routing', () => {
    it('never serves a stale HTML document while the network is reachable', async () => {
        // The reload loop: a cached document references build-specific
        // /_next/static chunk URLs. Once a rebuild/redeploy replaces those
        // chunks, serving the old document hands the client script URLs that
        // 404, which Next recovers from with a full page reload -- landing on
        // the same cached document again.
        let current = '<html data-build="2">fresh</html>';
        const sw = loadServiceWorker(async () => new Response(current, { status: 200 }));

        await sw.install(); // precaches '/' at build 1
        current = '<html data-build="1">stale</html>';
        await sw.install();
        current = '<html data-build="2">fresh</html>';

        const response = await sw.handleFetch(req('/', 'navigate'));
        expect(await response!.text()).toContain('fresh');
    });

    it('falls back to the cached document only when the network is gone', async () => {
        let online = true;
        const sw = loadServiceWorker(async () => {
            if (!online) throw new TypeError('Failed to fetch');
            return new Response('<html>shell</html>', { status: 200 });
        });

        await sw.install();
        online = false;

        const response = await sw.handleFetch(req('/', 'navigate'));
        expect(response!.status).toBe(200);
        expect(await response!.text()).toContain('shell');
    });

    it('leaves Next.js HMR and RSC payload requests entirely alone', async () => {
        const sw = loadServiceWorker(async () => new Response('{}', { status: 200 }));

        // Caching either of these is what turns a single failed hot update
        // into a permanent loop -- the worker must not answer them at all.
        expect(await sw.handleFetch(req('/_next/static/webpack/633457081244afec.hot-update.json'))).toBeUndefined();
        expect(await sw.handleFetch(req('/_next/webpack-hmr'))).toBeUndefined();
        expect(await sw.handleFetch(req('/earthquake/local?_rsc=1a2b3'))).toBeUndefined();
    });

    it('serves a real response for API calls while offline instead of undefined', async () => {
        const sw = loadServiceWorker(async () => {
            throw new TypeError('Failed to fetch');
        });

        const response = await sw.handleFetch(req('/api/earthquakes?limit=8'));
        // respondWith(undefined) throws inside the worker; it has to be a Response.
        expect(response).toBeInstanceOf(Response);
        expect(response!.status).toBe(503);
    });

    it('still cache-firsts content-hashed static assets', async () => {
        let body = 'chunk-v1';
        let hits = 0;
        const sw = loadServiceWorker(async () => {
            hits++;
            return new Response(body, { status: 200 });
        });

        // /_next/static URLs are content-hashed, so the same URL always means
        // the same bytes -- serving a hit from cache is correct here, and a
        // new build just asks for a different URL.
        const asset = req('/_next/static/chunks/main-abc123.js');
        expect(await (await sw.handleFetch(asset))!.text()).toBe('chunk-v1');
        await new Promise((r) => setTimeout(r, 0)); // let the background put settle

        body = 'chunk-v2';
        const hitsBefore = hits;
        expect(await (await sw.handleFetch(asset))!.text()).toBe('chunk-v1');
        expect(hits).toBe(hitsBefore); // served from cache, network untouched
    });
});
