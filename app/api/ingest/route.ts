import { NextRequest, NextResponse } from 'next/server';
import { fetchEarthquakeFeatures, EarthquakeFeature } from '@/lib/earthquakes';
import { fetchGdacsFeatures } from '@/lib/gdacs';
import { fetchFirmsHotspots } from '@/lib/firms';
import { fetchEonetRecords } from '@/lib/eonet';
import { fetchNoaaCyclones } from '@/lib/noaaCyclones';
import { fetchTsunamiAlerts } from '@/lib/nwsTsunami';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { matchCandidates, selectCanonical, scoreConfidence, NormalizedEvent } from '@/lib/mergeEngine';
import { resolvePreferredSource } from '@/lib/sourcePriority';
import { regionForPoint } from '@/lib/regions';
import { log } from '@/lib/logger';

// FIRMS updates on a satellite-revisit cadence (hours), not a live feed --
// polling it every 15 min (this route's own cadence) would just re-fetch
// identical data and burn its 5000-transactions/10-min quota for nothing.
// Gated below via scraper_health.last_success_at instead of a second
// vercel.json cron entry, per the architecture review's tiered-scheduler
// recommendation (§5).
const FIRMS_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000;
// EONET spans several hazard types that all change more slowly than
// earthquakes (volcano status, storm tracks, wildfire incidents) -- same
// tiered-scheduler reasoning as FIRMS, just a shorter gate since severe
// storms genuinely move within a few hours.
const EONET_POLL_INTERVAL_MS = 60 * 60 * 1000;
// Batch size for hazard_events/event_sources upserts (shared by both the
// FIRMS and EONET steps below) -- a worldwide VIIRS day can be thousands of
// hotspots; one giant array upsert risks payload size/timeout limits, one
// row at a time would be far too many round-trips.
const HAZARD_INGEST_BATCH_SIZE = 500;

export const dynamic = 'force-dynamic';

type Agency = 'usgs' | 'ncs' | 'gdacs';

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

