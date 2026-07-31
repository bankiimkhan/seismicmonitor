// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/noaaCyclones.ts by scripts/sync-edge-shared.mjs. Edit the original.
import { log } from './logger.ts';

const NOAA_CURRENT_STORMS_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';

// Standard NHC storm classification codes -- unrecognized codes (rare, e.g.
// agency-specific variants) fall back to the raw code rather than guessing.
const CLASSIFICATION_LABELS: Record<string, string> = {
    TD: 'Tropical Depression',
    SD: 'Subtropical Depression',
    TS: 'Tropical Storm',
    SS: 'Subtropical Storm',
    HU: 'Hurricane',
    EX: 'Extratropical Cyclone',
    PTC: 'Potential Tropical Cyclone',
    LO: 'Low'
};

export interface CycloneRecord {
    agencyNativeId: string;
    time: number;
    lat: number;
    lng: number;
    windSpeedKt: number;
    place: string;
    classification: string;
    url: string;
}

interface NoaaStorm {
    id: string;
    name: string;
    classification: string;
    intensity: string;
    latitudeNumeric: number;
    longitudeNumeric: number;
    lastUpdate: string;
    publicAdvisory?: { url?: string };
}

// One record per storm per advisory, not one row overwritten per storm --
// same "preserve the track" choice as lib/eonet.ts's per-geometry-point
// records. The id embeds `lastUpdate` (the advisory issuance time), so
// re-ingesting between advisories is a harmless no-op upsert of the same
// row -- no poll gate needed the way FIRMS/EONET need one, since NHC issues
// a new advisory (and therefore a genuinely new id) only every ~6h anyway.
export async function fetchNoaaCyclones(): Promise<CycloneRecord[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(NOAA_CURRENT_STORMS_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`NOAA NHC upstream status: ${response.status}`);
        const data = await response.json();
        const storms: NoaaStorm[] = Array.isArray(data?.activeStorms) ? data.activeStorms : [];

        // flatMap (not map) so a record with an unparseable `lastUpdate` is
        // dropped instead of carrying a NaN `time` downstream --
        // ingest/route.ts calls `.toISOString()` on this value with no
        // try/catch around it, so a NaN here previously crashed the whole
        // ingest cycle.
        return storms.flatMap((storm): CycloneRecord[] => {
            const time = new Date(storm.lastUpdate).getTime();
            if (Number.isNaN(time)) return [];
            const label = CLASSIFICATION_LABELS[storm.classification] ?? storm.classification;
            return [{
                agencyNativeId: `noaa-${storm.id}-${storm.lastUpdate}`,
                time,
                lat: storm.latitudeNumeric,
                lng: storm.longitudeNumeric,
                windSpeedKt: parseFloat(storm.intensity) || 0,
                place: `${label} ${storm.name}`,
                classification: storm.classification,
                url: storm.publicAdvisory?.url ?? 'https://www.nhc.noaa.gov/'
            }];
        });
    } catch (err) {
        log.warn('NOAA NHC fetch failed', { error: String(err) });
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
}
