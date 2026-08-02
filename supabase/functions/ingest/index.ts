// Live multi-hazard ingest. Runs every 15 minutes via pg_cron (see
// supabase/migrations/*_ingest_cron.sql).
//
// This was /api/ingest in the Next app, running on a Vercel cron and then
// briefly a Cloudflare Cron Trigger. It cannot run on Workers Free: the job
// makes several hundred Supabase calls in one invocation and the Free plan
// caps subrequests at 50. Edge Functions have no such cap and sit next to the
// database, so the many small writes stop crossing a network boundary.
//
// The adapters and merge engine are unchanged -- supabase/functions/_shared is
// generated from lib/ by scripts/sync-edge-shared.mjs, so lib/ stays the single
// source of truth and keeps its vitest coverage.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { fetchEarthquakeFeatures, type EarthquakeFeature } from '../_shared/earthquakes.ts';
import { fetchGdacsFeatures } from '../_shared/gdacs.ts';
import { fetchFirmsHotspots, isFirmsConfigured } from '../_shared/firms.ts';
import { fetchEonetRecords } from '../_shared/eonet.ts';
import { fetchNoaaCyclones } from '../_shared/noaaCyclones.ts';
import { fetchTsunamiAlerts } from '../_shared/nwsTsunami.ts';
import { matchCandidates, selectCanonical, scoreConfidence, type NormalizedEvent } from '../_shared/mergeEngine.ts';
import { resolvePreferredSource } from '../_shared/sourcePriority.ts';
import { regionForPoint } from '../_shared/regions.ts';
import { log } from '../_shared/logger.ts';

// FIRMS updates on a satellite-revisit cadence (hours), not a live feed --
// polling it every 15 min would just re-fetch identical data and burn its
// 5000-transactions/10-min quota for nothing. Gated below via
// scraper_health.last_success_at rather than a second cron entry.
const FIRMS_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000;
// EONET spans several hazard types that all change more slowly than
// earthquakes -- same tiered-scheduler reasoning, shorter gate since severe
// storms genuinely move within a few hours.
const EONET_POLL_INTERVAL_MS = 60 * 60 * 1000;
// A worldwide VIIRS day can be thousands of hotspots; one giant array upsert
// risks payload limits, one row at a time would be far too many round-trips.
const HAZARD_INGEST_BATCH_SIZE = 500;

type Agency = 'usgs' | 'ncs' | 'gdacs';

function getAdmin(): SupabaseClient {
    const url = Deno.env.get('SUPABASE_URL');
    // Injected automatically by the platform. Newer projects expose the same
    // value through SUPABASE_SECRET_KEYS instead, so fall back to that rather
    // than failing on a project that has already migrated.
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (!url || !key) throw new Error('SUPABASE_URL / service role key are not available');
    return createClient(url, key, { auth: { persistSession: false } });
}

function toNormalized(feature: EarthquakeFeature, agency: Agency): NormalizedEvent {
    const [lng, lat, depth] = feature.geometry.coordinates;
    return {
        agency,
        agencyNativeId: feature.id,
        time: feature.properties.time,
        lat,
        lng,
        depthKm: depth,
        magnitude: feature.properties.mag,
        place: feature.properties.place,
        url: feature.properties.url,
        alertLevel: feature.properties.alertLevel,
    };
}

// Shared by the FIRMS / EONET / cyclone / tsunami steps, which all follow the
// same shape: no merge engine (single source per hazard), one hazard_events row
// and one event_sources row per record, written in batches.
async function ingestSingleSource<T>(
    admin: SupabaseClient,
    agency: string,
    records: T[],
    toRows: (record: T) => { hazard: Record<string, unknown>; source: Record<string, unknown> }
): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < records.length; i += HAZARD_INGEST_BATCH_SIZE) {
        const batch = records.slice(i, i + HAZARD_INGEST_BATCH_SIZE);
        const rows = batch.map(toRows);
        const ids = rows.map((r) => r.hazard.id as string);

        const { data: existingRows } = await admin.from('hazard_events').select('id').in('id', ids);
        const existingIds = new Set((existingRows ?? []).map((r) => r.id));
        inserted += ids.filter((id) => !existingIds.has(id)).length;

        const { error: hazardError } = await admin
            .from('hazard_events')
            .upsert(rows.map((r) => r.hazard), { onConflict: 'id' });
        if (hazardError) log.error(`ingest: ${agency} hazard_events upsert failed`, { error: hazardError.message });

        const { error: sourceError } = await admin
            .from('event_sources')
            .upsert(rows.map((r) => r.source), { onConflict: 'agency,agency_native_id' });
        if (sourceError) log.error(`ingest: ${agency} event_sources upsert failed`, { error: sourceError.message });
    }
    return inserted;
}

