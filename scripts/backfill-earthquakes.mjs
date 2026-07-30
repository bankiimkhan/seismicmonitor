// One-off historical backfill for the `earthquakes` table.
//
// The live feed (lib/earthquakes.ts, used by /api/ingest every 15 min) only
// ever returns *recent* events -- that's why /trends' 90d/365d windows show
// the same data as 30d on a freshly-started table: there's simply no older
// data yet, and ingest only ever adds "now". USGS's FDSN *query* API (unlike
// its live feed) supports arbitrary starttime/endtime, so this pulls real
// history directly from it, chunked into 30-day windows, and upserts into
// the same table /api/ingest writes to (upsert on id + ignoreDuplicates, so
// re-running this is safe/idempotent -- it'll just skip rows it already has).
//
// NCS has no equivalent historical query API (only a "recent events" HTML
// page, see fetchNcsFeatures in lib/earthquakes.ts) -- backfilled history is
// USGS-only. Live ingest keeps adding both sources going forward.
//
// Worldwide by default now (matches lib/earthquakes.ts's global default) --
// unfiltered global history is *much* higher volume than the old South-Asia
// -only pull (tens of thousands of events/year is realistic once small
// local-network detections in active zones like California/Japan/Alaska are
// included), so pass a minMagnitude as the 2nd arg if you want a smaller,
// faster, still-meaningful pull instead of everything.
//
// Usage: node --env-file=.env.local scripts/backfill-earthquakes.mjs [days] [minMagnitude]
// Defaults to 365 days, unfiltered. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';

const USGS_FDSN_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
// Whole world -- same default lib/earthquakes.ts's fetchEarthquakeFeatures
// uses when no lat/lng is given. Pass a narrower BBOX here if you only want
// to backfill one region.
const BBOX = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
const CHUNK_DAYS = 30;
const CHUNK_LIMIT = 5000;

const totalDays = Number(process.argv[2]) || 365;
const minMagnitude = process.argv[3] !== undefined ? Number(process.argv[3]) : undefined;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Run with: node --env-file=.env.local scripts/backfill-earthquakes.mjs [days]');
    process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function toRow(feature) {
    const [lng, lat, depth] = feature.geometry.coordinates;
    return {
        id: feature.id,
        source: 'usgs',
        mag: feature.properties.mag,
        place: feature.properties.place,
        time: new Date(feature.properties.time).toISOString(),
        lat, lng, depth,
        url: feature.properties.url,
    };
}

async function fetchChunk(startIso, endIso) {
    const u = new URL(USGS_FDSN_QUERY_URL);
    u.searchParams.set('format', 'geojson');
    u.searchParams.set('starttime', startIso);
    u.searchParams.set('endtime', endIso);
    u.searchParams.set('minlatitude', String(BBOX.minLat));
    u.searchParams.set('maxlatitude', String(BBOX.maxLat));
    u.searchParams.set('minlongitude', String(BBOX.minLng));
    u.searchParams.set('maxlongitude', String(BBOX.maxLng));
    if (minMagnitude !== undefined) u.searchParams.set('minmagnitude', String(minMagnitude));
    u.searchParams.set('orderby', 'time');
    u.searchParams.set('limit', String(CHUNK_LIMIT));

    const res = await fetch(u.toString());
    if (!res.ok) throw new Error(`USGS query failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return Array.isArray(data.features) ? data.features : [];
}

async function main() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let totalFetched = 0;
    let totalInserted = 0;

    for (let offset = 0; offset < totalDays; offset += CHUNK_DAYS) {
        const chunkEnd = new Date(now - offset * dayMs).toISOString();
        const chunkStart = new Date(now - Math.min(offset + CHUNK_DAYS, totalDays) * dayMs).toISOString();

        process.stdout.write(`${chunkStart.slice(0, 10)} -> ${chunkEnd.slice(0, 10)} ... `);
        const features = await fetchChunk(chunkStart, chunkEnd);
        totalFetched += features.length;
        if (features.length >= CHUNK_LIMIT) {
            console.log(`\n  warning: hit the ${CHUNK_LIMIT}-event chunk limit, some events in this window were dropped`);
        }

        if (features.length > 0) {
            const rows = features.map(toRow);
            const { error, count } = await admin
                .from('earthquakes')
                .upsert(rows, { onConflict: 'id', ignoreDuplicates: true, count: 'exact' });
            if (error) {
                console.log(`FAILED: ${error.message}`);
                continue;
            }
            totalInserted += count ?? 0;
            console.log(`${features.length} events, ${count ?? 0} new`);
        } else {
            console.log('0 events');
        }

        // Be polite to USGS's public API between chunks.
        await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`\nDone. Fetched ${totalFetched} events total, inserted ${totalInserted} new rows.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
