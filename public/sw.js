// Minimal hand-rolled service worker. No Workbox/next-pwa -- the surface area
// here is small enough that a hand-rolled worker is easier to reason about.
//
// The one rule this worker must never break: **never serve a stale HTML
// document while the network is reachable.** A document is the only response
// that names other build artefacts by URL. Next.js embeds content-hashed
// /_next/static/... script URLs into every document, so a document cached
// against an older build points at chunks that no longer exist. Next recovers
// from a failed chunk load with a full page reload -- which, if the worker
// answers that reload from cache too, lands on the same dead document again.
// That is a self-sustaining reload loop with no user interaction in it.
//
// So: documents and Next's own build/HMR endpoints are network-first (or not
// intercepted at all), and only content-hashed immutable assets are
// cache-first. The cached document survives purely as an offline fallback.
const CACHE_NAME = 'seismic-shell-v2';
const OFFLINE_FALLBACK_URL = '/';
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

// Next.js internals that must reach the network untouched. Hot-update
// manifests are the loop's usual ignition point in dev: serving one from
// cache makes the HMR client think it missed an update, and its recovery path
// is location.reload(). `?_rsc=` payloads are per-build router responses --
// a stale one breaks client navigation the same way a stale document does.
function isNextInternal(url) {
    return (
        url.pathname.startsWith('/_next/static/webpack/') ||
        url.pathname.startsWith('/_next/webpack-hmr') ||
        url.searchParams.has('_rsc')
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Not ours to answer -- let the browser talk to the server directly.
    if (isNextInternal(url)) return;

    if (url.pathname.startsWith('/api/')) {
        // Network-first: live data should never come from a stale cache when
        // a connection exists.
        event.respondWith(
            fetch(request).catch(async () => {
                // Nothing here ever *writes* API responses to the cache, so
                // offline this match is always a miss -- and resolving
                // respondWith() with `undefined` throws a TypeError inside
                // the worker, turning a plain network failure into an opaque
                // one. Answer with a real response the callers' existing
                // error handling can read instead.
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response(
                    JSON.stringify({ error: 'You appear to be offline.' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // HTML documents: network-first, cache purely as an offline fallback.
    // This is the branch that used to be cache-first and drive the reload
    // loop described at the top of this file.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(async () =>
                    (await caches.match(request)) ||
                    (await caches.match(OFFLINE_FALLBACK_URL)) ||
                    new Response('', { status: 503, statusText: 'Offline' })
                )
        );
        return;
    }

    // Everything else is a static asset. Under /_next/static these are
    // content-hashed, so a given URL's bytes never change and a cache hit is
    // always correct -- no revalidation needed, and a new build simply asks
    // for new URLs.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                // Uncached *and* offline: resolving respondWith() with
                // undefined throws inside the worker rather than surfacing
                // the network failure.
                .catch(() => new Response('', { status: 503, statusText: 'Offline' }));
        })
    );
});
