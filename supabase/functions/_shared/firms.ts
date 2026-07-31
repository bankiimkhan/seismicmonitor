// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/firms.ts by scripts/sync-edge-shared.mjs. Edit the original.
import { log } from './logger.ts';

const FIRMS_AREA_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
// VIIRS 375m over legacy MODIS 1km -- current standard resolution for FIRMS'
// near-real-time active-fire product.
const SOURCE = 'VIIRS_SNPP_NRT';

export interface WildfireHotspot {
    agencyNativeId: string;
    time: number; // epoch ms, UTC
    lat: number;
    lng: number;
    frp: number; // Fire Radiative Power, MW -- the wildfire severity metric
    confidence: 'low' | 'medium' | 'high';
    satellite: string;
    daynight: string;
    brightnessK?: number;
}

function mapConfidence(raw: string): WildfireHotspot['confidence'] {
    switch (raw.trim().toLowerCase()) {
        case 'h': return 'high';
        case 'n': return 'medium';
        case 'l':
        default: return 'low';
    }
}

// FIRMS' active-fire CSV has no embedded commas or quoted fields (every
// column is numeric/date/single-letter-enum), so a naive split is safe here
// -- same "no CSV library needed" discipline as the NCS scraper's
// regex-based parsing of semi-structured text.
export function parseFirmsCsv(csv: string): WildfireHotspot[] {
    const lines = csv.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map((h) => h.trim());
    const col = (name: string) => header.indexOf(name);
    const idx = {
        lat: col('latitude'),
        lng: col('longitude'),
        acqDate: col('acq_date'),
        acqTime: col('acq_time'),
        satellite: col('satellite'),
        confidence: col('confidence'),
        frp: col('frp'),
        daynight: col('daynight'),
        brightness: col('bright_ti4') !== -1 ? col('bright_ti4') : col('brightness')
    };

    const hotspots: WildfireHotspot[] = [];
    for (const line of lines.slice(1)) {
        const cells = line.split(',');
        const lat = parseFloat(cells[idx.lat]);
        const lng = parseFloat(cells[idx.lng]);
        const acqDate = cells[idx.acqDate];
        const acqTime = (cells[idx.acqTime] ?? '').padStart(4, '0');
        if (!acqDate || Number.isNaN(lat) || Number.isNaN(lng)) continue;

        const hh = acqTime.slice(0, 2);
        const mm = acqTime.slice(2, 4);
        const time = new Date(`${acqDate}T${hh}:${mm}:00Z`).getTime();
        if (Number.isNaN(time)) continue;

        const satellite = cells[idx.satellite] ?? 'unknown';
        // Stable across repeated fetches of the same detection -- FIRMS gives
        // no native event id, so identity is built from the detection's own
        // fields (this deliberately does NOT cluster repeated detections of
        // an ongoing fire into one persistent "incident"; see lib/firms.ts's
        // caller in app/api/ingest/route.ts for why).
        const agencyNativeId = `firms-${acqDate}-${acqTime}-${lat.toFixed(4)}-${lng.toFixed(4)}-${satellite}`;

        hotspots.push({
            agencyNativeId,
            time,
            lat,
            lng,
            frp: parseFloat(cells[idx.frp]) || 0,
            confidence: mapConfidence(cells[idx.confidence] ?? ''),
            satellite,
            daynight: cells[idx.daynight] ?? '',
            brightnessK: idx.brightness !== -1 ? parseFloat(cells[idx.brightness]) || undefined : undefined
        });
    }
    return hotspots;
}

/** Returns `null` (distinct from `[]`) when NASA_FIRMS_MAP_KEY isn't
 * configured, so the caller can skip this source entirely -- no
 * scraper_health row gets written until it's actually set up, rather than
 * showing a permanent, confusing "fallback" status on /about. */
export async function fetchFirmsHotspots(dayRange: 1 | 2 | 3 = 1): Promise<WildfireHotspot[] | null> {
    const key = Deno.env.get('NASA_FIRMS_MAP_KEY');
    if (!key) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const url = `${FIRMS_AREA_URL}/${key}/${SOURCE}/world/${dayRange}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`FIRMS upstream status: ${response.status}`);
        const csv = await response.text();
        return parseFirmsCsv(csv);
    } catch (err) {
        log.warn('FIRMS fetch failed', { error: String(err) });
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
}