// Runs on a schedule (see vercel.json) to build up the historical record
// that /api/trends, /api/hazards, and /api/quake/[id] read from. Unlike the
// live /api/earthquakes route (which never touches the database), this is
// where cross-agency merging actually happens for earthquakes: USGS + NCS +
// GDACS are fetched, normalized into a common shape, clustered by
// lib/mergeEngine, and written as one canonical `hazard_events` row per
// real-world event, with every
// contributing agency's report kept in `event_sources` -- this is what
// fixes the old ignoreDuplicates upsert's silent revision loss (a later
// agency update now updates the canonical row and logs an `event_revisions`
// entry, instead of being dropped).
export async function GET(req: NextRequest) {
    if (!isAuthorizedCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const normalized: NormalizedEvent[] = [];
    const healthUpdates: { source: string; status: string }[] = [];

    const fetchers: { source: Agency; run: () => Promise<EarthquakeFeature[]> }[] = [
        { source: 'usgs', run: async () => (await fetchEarthquakeFeatures({ source: 'usgs', hours: 1, limit: 300 })).features },
        { source: 'ncs', run: async () => (await fetchEarthquakeFeatures({ source: 'ncs', hours: 1, limit: 100 })).features },
        { source: 'gdacs', run: () => fetchGdacsFeatures(1, 100) },
    ];

    for (const { source, run } of fetchers) {
        try {
            const features = await run();
            normalized.push(...features.map((f) => toNormalized(f, source)));
            healthUpdates.push({ source, status: 'online' });
        } catch (err) {
            log.error(`ingest: ${source} fetch failed`, { error: String(err) });
            healthUpdates.push({ source, status: 'fallback' });
        }
    }

    const groups = matchCandidates(normalized);

    // For each merge group, reuse a previously-assigned hazard_events.id if
    // any group member has been ingested before (looked up via
    // event_sources' (agency, agency_native_id) key) -- this keeps a
    // hazard_event's id stable across runs even if a higher-priority agency
    // joins the group later and would otherwise become canonical under a
    // *different* native id.
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

    let inserted = 0;
    let revised = 0;

    for (const group of groups) {
        const priorityOrder = resolvePreferredSource(group[0].lat, group[0].lng);
        const canonical = selectCanonical(group, priorityOrder);
        const confidence = scoreConfidence(group);
        const region = regionForPoint(canonical.lat, canonical.lng);

        let hazardEventId: string | undefined;
        for (const member of group) {
            const existing = existingIdByKey.get(`${member.agency}:${member.agencyNativeId}`);
            if (existing) {
                hazardEventId = existing;
                break;
            }
        }
        const id = hazardEventId ?? canonical.agencyNativeId;

        const { data: existingRow } = await admin
            .from('hazard_events')
            .select('magnitude, depth_km, place, canonical_time')
            .eq('id', id)
            .maybeSingle();

        const revisionRows: { hazard_event_id: string; field: string; old_value: string; new_value: string; changed_by_source: string }[] = [];
        if (existingRow) {
            const fields: [string, unknown, unknown][] = [
                ['magnitude', existingRow.magnitude, canonical.magnitude],
                ['depth_km', existingRow.depth_km, canonical.depthKm],
                ['place', existingRow.place, canonical.place],
            ];
            for (const [field, oldValue, newValue] of fields) {
                if (newValue !== undefined && newValue !== null && String(oldValue) !== String(newValue)) {
                    revisionRows.push({
                        hazard_event_id: id,
                        field,
                        old_value: String(oldValue),
                        new_value: String(newValue),
                        changed_by_source: canonical.agency,
                    });
                }
            }
        } else {
            inserted++;
        }
        if (revisionRows.length > 0) revised++;

        const { error: upsertError } = await admin.from('hazard_events').upsert(
            {
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
                last_updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
        );
        if (upsertError) {
            log.error('ingest: hazard_events upsert failed', { error: upsertError.message, id });
            continue;
        }

        if (revisionRows.length > 0) {
            const { error: revisionError } = await admin.from('event_revisions').insert(revisionRows);
            if (revisionError) log.error('ingest: event_revisions insert failed', { error: revisionError.message, id });
        }

        const sourceRows = group.map((member) => ({
            hazard_event_id: id,
            agency: member.agency,
            agency_native_id: member.agencyNativeId,
            reported_time: new Date(member.time).toISOString(),
            reported_lat: member.lat,
            reported_lng: member.lng,
            reported_depth_km: member.depthKm,
            reported_magnitude: member.magnitude,
            is_canonical: member === canonical,
            raw_payload: member, // normalized shape, not the verbatim upstream response -- adapters don't retain that today
            retrieved_at: new Date().toISOString(),
        }));
        const { error: sourcesError } = await admin
            .from('event_sources')
            .upsert(sourceRows, { onConflict: 'agency,agency_native_id' });
        if (sourcesError) log.error('ingest: event_sources upsert failed', { error: sourcesError.message, id });
    }

    // Wildfire (FIRMS): no merge engine involved -- it's the only wildfire
    // source, so there's nothing to cross-agency-merge, unlike earthquakes.
    // Each hotspot detection is its own hazard_events row (a point layer of
    // satellite detections, not a clustered "fire incident" -- see
    // lib/firms.ts's agencyNativeId comment for why that's the deliberate
    // scope here).
    let wildfireFetched = 0;
    let wildfireInserted = 0;
    const { data: firmsHealthRows } = await admin
        .from('scraper_health')
        .select('last_success_at')
        .eq('source', 'firms')
        .order('checked_at', { ascending: false })
        .limit(1);
    const lastFirmsSuccess = firmsHealthRows?.[0]?.last_success_at
        ? new Date(firmsHealthRows[0].last_success_at).getTime()
        : null;
    const shouldPollFirms = !lastFirmsSuccess || Date.now() - lastFirmsSuccess > FIRMS_POLL_INTERVAL_MS;

    if (shouldPollFirms) {
        const hotspots = await fetchFirmsHotspots(1);
        if (hotspots !== null) {
            wildfireFetched = hotspots.length;
            healthUpdates.push({ source: 'firms', status: 'online' });

            for (let i = 0; i < hotspots.length; i += HAZARD_INGEST_BATCH_SIZE) {
                const batch = hotspots.slice(i, i + HAZARD_INGEST_BATCH_SIZE);
                const ids = batch.map((h) => h.agencyNativeId);

                const { data: existingRows } = await admin.from('hazard_events').select('id').in('id', ids);
                const existingIds = new Set((existingRows ?? []).map((r) => r.id));
                wildfireInserted += ids.filter((id) => !existingIds.has(id)).length;

                const hazardRows = batch.map((h) => ({
                    id: h.agencyNativeId,
                    hazard_type: 'wildfire',
                    place: null,
                    url: null,
                    canonical_time: new Date(h.time).toISOString(),
                    lat: h.lat,
                    lng: h.lng,
                    depth_km: null,
                    magnitude: h.frp, // FRP (MW) -- wildfire's severity metric, standing in for the generic column
                    alert_level: null,
                    confidence_tier: h.confidence,
                    region_id: regionForPoint(h.lat, h.lng).id,
                    status: 'active',
                    last_updated_at: new Date().toISOString(),
                }));
                const { error: hazardError } = await admin.from('hazard_events').upsert(hazardRows, { onConflict: 'id' });
                if (hazardError) log.error('ingest: wildfire hazard_events upsert failed', { error: hazardError.message });

                const sourceRows = batch.map((h) => ({
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
                    retrieved_at: new Date().toISOString(),
                }));
                const { error: sourceError } = await admin
                    .from('event_sources')
                    .upsert(sourceRows, { onConflict: 'agency,agency_native_id' });
                if (sourceError) log.error('ingest: wildfire event_sources upsert failed', { error: sourceError.message });
            }
        }
        // hotspots === null means NASA_FIRMS_MAP_KEY isn't set -- no
        // scraper_health row at all until it's actually configured, rather
        // than showing a permanent, confusing "fallback" status on /about.
    }

    // EONET: covers volcano/severe_weather/landslide (all new hazard types)
    // plus additional wildfire coverage -- no merge engine here either, and
    // deliberately not merged with FIRMS's wildfire rows even though both
    // are hazard_type='wildfire' (curated multi-day incidents vs raw
    // per-pixel satellite detections are different granularities; see
    // lib/eonet.ts's module comment). Each EONET record already carries its
    // own hazard_type, so a single batch loop covers all four at once.
    let eonetFetched = 0;
    let eonetInserted = 0;
    const { data: eonetHealthRows } = await admin
        .from('scraper_health')
        .select('last_success_at')
        .eq('source', 'eonet')
        .order('checked_at', { ascending: false })
        .limit(1);
    const lastEonetSuccess = eonetHealthRows?.[0]?.last_success_at
        ? new Date(eonetHealthRows[0].last_success_at).getTime()
        : null;
    const shouldPollEonet = !lastEonetSuccess || Date.now() - lastEonetSuccess > EONET_POLL_INTERVAL_MS;

    if (shouldPollEonet) {
        const records = await fetchEonetRecords();
        eonetFetched = records.length;
        healthUpdates.push({ source: 'eonet', status: 'online' });

        for (let i = 0; i < records.length; i += HAZARD_INGEST_BATCH_SIZE) {
            const batch = records.slice(i, i + HAZARD_INGEST_BATCH_SIZE);
            const ids = batch.map((r) => r.agencyNativeId);

            const { data: existingRows } = await admin.from('hazard_events').select('id').in('id', ids);
            const existingIds = new Set((existingRows ?? []).map((r) => r.id));
            eonetInserted += ids.filter((id) => !existingIds.has(id)).length;

            const hazardRows = batch.map((r) => ({
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
                confidence_tier: 'medium', // curated/agency-sourced (IRWIN, SIVolcano, JTWC, ...), not raw automatic noise, but single-source -- see lib/eonet.ts
                region_id: regionForPoint(r.lat, r.lng).id,
                status: 'active',
                last_updated_at: new Date().toISOString(),
            }));
            const { error: hazardError } = await admin.from('hazard_events').upsert(hazardRows, { onConflict: 'id' });
            if (hazardError) log.error('ingest: eonet hazard_events upsert failed', { error: hazardError.message });

            const sourceRows = batch.map((r) => ({
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
                retrieved_at: new Date().toISOString(),
            }));
            const { error: sourceError } = await admin
                .from('event_sources')
                .upsert(sourceRows, { onConflict: 'agency,agency_native_id' });
            if (sourceError) log.error('ingest: eonet event_sources upsert failed', { error: sourceError.message });
        }
    }

    // Cyclones (NOAA NHC): no poll gate needed here, unlike FIRMS/EONET --
    // the id embeds the advisory's lastUpdate timestamp (see
    // lib/noaaCyclones.ts), so fetching every ingest cycle just re-upserts
    // the same row as a harmless no-op until NHC actually issues a new
    // advisory (~every 6h), which then naturally produces a new id/row.
    // No merge engine: NOAA is the only cyclone source right now.
    const cyclones = await fetchNoaaCyclones();
    let cycloneInserted = 0;
    if (cyclones.length > 0) {
        healthUpdates.push({ source: 'noaa', status: 'online' });

        for (let i = 0; i < cyclones.length; i += HAZARD_INGEST_BATCH_SIZE) {
            const batch = cyclones.slice(i, i + HAZARD_INGEST_BATCH_SIZE);
            const ids = batch.map((c) => c.agencyNativeId);

            const { data: existingRows } = await admin.from('hazard_events').select('id').in('id', ids);
            const existingIds = new Set((existingRows ?? []).map((r) => r.id));
            cycloneInserted += ids.filter((id) => !existingIds.has(id)).length;

            const hazardRows = batch.map((c) => ({
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
                confidence_tier: 'high', // official numbered NHC advisory -- the most authoritative source for these basins, unlike EONET/FIRMS's 'medium'/detection-confidence framing
                region_id: regionForPoint(c.lat, c.lng).id,
                status: 'active',
                last_updated_at: new Date().toISOString(),
            }));
            const { error: hazardError } = await admin.from('hazard_events').upsert(hazardRows, { onConflict: 'id' });
            if (hazardError) log.error('ingest: cyclone hazard_events upsert failed', { error: hazardError.message });

            const sourceRows = batch.map((c) => ({
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
                retrieved_at: new Date().toISOString(),
            }));
            const { error: sourceError } = await admin
                .from('event_sources')
                .upsert(sourceRows, { onConflict: 'agency,agency_native_id' });
            if (sourceError) log.error('ingest: cyclone event_sources upsert failed', { error: sourceError.message });
        }
    }

    // Tsunami (NOAA/NWS CAP alerts): no merge engine (single source), no
    // poll gate needed -- same reasoning as the cyclone block above, a CAP
    // message gets a brand-new `id` on every update, so re-ingesting every
    // cycle just re-upserts the current alert as a no-op until NWS actually
    // issues one. Coverage is US coastal waters/territories only (NOAA/NWS),
    // not global -- see lib/nwsTsunami.ts's module comment.
    const tsunamiAlerts = await fetchTsunamiAlerts();
    let tsunamiInserted = 0;
    if (tsunamiAlerts.length > 0) {
        healthUpdates.push({ source: 'nws-tsunami', status: 'online' });

        for (let i = 0; i < tsunamiAlerts.length; i += HAZARD_INGEST_BATCH_SIZE) {
            const batch = tsunamiAlerts.slice(i, i + HAZARD_INGEST_BATCH_SIZE);
            const ids = batch.map((a) => a.agencyNativeId);

            const { data: existingRows } = await admin.from('hazard_events').select('id').in('id', ids);
            const existingIds = new Set((existingRows ?? []).map((r) => r.id));
            tsunamiInserted += ids.filter((id) => !existingIds.has(id)).length;

            const hazardRows = batch.map((a) => ({
                id: a.agencyNativeId,
                hazard_type: 'tsunami',
                place: a.place,
                url: null,
                canonical_time: new Date(a.time).toISOString(),
                lat: a.lat,
                lng: a.lng,
                depth_km: null,
                magnitude: null, // no numeric severity metric -- same convention as volcano/landslide
                alert_level: a.alertLevel,
                confidence_tier: 'high', // official NWS warning, same precedent as NOAA cyclone advisories
                region_id: regionForPoint(a.lat, a.lng).id,
                status: 'active',
                last_updated_at: new Date().toISOString(),
            }));
            const { error: hazardError } = await admin.from('hazard_events').upsert(hazardRows, { onConflict: 'id' });
            if (hazardError) log.error('ingest: tsunami hazard_events upsert failed', { error: hazardError.message });

            const sourceRows = batch.map((a) => ({
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
                retrieved_at: new Date().toISOString(),
            }));
            const { error: sourceError } = await admin
                .from('event_sources')
                .upsert(sourceRows, { onConflict: 'agency,agency_native_id' });
            if (sourceError) log.error('ingest: tsunami event_sources upsert failed', { error: sourceError.message });
        }
    }

    // scraper_health: append one row per source per run, carrying forward
    // last_success_at and incrementing/resetting consecutive_failures so a
    // degraded provider is visible (and future-backoff-able) instead of
    // looking identical to a healthy one between failures.
    const { data: latestHealth } = await admin
        .from('scraper_health')
        .select('source, last_success_at, consecutive_failures')
        .in('source', healthUpdates.map((h) => h.source))
        .order('checked_at', { ascending: false });
    const latestBySource = new Map<string, { last_success_at: string | null; consecutive_failures: number }>();
    for (const row of latestHealth ?? []) {
        if (!latestBySource.has(row.source)) latestBySource.set(row.source, row);
    }

    const now = new Date().toISOString();
    const healthRows = healthUpdates.map(({ source, status }) => {
        const prev = latestBySource.get(source);
        const isOnline = status === 'online';
        return {
            source,
            // eonet spans 4 hazard types in one poll -- 'wildfire' here is
            // just a representative value for this source-health row, not a
            // claim that eonet is wildfire-only (see /api/health's own note
            // that hazard_type isn't grouped on yet).
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

    log.info('ingest run complete', {
        fetched: normalized.length, groups: groups.length, inserted, revised,
        wildfirePolled: shouldPollFirms, wildfireFetched, wildfireInserted,
        eonetPolled: shouldPollEonet, eonetFetched, eonetInserted,
        cycloneFetched: cyclones.length, cycloneInserted,
        tsunamiFetched: tsunamiAlerts.length, tsunamiInserted,
        health: healthUpdates,
    });

    return NextResponse.json({
        status: 'OK', fetched: normalized.length, groups: groups.length, inserted, revised,
        wildfirePolled: shouldPollFirms, wildfireFetched, wildfireInserted,
        eonetPolled: shouldPollEonet, eonetFetched, eonetInserted,
        cycloneFetched: cyclones.length, cycloneInserted,
        tsunamiFetched: tsunamiAlerts.length, tsunamiInserted,
        health: healthUpdates,
    });
}
