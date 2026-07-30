import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { extractAftershockForecast, fetchAftershockForecast } from '@/lib/aftershockForecast';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Resolves a single quake by id for the detail page (/quake/[id]) and its
// share links. There's no per-event index for the live feed itself (it's
// intentionally not backed by a database -- see lib/earthquakes.ts), so
// this checks two places in order:
//   1. Our own `hazard_events` table (populated every 15 min by /api/ingest,
//      merged across USGS/NCS/GDACS by lib/mergeEngine) -- covers events
//      from any ingested agency shortly after they first appear. The id
//      here is stable across ingest runs even if a higher-priority agency
//      joins the merge group later (see /api/ingest's existingIdByKey
//      lookup), so a share link never breaks once issued.
//   2. USGS's own per-event detail endpoint, for USGS-id'd events that
//      haven't been ingested yet (e.g. clicked within the last few minutes).
// NCS/GDACS have no equivalent per-event endpoint, so a very fresh
// NCS/GDACS-only event visited before the next ingest run will 404 -- an
// accepted limitation.
//
// Both branches also attach `aftershockForecast` (lib/aftershockForecast.ts)
// when USGS has one for this event -- null for the common case where no
// forecast exists, or the event has no USGS report at all.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Route params can arrive still percent-encoded (observed for ids
    // containing reserved characters, e.g. NCS's "YYYY-MM-DD HH:MM:SS
    // Place" ids with spaces/colons -- USGS's plain alphanumeric ids never
    // exposed this). Decode once; a no-op for ids with nothing to decode.
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);

    try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.from('hazard_events').select('*').eq('id', id).maybeSingle();
        if (error) log.warn('quake lookup: hazard_events table query failed', { error: error.message });
        if (data) {
            const { data: canonicalSource } = await admin
                .from('event_sources')
                .select('agency')
                .eq('hazard_event_id', id)
                .eq('is_canonical', true)
                .maybeSingle();

            // Aftershock forecasts (USGS-only, see lib/aftershockForecast.ts)
            // are tied to whichever USGS id exists for this event, regardless
            // of which agency is canonical here (e.g. NCS can be canonical
            // for a South-Asia event USGS also happened to catalog).
            const { data: usgsSource } = await admin
                .from('event_sources')
                .select('agency_native_id')
                .eq('hazard_event_id', id)
                .eq('agency', 'usgs')
                .maybeSingle();
            const aftershockForecast = usgsSource
                ? await fetchAftershockForecast(usgsSource.agency_native_id)
                : null;

            return NextResponse.json({
                id: data.id,
                source: canonicalSource?.agency ?? null,
                mag: data.magnitude,
                place: data.place,
                time: new Date(data.canonical_time).getTime(),
                lat: data.lat,
                lng: data.lng,
                depth: data.depth_km,
                url: data.url,
                confidence: data.confidence_tier,
                aftershockForecast,
            });
        }
    } catch (err) {
        log.warn('quake lookup: supabase unavailable', { error: String(err) });
    }

    // Fall back to USGS's own detail endpoint for USGS-shaped ids.
    try {
        const res = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${encodeURIComponent(id)}.geojson`);
        if (res.ok) {
            const geojson = await res.json();
            const [lng, lat, depth] = geojson.geometry?.coordinates ?? [];
            const aftershockForecast = await extractAftershockForecast(geojson.properties?.products);
            return NextResponse.json({
                id: geojson.id,
                source: 'usgs',
                mag: geojson.properties?.mag,
                place: geojson.properties?.place,
                time: geojson.properties?.time,
                lat, lng, depth,
                url: geojson.properties?.url,
                aftershockForecast,
            });
        }
    } catch (err) {
        log.warn('quake lookup: usgs detail fetch failed', { error: String(err) });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
