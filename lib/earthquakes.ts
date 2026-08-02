import { log } from './logger';

const USGS_FDSN_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const NCS_URL = 'https://riseq.seismo.gov.in/riseq/earthquake';

// Matches the client's polling interval (see useEarthquakes' refreshIntervalMs
// default). Requests within the same window share one cached upstream fetch.
const CACHE_WINDOW_SECONDS = 30;

export interface EarthquakeFeature {
    type: 'Feature';
    id: string;
    properties: {
        mag: number;
        place: string;
        time: number;
        url: string;
        // Only set when `source=both` merges multiple upstreams into one
        // list -- lets the UI badge which feed a given row came from.
        source?: 'usgs' | 'ncs' | 'gdacs';
        // GDACS-only: its own color-coded severity classification
        // ('Green' | 'Orange' | 'Red'). Undefined for USGS/NCS features.
        alertLevel?: string;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number, number];
    };
}

export interface EarthquakeQueryParams {
    source?: string; // 'usgs' | 'ncs' | 'both' | 'secondary'
    lat?: number;
    lng?: number;
    range?: number; // degrees, for bbox around lat/lng
    hours?: number;
    limit?: number;
    minMag?: number;
    /** Epoch ms the `hours` window ends at; defaults to now. Lets a caller
     * ask for a window that isn't anchored to the present -- e.g. the
     * exact-date filter on the Local/Global pages, which needs one specific
     * past day, not everything since that day (which `limit` would then
     * trim back down to only the most recent events). */
    endTime?: number;
}

export interface EarthquakeQueryResult {
    features: EarthquakeFeature[];
    sourceStatus?: 'online' | 'fallback';
}

// Latitude is clamped to the poles: USGS FDSN rejects minlatitude/maxlatitude
// outside [-90, 90] with a 400, and the Local page fetches a 20-degree box, so
// anyone above ~70N (Tromso, Utqiagvik, most of Alaska's north slope) produced
// an out-of-range query. That used to be invisible -- the 400 was swallowed into
// an empty feed -- but it was never "no earthquakes near you", it was a
// malformed request, and it now surfaces as a real error instead.
//
// Longitude is deliberately NOT clamped: USGS documents accepting [-360, 360]
// precisely so a box spanning the antimeridian stays contiguous, and the only
// other consumer (/api/hazards' Supabase range filter) just matches nothing
// outside the real range rather than erroring.
export function buildBBoxFromCenter(lat: number, lng: number, rangeDeg: number) {
    return {
        minLat: Math.max(-90, lat - rangeDeg),
        maxLat: Math.min(90, lat + rangeDeg),
        minLng: lng - rangeDeg,
        maxLng: lng + rangeDeg,
    };
}

