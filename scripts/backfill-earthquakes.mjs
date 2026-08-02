// One-off historical backfill for the `hazard_events` archive.
//
// The live feeds (lib/earthquakes.ts, polled every 15 min by the `ingest`
// Supabase Edge Function) only ever return *recent* events -- that's why
// /earthquake/trends' 90d/365d windows show the same data as 30d on a
// freshly-started archive: there is simply no older data yet, and ingest only
// ever adds "now". USGS's FDSN *query* API (unlike its live feed) supports
// arbitrary starttime/endtime, so this pulls real history directly from it,
// chunked into 30-day windows, and writes it into the same two tables the
// ingest job writes to.
//
// NCS has no equivalent historical query API (only a "recent events" HTML
// page, see fetchNcsFeatures in lib/earthquakes.ts) -- backfilled history is
// USGS-only. Live ingest keeps adding every source going forward.
//
// Worldwide by default (matches lib/earthquakes.ts's global default) --
// unfiltered global history is *much* higher volume than a region-scoped pull
// (tens of thousands of events/year once small local-network detections in
// active zones like California/Japan/Alaska are included), so pass a
// minMagnitude as the 2nd arg if you want a smaller, faster, still-meaningful
// pull instead of everything.
//
// Usage: node --env-file=.env scripts/backfill-earthquakes.mjs [days] [minMagnitude]
// Defaults to 365 days, unfiltered. Requires NEXT_PUBLIC_SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY (hazard_events has RLS on with no public policy).
// Needs Node >= 22.18 -- it imports lib/regions.ts directly, relying on Node's
// native TypeScript type stripping, so the region mapping stays in its single
// source of truth rather than being duplicated here.
import { createClient } from '@supabase/supabase-js';
import { regionForPoint } from '../lib/regions.ts';

const USGS_FDSN_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
// Whole world -- same default lib/earthquakes.ts's fetchEarthquakeFeatures
// uses when no lat/lng is given. Pass a narrower BBOX here if you only want
// to backfill one region.
const BBOX = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
const CHUNK_DAYS = 30;
const CHUNK_LIMIT = 5000;
// Same batch size the ingest function uses. A single 5000-row upsert risks
// payload limits, and a 5000-value `.in()` filter would blow PostgREST's URL
// length -- both the lookups and the writes below page at this size.
const BATCH_SIZE = 500;

const totalDays = Number(process.argv[2]) || 365;
const minMagnitude = process.argv[3] !== undefined ? Number(process.argv[3]) : undefined;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Run with: node --env-file=.env scripts/backfill-earthquakes.mjs [days] [minMagnitude]');
    process.exit(1);
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

// Row shapes mirror the `ingest` Edge Function's earthquake branch exactly, so
// a backfilled row is indistinguishable from an ingested one:
//   - hazard_events.id is the canonical agency's native id, which for a
//     USGS-only group is just the USGS event id.
//   - confidence_tier is 'low' -- scoreConfidence (lib/mergeEngine.ts) reserves
//     'high' for 2+ agencies agreeing, and this pull is single-agency by
//     definition. Claiming anything better would fabricate corroboration.
function toRows(feature, now) {
    const [lng, lat, depth] = feature.geometry.coordinates;
    const normalized = {
        agency: 'usgs',
        agencyNativeId: feature.id,
        time: feature.properties.time,
        lat,
        lng,
        depthKm: depth,
        magnitude: feature.properties.mag,
        place: feature.properties.place,
        url: feature.properties.url,
    };
    return {
        hazard: {
            id: feature.id,
            hazard_type: 'earthquake',
            place: feature.properties.place,
            url: feature.properties.url,
            canonical_time: new Date(feature.properties.time).toISOString(),
            lat,
            lng,
            depth_km: depth,
            magnitude: feature.properties.mag,
            alert_level: null,
            confidence_tier: 'low',
            region_id: regionForPoint(lat, lng).id,
            status: 'active',
            last_updated_at: now,
        },
        source: {
            hazard_event_id: feature.id,
            agency: 'usgs',
            agency_native_id: feature.id,
            reported_time: new Date(feature.properties.time).toISOString(),
            reported_lat: lat,
            reported_lng: lng,
            reported_depth_km: depth,
            reported_magnitude: feature.properties.mag,
            is_canonical: true,
            raw_payload: normalized, // normalized shape, not the verbatim upstream response
            retrieved_at: now,
        },
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

/** USGS event ids already present in the archive under ANY hazard_events id.
 *
 * Checking event_sources rather than hazard_events is the important part. The
 * live ingest merges across agencies and keys the merged row on whichever
 * agency is canonical for that region -- so a quake USGS and NCS both reported
 * in South Asia is stored under the *NCS* id, with a `(usgs, <usgs id>)` row in
 * event_sources pointing at it. Testing `hazard_events.id === <usgs id>` would
 * miss that, insert a second hazard_events row for the same physical
 * earthquake, and double-count it in /api/trends. This is the same lookup the
 * ingest job does via its `existingIdByKey` map, for the same reason. */
async function knownUsgsIds(ids) {
    const known = new Set();
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const { data, error } = await admin
            .from('event_sources')
            .select('agency_native_id')
            .eq('agency', 'usgs')
            .in('agency_native_id', ids.slice(i, i + BATCH_SIZE));
        if (error) throw new Error(`event_sources lookup failed: ${error.message}`);
        for (const row of data ?? []) known.add(row.agency_native_id);
    }
    return known;
}

async function writeBatch(rows) {
    // ignoreDuplicates so a backfill can never clobber a row the live ingest
    // already wrote: ingest rows can carry merged, multi-agency data, and this
    // single-agency historical pull is strictly the weaker source.
    const { error: hazardError } = await admin
        .from('hazard_events')
        .upsert(rows.map((r) => r.hazard), { onConflict: 'id', ignoreDuplicates: true });
    if (hazardError) throw new Error(`hazard_events upsert failed: ${hazardError.message}`);

    const { error: sourceError } = await admin
        .from('event_sources')
        .upsert(rows.map((r) => r.source), { onConflict: 'agency,agency_native_id', ignoreDuplicates: true });
    if (sourceError) throw new Error(`event_sources upsert failed: ${sourceError.message}`);
}

async function main() {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
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

        if (features.length === 0) {
            console.log('0 events');
            continue;
        }

        try {
            const known = await knownUsgsIds(features.map((f) => f.id));
            const fresh = features.filter((f) => !known.has(f.id));
            for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
                await writeBatch(fresh.slice(i, i + BATCH_SIZE).map((f) => toRows(f, nowIso)));
            }
            totalInserted += fresh.length;
            console.log(`${features.length} events, ${fresh.length} new`);
        } catch (err) {
            // Keep going: one bad window shouldn't abandon the remaining months.
            console.log(`FAILED: ${err.message}`);
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
