import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// R2 rather than the default no-op cache: every route handler here is
// `force-dynamic`, so there is no ISR/SSG surface to speak of, but
// lib/earthquakes.ts leans on `fetch(..., { next: { revalidate } })` to keep a
// shared 30-second window over the USGS/NCS feeds (CACHE_WINDOW_SECONDS there,
// matched to useEarthquakes' poll interval so concurrent pollers collapse onto
// one upstream request). With no incremental cache configured that revalidate
// hint is silently dropped and every request re-fetches upstream -- slower, and
// needlessly rude to two public feeds.
//
// Bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc.
export default defineCloudflareConfig({
    incrementalCache: r2IncrementalCache,
});