async function fetchUsgsFeatures(opts: {
    base: string;
    minLat: number; maxLat: number; minLng: number; maxLng: number;
    startTimeIso: string; endTimeIso?: string; limit: number; minMag?: number;
}): Promise<EarthquakeFeature[]> {
    const { base, minLat, maxLat, minLng, maxLng, startTimeIso, endTimeIso, limit, minMag } = opts;
    const url = new URL(base);
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('starttime', startTimeIso);
    if (endTimeIso) url.searchParams.set('endtime', endTimeIso);
    url.searchParams.set('minlatitude', String(minLat));
    url.searchParams.set('maxlatitude', String(maxLat));
    url.searchParams.set('minlongitude', String(minLng));
    url.searchParams.set('maxlongitude', String(maxLng));
    url.searchParams.set('orderby', 'time');
    url.searchParams.set('limit', String(limit));
    if (minMag !== undefined) url.searchParams.set('minmagnitude', String(minMag));

    const response = await fetch(url.toString(), { next: { revalidate: CACHE_WINDOW_SECONDS } });
    // Throws rather than returning `[]`: an upstream 4xx/5xx is not "no
    // earthquakes occurred". Swallowing it here rendered a USGS outage as a
    // confident empty feed ("No earthquakes found") in the UI, and let the
    // ingest job record usgs as 'online' on /about while it was failing. The
    // `both` branch below keeps degrading gracefully via its own .catch().
    if (!response.ok) throw new Error(`USGS upstream status: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.features) ? data.features : [];
}

async function fetchNcsFeatures(limit: number): Promise<EarthquakeFeature[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const htmlResp = await fetch(NCS_URL, {
            next: { revalidate: CACHE_WINDOW_SECONDS },
            headers: { 'User-Agent': 'bd-earthquakes/1.0; (+https://bd-earthquakes.example)' },
            signal: controller.signal,
        });
        if (!htmlResp.ok) throw new Error(`NCS upstream status: ${htmlResp.status}`);
        const html = await htmlResp.text();

        const dataJsonRe = /data-json='([^']*?)'/g;
        const features: EarthquakeFeature[] = [];
        let match;

        while ((match = dataJsonRe.exec(html)) !== null && features.length < limit) {
            try {
                const decoded = match[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&');

                const eventData = JSON.parse(decoded);
                const { event_name, origin_time, lat_long, magnitude_depth } = eventData;
                if (!origin_time) continue;

                const timeMatch = origin_time.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                if (!timeMatch) continue;

                const [, year, month, day, hour, min, sec] = timeMatch;
                const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}+05:30`;
                const ts = new Date(iso).getTime();
                if (isNaN(ts)) continue;

                let mag = 0;
                const magMatch = magnitude_depth?.match(/M:\s*([0-9.]+)/);
                if (magMatch) mag = parseFloat(magMatch[1]) || 0;

                let place = 'Unknown';
                const nameMatch = event_name?.match(/M:\s*[0-9.]+\s*-\s*(.+)$/);
                if (nameMatch) place = nameMatch[1].trim();

                let lat = 0, lng = 0;
                if (lat_long) {
                    const coordMatch = lat_long.match(/([0-9.-]+)\s*,\s*([0-9.-]+)/);
                    if (coordMatch) {
                        lat = parseFloat(coordMatch[1]) || 0;
                        lng = parseFloat(coordMatch[2]) || 0;
                    }
                }

                const id = `${year}-${month}-${day} ${hour}:${min}:${sec} ${place}`;
                features.push({
                    type: 'Feature',
                    id,
                    properties: { mag, place, time: ts, url: NCS_URL },
                    geometry: { type: 'Point', coordinates: [lng, lat, 0] },
                });
            } catch {
                continue;
            }
        }
        return features;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function dedupeAndSort(features: EarthquakeFeature[], limit: number): EarthquakeFeature[] {
    const seen = new Set<string>();
    const deduped = features.filter((f) => {
        const key = `${f.properties?.time}-${f.properties?.place}-${Number(f.properties?.mag).toFixed(1)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    deduped.sort((a, b) => (b.properties?.time || 0) - (a.properties?.time || 0));
    return deduped.slice(0, limit);
}

export async function fetchEarthquakeFeatures(params: EarthquakeQueryParams): Promise<EarthquakeQueryResult> {
    const source = (params.source || 'usgs').toLowerCase();
    const limit = params.limit ?? 20;
    const hours = params.hours ?? 24;
    const minMag = params.minMag;
    // Round "now" down to the cache window so repeated calls within it
    // produce an identical URL and actually hit the fetch cache above. An
    // explicit endTime needs no rounding -- it's already a fixed instant.
    const windowMs = CACHE_WINDOW_SECONDS * 1000;
    const anchorMs = params.endTime ?? Math.floor(Date.now() / windowMs) * windowMs;
    const startTimeIso = new Date(anchorMs - hours * 60 * 60 * 1000).toISOString();
    // Only sent upstream when the caller asked for a window that ends in the
    // past; omitted for the ordinary "last N hours" case so a live feed is
    // never accidentally frozen at a stale upper bound.
    const endTimeIso = params.endTime !== undefined ? new Date(params.endTime).toISOString() : undefined;

    let minLat: number, maxLat: number, minLng: number, maxLng: number;
    if (params.lat !== undefined && params.lng !== undefined) {
        const bbox = buildBBoxFromCenter(params.lat, params.lng, params.range ?? 15);
        ({ minLat, maxLat, minLng, maxLng } = bbox);
    } else {
        // No point given -- the whole world. Callers that want a specific
        // region pass lat/lng/range for it (see lib/regions.ts's
        // regionBoundsAsCenterRange), so "no bbox" unambiguously means
        // global rather than defaulting to any one region.
        minLat = -90; maxLat = 90; minLng = -180; maxLng = 180;
    }

    const applyMinMag = (features: EarthquakeFeature[]) =>
        minMag !== undefined ? features.filter((f) => (f.properties?.mag ?? 0) >= minMag) : features;

    if (source === 'ncs') {
        try {
            const features = applyMinMag(await fetchNcsFeatures(limit));
            return { features, sourceStatus: 'online' };
        } catch (err) {
            log.warn('NCS source down, falling back to USGS', { error: String(err) });
            const usgsFeatures = applyMinMag(await fetchUsgsFeatures({
                base: USGS_FDSN_QUERY_URL, minLat, maxLat, minLng, maxLng, startTimeIso, endTimeIso, limit, minMag,
            }));
            return { features: usgsFeatures, sourceStatus: 'fallback' };
        }
    }

    if (source === 'both') {
        const usgsPromise = fetchUsgsFeatures({
            base: USGS_FDSN_QUERY_URL, minLat, maxLat, minLng, maxLng, startTimeIso, endTimeIso, limit, minMag,
        }).catch(() => []);
        const ncsPromise = fetchNcsFeatures(limit).catch(() => []);

        const [usgsFeatures, ncsFeatures] = await Promise.all([usgsPromise, ncsPromise]);
        const tag = (feats: EarthquakeFeature[], src: 'usgs' | 'ncs') =>
            feats.map((f) => ({ ...f, properties: { ...f.properties, source: src } }));
        const combined = applyMinMag([...tag(usgsFeatures, 'usgs'), ...tag(ncsFeatures, 'ncs')]);
        return { features: dedupeAndSort(combined, limit) };
    }

    const secondary = process.env.SECONDARY_FDSN_QUERY_URL;
    const base = source === 'secondary' && secondary ? secondary : USGS_FDSN_QUERY_URL;
    const features = applyMinMag(await fetchUsgsFeatures({
        base, minLat, maxLat, minLng, maxLng, startTimeIso, endTimeIso, limit, minMag,
    }));
    return { features };
}