async function lastSuccessMs(admin: SupabaseClient, source: string): Promise<number | null> {
    const { data } = await admin
        .from('scraper_health')
        .select('last_success_at')
        .eq('source', source)
        .order('checked_at', { ascending: false })
        .limit(1);
    return data?.[0]?.last_success_at ? new Date(data[0].last_success_at).getTime() : null;
}

async function runIngest() {
    const admin = getAdmin();
    const normalized: NormalizedEvent[] = [];
    const healthUpdates: { source: string; status: string }[] = [];
    const now = new Date().toISOString();

    // `null` means this agency's feed could not be read at all -- kept distinct
    // from a successful fetch that returned no events, so only a real read marks
    // the source online.
    const fetchers: { source: Agency; run: () => Promise<EarthquakeFeature[] | null> }[] = [
        { source: 'usgs', run: async () => (await fetchEarthquakeFeatures({ source: 'usgs', hours: 1, limit: 300 })).features },
        {
            source: 'ncs',
            // fetchEarthquakeFeatures transparently substitutes USGS when the NCS
            // scrape fails. That is right for the live feed -- a reader wants
            // *some* data, and /api/earthquakes surfaces the swap via
            // metadata.status -- but wrong for the archive: those USGS features
            // would be written as agency 'ncs' carrying USGS native ids, and the
            // merge engine would then see one USGS reading as two independent
            // agencies agreeing and score the event `high` confidence
            // (lib/mergeEngine.ts's scoreConfidence counts distinct agencies).
            // Fabricating cross-agency corroboration is the one thing that tier
            // must never do, so honour the flag and treat it as a failed read.
            run: async () => {
                const { features, sourceStatus } = await fetchEarthquakeFeatures({ source: 'ncs', hours: 1, limit: 100 });
                return sourceStatus === 'fallback' ? null : features;
            },
        },
        { source: 'gdacs', run: () => fetchGdacsFeatures(1, 100) },
    ];

    for (const { source, run } of fetchers) {
        try {
            const features = await run();
            if (features === null) {
                log.warn(`ingest: ${source} feed unreadable, skipping this cycle`);
                healthUpdates.push({ source, status: 'fallback' });
                continue;
            }
            normalized.push(...features.map((f) => toNormalized(f, source)));
            healthUpdates.push({ source, status: 'online' });
        } catch (err) {
            log.error(`ingest: ${source} fetch failed`, { error: String(err) });
            healthUpdates.push({ source, status: 'fallback' });
        }
    }

    const groups = matchCandidates(normalized);

    // Reuse a previously-assigned hazard_events.id if any group member has been
    // ingested before, so an event's id stays stable across runs even when a
    // higher-priority agency joins the group later and would otherwise become
    // canonical under a different native id.
    const existingSources = normalized.length
        ? (
              await admin
                  .from('event_sources')
                  .select('agency, agency_native_id, hazard_event_id')
                  .in('agency_native_id', normalized.map((e) => e.agencyNativeId))
          ).data
        : [];
    const existingIdByKey = new Map<string, string>();
    for (const row of existingSources ?? []) {
        existingIdByKey.set(`${row.agency}:${row.agency_native_id}`, row.hazard_event_id);
    }

    // Resolve every group up front so the "has this row changed?" lookup can be
    // a single batched query. The Next version issued one SELECT per group,
    // which was tolerable on a long-lived serverless function but would put
    // hundreds of sequential round-trips inside the Edge Function wall clock.
    const resolved = groups.map((group) => {
        const canonical = selectCanonical(group, resolvePreferredSource(group[0].lat, group[0].lng));
        let hazardEventId: string | undefined;
        for (const member of group) {
            const existing = existingIdByKey.get(`${member.agency}:${member.agencyNativeId}`);
            if (existing) {
                hazardEventId = existing;
                break;
            }
        }
        return {
            group,
            canonical,
            confidence: scoreConfidence(group),
            region: regionForPoint(canonical.lat, canonical.lng),
            id: hazardEventId ?? canonical.agencyNativeId,
        };
    });

    const existingById = new Map<string, { magnitude: unknown; depth_km: unknown; place: unknown }>();
    for (let i = 0; i < resolved.length; i += HAZARD_INGEST_BATCH_SIZE) {
        const ids = resolved.slice(i, i + HAZARD_INGEST_BATCH_SIZE).map((r) => r.id);
        const { data } = await admin
            .from('hazard_events')
            .select('id, magnitude, depth_km, place, canonical_time')
            .in('id', ids);
        for (const row of data ?? []) existingById.set(row.id, row);
    }

    let inserted = 0;
    let revised = 0;
    const hazardRows: Record<string, unknown>[] = [];
    const sourceRows: Record<string, unknown>[] = [];
    const revisionRows: Record<string, unknown>[] = [];

    for (const { group, canonical, confidence, region, id } of resolved) {
        const existingRow = existingById.get(id);
        if (existingRow) {
            const fields: [string, unknown, unknown][] = [
                ['magnitude', existingRow.magnitude, canonical.magnitude],
                ['depth_km', existingRow.depth_km, canonical.depthKm],
                ['place', existingRow.place, canonical.place],
            ];
            const changed = fields.filter(
                ([, oldValue, newValue]) =>
                    newValue !== undefined && newValue !== null && String(oldValue) !== String(newValue)
            );
            for (const [field, oldValue, newValue] of changed) {
                revisionRows.push({
                    hazard_event_id: id,
                    field,
                    old_value: String(oldValue),
                    new_value: String(newValue),
                    changed_by_source: canonical.agency,
                });
            }
            if (changed.length > 0) revised++;
        } else {
            inserted++;
        }

        hazardRows.push({
            id,
            hazard_type: 'earthquake',
            place: canonical.place,
            url: canonical.url,
            canonical_time: new Date(canonical.time).toISOString(),
            lat: canonical.lat,
            lng: canonical.lng,
            depth_km: canonical.depthKm,
            magnitude: canonical.magnitude,
            alert_level: canonical.alertLevel,
            confidence_tier: confidence,
            region_id: region.id,
            status: 'active',
            last_updated_at: now,
        });

        for (const member of group) {
            sourceRows.push({
                hazard_event_id: id,
                agency: member.agency,
                agency_native_id: member.agencyNativeId,
                reported_time: new Date(member.time).toISOString(),
                reported_lat: member.lat,
                reported_lng: member.lng,
                reported_depth_km: member.depthKm,
                reported_magnitude: member.magnitude,
                is_canonical: member === canonical,
                raw_payload: member, // normalized shape, not the verbatim upstream response
                retrieved_at: now,
            });
        }
    }

    for (let i = 0; i < hazardRows.length; i += HAZARD_INGEST_BATCH_SIZE) {
        const { error } = await admin
            .from('hazard_events')
            .upsert(hazardRows.slice(i, i + HAZARD_INGEST_BATCH_SIZE), { onConflict: 'id' });
        if (error) log.error('ingest: hazard_events upsert failed', { error: error.message });
    }
    for (let i = 0; i < sourceRows.length; i += HAZARD_INGEST_BATCH_SIZE) {
        const { error } = await admin
            .from('event_sources')
            .upsert(sourceRows.slice(i, i + HAZARD_INGEST_BATCH_SIZE), { onConflict: 'agency,agency_native_id' });
        if (error) log.error('ingest: event_sources upsert failed', { error: error.message });
    }
    if (revisionRows.length > 0) {
        const { error } = await admin.from('event_revisions').insert(revisionRows);
        if (error) log.error('ingest: event_revisions insert failed', { error: error.message });
    }

    // Wildfire (FIRMS): single source, so no merge engine. Each hotspot
    // detection is its own row -- a point layer of satellite detections, not a
    // clustered "fire incident".
    let wildfireFetched = 0;
    let wildfireInserted = 0;
    // Configuration is checked first, and short-circuits the gate entirely.
    // Without the key `fetchFirmsHotspots` can only return null, and because
    // that path writes no scraper_health row, `lastSuccessMs` stays null
    // forever -- so the gate below was permanently open and this ran a doomed
    // fetch plus a pointless health lookup every 15 minutes.
    const firmsConfigured = isFirmsConfigured();
    if (!firmsConfigured) {
        log.warn('ingest: NASA_FIRMS_MAP_KEY is not set -- FIRMS wildfire hotspots are not being ingested');
    }
    const lastFirms = firmsConfigured ? await lastSuccessMs(admin, 'firms') : null;
    const shouldPollFirms = firmsConfigured && (!lastFirms || Date.now() - lastFirms > FIRMS_POLL_INTERVAL_MS);
    if (shouldPollFirms) {
        const hotspots = await fetchFirmsHotspots(1);
        // Inside this branch `null` can only mean the fetch failed -- the
        // unconfigured case already short-circuited shouldPollFirms above.
        // Recording that as a failure is what keeps last_success_at where it
        // was, so the 2h gate stays open and the next cycle retries instead of
        // waiting out a success that never happened.
        healthUpdates.push({ source: 'firms', status: hotspots !== null ? 'online' : 'fallback' });
        if (hotspots !== null) {
            wildfireFetched = hotspots.length;
            wildfireInserted = await ingestSingleSource(admin, 'firms', hotspots, (h) => ({
                hazard: {
                    id: h.agencyNativeId,
                    hazard_type: 'wildfire',
                    place: null,
                    url: null,
                    canonical_time: new Date(h.time).toISOString(),
                    lat: h.lat,
                    lng: h.lng,
                    depth_km: null,
                    magnitude: h.frp, // FRP (MW) -- wildfire's severity metric
                    alert_level: null,
                    confidence_tier: h.confidence,
                    region_id: regionForPoint(h.lat, h.lng).id,
                    status: 'active',
                    last_updated_at: now,
                },
                source: {
                    hazard_event_id: h.agencyNativeId,
                    agency: 'firms',
                    agency_native_id: h.agencyNativeId,
                    reported_time: new Date(h.time).toISOString(),
                    reported_lat: h.lat,
                    reported_lng: h.lng,
                    reported_depth_km: null,
                    reported_magnitude: h.frp,
                    is_canonical: true,
                    raw_payload: h,
                    retrieved_at: now,
                },
            }));
        }
    }

    // EONET: volcano/severe_weather/landslide plus extra wildfire coverage.
    // Deliberately not merged with FIRMS's wildfire rows even though both are
    // hazard_type='wildfire' -- curated multi-day incidents vs raw per-pixel
    // detections are different granularities.
    let eonetFetched = 0;
    let eonetInserted = 0;
    const lastEonet = await lastSuccessMs(admin, 'eonet');
    const shouldPollEonet = !lastEonet || Date.now() - lastEonet > EONET_POLL_INTERVAL_MS;
    if (shouldPollEonet) {
        const records = await fetchEonetRecords();
        // Same last_success_at reasoning as FIRMS above: `null` (every category
        // unreadable) must not stamp a success, or the 1h gate suppresses the
        // retry while /about still reports the source healthy.
        healthUpdates.push({ source: 'eonet', status: records !== null ? 'online' : 'fallback' });
        eonetFetched = records?.length ?? 0;
        eonetInserted = records === null ? 0 : await ingestSingleSource(admin, 'eonet', records, (r) => ({
            hazard: {
                id: r.agencyNativeId,
                hazard_type: r.hazardType,
                place: r.place,
                url: r.url,
                canonical_time: new Date(r.time).toISOString(),
                lat: r.lat,
                lng: r.lng,
                depth_km: null,
                magnitude: r.magnitude,
                alert_level: null,
                confidence_tier: 'medium', // curated/agency-sourced, but single-source
                region_id: regionForPoint(r.lat, r.lng).id,
                status: 'active',
                last_updated_at: now,
            },
            source: {
                hazard_event_id: r.agencyNativeId,
                agency: 'eonet',
                agency_native_id: r.agencyNativeId,
                reported_time: new Date(r.time).toISOString(),
                reported_lat: r.lat,
                reported_lng: r.lng,
                reported_depth_km: null,
                reported_magnitude: r.magnitude,
                is_canonical: true,
                raw_payload: r,
                retrieved_at: now,
            },
        }));
    }

    // Cyclones (NOAA NHC): no poll gate -- the id embeds the advisory's
    // lastUpdate timestamp, so fetching every cycle re-upserts the same row as a
    // harmless no-op until NHC issues a new advisory (~every 6h).
    const cyclonesResult = await fetchNoaaCyclones();
    // Health is recorded on a successful *fetch*, not on a non-empty result:
    // gating it on `length > 0` meant a quiet period looked identical to a
    // broken adapter, and wrote no health row either way.
    healthUpdates.push({ source: 'noaa', status: cyclonesResult !== null ? 'online' : 'fallback' });
    const cyclones = cyclonesResult ?? [];
    let cycloneInserted = 0;
    if (cyclones.length > 0) {
        cycloneInserted = await ingestSingleSource(admin, 'noaa', cyclones, (c) => ({
            hazard: {
                id: c.agencyNativeId,
                hazard_type: 'cyclone',
                place: c.place,
                url: c.url,
                canonical_time: new Date(c.time).toISOString(),
                lat: c.lat,
                lng: c.lng,
                depth_km: null,
                magnitude: c.windSpeedKt,
                alert_level: c.classification,
                confidence_tier: 'high', // official numbered NHC advisory
                region_id: regionForPoint(c.lat, c.lng).id,
                status: 'active',
                last_updated_at: now,
            },
            source: {
                hazard_event_id: c.agencyNativeId,
                agency: 'noaa',
                agency_native_id: c.agencyNativeId,
                reported_time: new Date(c.time).toISOString(),
                reported_lat: c.lat,
                reported_lng: c.lng,
                reported_depth_km: null,
                reported_magnitude: c.windSpeedKt,
                is_canonical: true,
                raw_payload: c,
                retrieved_at: now,
            },
        }));
    }

    // Tsunami (NOAA/NWS CAP alerts): single source, no poll gate -- a CAP
    // message gets a new id on every update. US coastal waters/territories only.
    const tsunamiResult = await fetchTsunamiAlerts();
    // Same as cyclones above -- tsunami alerts are rare, so gating the health
    // row on `length > 0` meant this source never appeared on /about at all and
    // an adapter failure would have gone completely unnoticed.
    healthUpdates.push({ source: 'nws-tsunami', status: tsunamiResult !== null ? 'online' : 'fallback' });
    const tsunamiAlerts = tsunamiResult ?? [];
    let tsunamiInserted = 0;
    if (tsunamiAlerts.length > 0) {
        tsunamiInserted = await ingestSingleSource(admin, 'nws-tsunami', tsunamiAlerts, (a) => ({
            hazard: {
                id: a.agencyNativeId,
                hazard_type: 'tsunami',
                place: a.place,
                url: null,
                canonical_time: new Date(a.time).toISOString(),
                lat: a.lat,
                lng: a.lng,
                depth_km: null,
                magnitude: null, // no numeric severity metric
                alert_level: a.alertLevel,
                confidence_tier: 'high', // official NWS warning
                region_id: regionForPoint(a.lat, a.lng).id,
                status: 'active',
                last_updated_at: now,
            },
            source: {
                hazard_event_id: a.agencyNativeId,
                agency: 'nws-tsunami',
                agency_native_id: a.agencyNativeId,
                reported_time: new Date(a.time).toISOString(),
                reported_lat: a.lat,
                reported_lng: a.lng,
                reported_depth_km: null,
                reported_magnitude: null,
                is_canonical: true,
                raw_payload: a,
                retrieved_at: now,
            },
        }));
    }

    // scraper_health: one row per source per run, carrying forward
    // last_success_at and incrementing/resetting consecutive_failures so a
    // degraded provider is visible instead of looking identical to a healthy one.
    const { data: latestHealth } = await admin
        .from('scraper_health')
        .select('source, last_success_at, consecutive_failures')
        .in('source', healthUpdates.map((h) => h.source))
        .order('checked_at', { ascending: false });
    const latestBySource = new Map<string, { last_success_at: string | null; consecutive_failures: number }>();
    for (const row of latestHealth ?? []) {
        if (!latestBySource.has(row.source)) latestBySource.set(row.source, row);
    }

    const healthRows = healthUpdates.map(({ source, status }) => {
        const prev = latestBySource.get(source);
        const isOnline = status === 'online';
        return {
            source,
            // eonet spans 4 hazard types in one poll -- 'wildfire' is just a
            // representative value for this row, not a claim it's wildfire-only.
            hazard_type: source === 'firms' || source === 'eonet' ? 'wildfire'
                : source === 'noaa' ? 'cyclone'
                    : source === 'nws-tsunami' ? 'tsunami'
                        : 'earthquake',
            status,
            last_success_at: isOnline ? now : prev?.last_success_at ?? null,
            consecutive_failures: isOnline ? 0 : (prev?.consecutive_failures ?? 0) + 1,
        };
    });
    const { error: healthError } = await admin.from('scraper_health').insert(healthRows);
    if (healthError) log.error('ingest: scraper_health insert failed', { error: healthError.message });

    return {
        status: 'OK',
        fetched: normalized.length, groups: groups.length, inserted, revised,
        wildfirePolled: shouldPollFirms, wildfireFetched, wildfireInserted,
        eonetPolled: shouldPollEonet, eonetFetched, eonetInserted,
        cycloneFetched: cyclones.length, cycloneInserted,
        tsunamiFetched: tsunamiAlerts.length, tsunamiInserted,
        health: healthUpdates,
    };
}

Deno.serve(async () => {
    try {
        const started = Date.now();
        const result = await runIngest();
        log.info('ingest run complete', { ...result, durationMs: Date.now() - started });
        return Response.json(result);
    } catch (err) {
        log.error('ingest run failed', { error: String(err) });
        return Response.json({ status: 'ERROR', error: String(err) }, { status: 500 });
    }
});
