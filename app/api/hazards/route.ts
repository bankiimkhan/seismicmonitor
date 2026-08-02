import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildBBoxFromCenter } from '@/lib/earthquakes';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParam, finiteParamOr } from '@/lib/queryParams';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Generic reader over the persisted `hazard_events` archive, parameterized
// by hazard_type -- not wildfire-specific, even though wildfire is its first
// consumer. Volcano/cyclone/flood will want the exact same "read persisted
// hazard_events by type" shape later. This is the read-side analog of
// /api/earthquakes for hazards that were never "live" to begin with (FIRMS
// updates on a satellite-revisit cadence, not a live feed -- see
// app/api/ingest/route.ts's FIRMS_POLL_INTERVAL_MS), so there's no upstream
// to pass through live; the archive *is* the data source.
//
// `type` accepts a comma-separated list (e.g. `cyclone,severe_weather`) to
// let a single caller merge closely-related hazard types that are stored
// separately by design (different sources/granularities -- see lib/eonet.ts
// and lib/noaaCyclones.ts) but read as one category on Home's overview grid.
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, remaining, resetMs } = checkRateLimit(`hazards:${ip}`);
    if (!ok) {
        log.warn('hazards route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const hazardType = searchParams.get('type');
    if (!hazardType) {
        return NextResponse.json({ error: 'type query param is required' }, { status: 400 });
    }
    const hazardTypes = hazardType.split(',').map((t) => t.trim()).filter(Boolean);

    const lat = finiteParam(searchParams.get('lat'));
    const lng = finiteParam(searchParams.get('lng'));
    const range = finiteParamOr(searchParams.get('range'), 15);
    const hours = finiteParamOr(searchParams.get('hours'), 24);
    // Clamped to the PostgREST max-rows ceiling: asking for more than 1000 in a
    // single select silently returns 1000 anyway.
    const limit = Math.min(1000, Math.max(1, finiteParamOr(searchParams.get('limit'), 200)));

    try {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const admin = getSupabaseAdmin();
        let query = admin
            .from('hazard_events')
            .select('id, place, url, canonical_time, lat, lng, depth_km, magnitude, alert_level, confidence_tier')
            .in('hazard_type', hazardTypes)
            .gte('canonical_time', since)
            .order('canonical_time', { ascending: false })
            .limit(limit);

        if (lat !== undefined && lng !== undefined) {
            const bbox = buildBBoxFromCenter(lat, lng, range);
            query = query
                .gte('lat', bbox.minLat).lte('lat', bbox.maxLat)
                .gte('lng', bbox.minLng).lte('lng', bbox.maxLng);
        }

        const { data, error } = await query;
        if (error) throw error;

        const features = (data ?? []).map((row) => ({
            type: 'Feature' as const,
            id: row.id,
            properties: {
                // Left as `null` (not coerced to 0) when the hazard type has
                // no magnitude data at all (e.g. volcano/landslide via
                // EONET) -- 0 would misleadingly read as a real measurement
                // rather than "no data".
                mag: row.magnitude,
                place: row.place ?? 'Unknown',
                time: new Date(row.canonical_time).getTime(),
                url: row.url ?? '',
                alertLevel: row.alert_level ?? undefined,
                confidence: row.confidence_tier,
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [row.lng, row.lat, row.depth_km ?? 0] as [number, number, number],
            },
        }));

        return NextResponse.json(
            { type: 'FeatureCollection', features, metadata: { hazardType } },
            { headers: { 'X-RateLimit-Remaining': String(remaining) } }
        );
    } catch (error) {
        log.error('hazards route failed', { error: String(error), hazardType });
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
