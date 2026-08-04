import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

// initOpenNextCloudflareForDev() runs at next.config.ts's module scope to wire
// up Cloudflare bindings for `next dev`. Stubbed so the real redirect table can
// be imported and asserted without starting any of that.
vi.mock('@opennextjs/cloudflare', () => ({ initOpenNextCloudflareForDev: () => {} }));

const ROOT = path.resolve(__dirname, '../..');

interface Rule { source: string; destination: string }

/** Expands `/:hazard(a|b)/local -> /:hazard/regional` into one concrete
 * source/destination pair per alternative. The binding has to be applied to
 * both halves at once: the pattern lives on the source, but it is the
 * destination that has to name a real route. */
function expand(rule: Rule): Rule[] {
    const match = rule.source.match(/:(\w+)\(([^)]+)\)/);
    if (!match) return [rule];
    const [token, name, alternatives] = match;
    return alternatives.split('|').flatMap((value) =>
        expand({
            source: rule.source.replace(token, value),
            destination: rule.destination.replaceAll(`:${name}`, value),
        })
    );
}

/** A redirect destination resolves if App Router has a page for it. */
function hasRoute(pathname: string): boolean {
    const segments = pathname.replace(/^\//, '');
    return ['page.tsx', 'page.ts'].some((file) =>
        existsSync(path.join(ROOT, 'app', segments, file))
    );
}

describe('next.config redirects', () => {
    /**
     * Every redirect here is `permanent: true`, which browsers cache
     * indefinitely -- so one pointing at a route that no longer exists is not a
     * transient 404 but a sticky one, and re-pointing it later cannot reach a
     * browser that already followed it. That is exactly what happened when the
     * Local view was retired: /local kept redirecting to /earthquake/local
     * after the route was deleted.
     */
    it('sends every legacy path to a route that exists', async () => {
        const { default: config } = await import('../../next.config');
        const redirects = await config.redirects!();

        expect(redirects.length).toBeGreaterThan(0);

        for (const redirect of redirects) {
            for (const { source, destination } of expand(redirect)) {
                expect(hasRoute(destination), `${source} -> ${destination}`).toBe(true);
            }
        }
    });

    // The data half of the same retirement is covered by parseScope's
    // "resolves retired point-scope links to global" test; this is the routing
    // half. Both exist because a bookmark carries a path and a query string,
    // and either one going stale strands the reader.
    it('resolves retired Local paths to the tab that replaced them', async () => {
        const { default: config } = await import('../../next.config');
        const redirects = await config.redirects!();

        const destinationFor = (source: string) =>
            redirects.find((r) => r.source === source)?.destination;

        expect(destinationFor('/local')).toBe('/earthquake/regional');

        // Every hazard section had its own Local tab, so all six retired paths
        // have to land on that section's own Regional -- not all on
        // earthquake's, and not on a 404.
        const perHazard = redirects.find((r) => r.source.includes('/local') && r.source.includes(':'));
        expect(perHazard).toBeDefined();
        expect(expand(perHazard!)).toEqual(
            ['earthquake', 'tsunami', 'cyclone', 'landslide', 'volcano', 'wildfire'].map((slug) => ({
                source: `/${slug}/local`,
                destination: `/${slug}/regional`,
            }))
        );
    });
});
