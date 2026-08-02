// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/eonet.ts by scripts/sync-edge-shared.mjs. Edit the original.
import { log } from './logger.ts';

const EONET_CATEGORY_URL = 'https://eonet.gsfc.nasa.gov/api/v3/categories';
const CATEGORY_LIMIT = 200;

// Only categories actually in this app's stated hazard list (earthquakes/
// volcanoes/tsunami/landslides/wildfires/cyclones/floods/severe-weather).
// EONET's `earthquakes` category is deliberately excluded -- it would just
// duplicate/dilute the already-good USGS+NCS+GDACS merge pipeline
// (lib/mergeEngine.ts) with a lower-fidelity third-hand copy. Its other
// categories (drought, dustHaze, manmade, seaLakeIce, snow, tempExtremes,
// waterColor) aren't in this app's hazard list at all.
//
// `floods` is also excluded, deliberately: every flood event checked live
// reports as a Polygon, not a Point, and its polygon coordinates were
// [lat, lng]-ordered while every Point geometry checked (wildfires,
// volcanoes, a typhoon) is standard GeoJSON [lng, lat] -- an already-proven
// coordinate-order inconsistency. hazard_events only stores one lat/lng
// pair per row (no polygon storage), so guessing a centroid through that
// inconsistency is riskier than just not ingesting flood via EONET yet.
const CATEGORY_TO_HAZARD_TYPE: Record<string, string> = {
    wildfires: 'wildfire',
    volcanoes: 'volcano',
    severeStorms: 'severe_weather',
    landslides: 'landslide'
};

export interface EonetRecord {
    agencyNativeId: string;
    hazardType: string;
    time: number;
    lat: number;
    lng: number;
    magnitude: number | null;
    place: string;
    url: string;
}

interface EonetGeometryPoint {
    type: string;
    date: string;
    coordinates: [number, number];
    magnitudeValue?: number | null;
}

interface EonetEvent {
    id: string;
    title: string;
    link: string;
    closed: string | null;
    categories: { id: string }[];
    sources?: { id: string; url: string }[];
    geometry: EonetGeometryPoint[];
}

/** `null` when this category's fetch failed, distinct from `[]` for a category
 * that was read and is genuinely reporting nothing (which is the normal,
 * permanent state of `landslides` -- see lib/hazardConfig.ts). */
async function fetchCategory(categoryId: string): Promise<EonetRecord[] | null> {
    const hazardType = CATEGORY_TO_HAZARD_TYPE[categoryId];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const url = `${EONET_CATEGORY_URL}/${categoryId}?status=open&limit=${CATEGORY_LIMIT}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`EONET upstream status: ${response.status}`);
        const data = await response.json();
        const events: EonetEvent[] = Array.isArray(data?.events) ? data.events : [];

        const records: EonetRecord[] = [];
        for (const event of events) {
            // Skip Polygon/other non-Point geometry -- see the module comment above.
            const points = event.geometry.filter((g) => g.type === 'Point');
            for (const point of points) {
                const [lng, lat] = point.coordinates;
                // Skip unparseable dates -- ingest/route.ts calls
                // `.toISOString()` on this value with no try/catch around
                // it, so a NaN `time` here previously crashed the whole
                // ingest cycle instead of just this one point.
                const time = new Date(point.date).getTime();
                if (Number.isNaN(time)) continue;
                records.push({
                    // One record per track point (not one per event) -- an
                    // event like a tracked storm reports several points over
                    // time, and collapsing to one row would lose the track,
                    // same "raw point-in-time observations" choice already
                    // made for FIRMS hotspots (lib/firms.ts).
                    agencyNativeId: `eonet-${event.id}-${point.date}`,
                    hazardType,
                    time,
                    lat,
                    lng,
                    magnitude: point.magnitudeValue ?? null,
                    place: event.title,
                    url: event.sources?.[0]?.url ?? event.link
                });
            }
        }
        return records;
    } catch (err) {
        log.warn('EONET category fetch failed', { error: String(err), categoryId });
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/** Returns `null` only when EVERY category fetch failed -- i.e. the feed as a
 * whole is unreadable, and an empty result must not be read as "no events".
 * A partial failure still returns the categories that did come back, since
 * discarding real data for one broken category would be worse.
 *
 * This used to always return an array, so the caller (the ingest job) recorded
 * `eonet` as online and stamped scraper_health.last_success_at even when every
 * category had failed -- which is what EONET_POLL_INTERVAL_MS gates on, so a
 * total outage silently suppressed volcano/severe-weather/landslide ingest for
 * the next hour and still showed the source healthy on /about. */
export async function fetchEonetRecords(): Promise<EonetRecord[] | null> {
    const categories = Object.keys(CATEGORY_TO_HAZARD_TYPE);
    const results = await Promise.all(categories.map(fetchCategory));

    const readable = results.filter((r): r is EonetRecord[] => r !== null);
    if (readable.length === 0) return null;
    if (readable.length < results.length) {
        log.warn('EONET partially unreadable', {
            failed: categories.filter((_, i) => results[i] === null).join(',')
        });
    }
    return readable.flat();
}
