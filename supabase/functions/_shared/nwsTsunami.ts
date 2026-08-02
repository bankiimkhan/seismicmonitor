// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/nwsTsunami.ts by scripts/sync-edge-shared.mjs. Edit the original.
import { log } from './logger.ts';

const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';
const NWS_ZONES_URL = 'https://api.weather.gov/zones';
// NOAA/NWS's API usage policy asks for an identifying User-Agent with real
// contact info (unlike USGS/GDACS/EONET/NHC, which don't require one).
const USER_AGENT = 'bd-earthquakes (contact.ahmedsakib@yahoo.com)';

export interface TsunamiAlert {
    agencyNativeId: string;
    time: number; // epoch ms, UTC
    lat: number;
    lng: number;
    place: string;
    alertLevel: string; // CAP `event`, e.g. "Tsunami Warning" / "Tsunami Watch" / "Tsunami Advisory"
}

interface CapAlertFeature {
    properties: {
        id: string;
        event: string;
        effective?: string;
        sent?: string;
        areaDesc?: string;
        geocode?: { UGC?: string[] };
    };
    geometry: { type: string; coordinates: unknown } | null;
}

function ringCentroid(ring: number[][] | undefined): { lat: number; lng: number } | null {
    if (!ring || ring.length === 0) return null;
    let sumLat = 0, sumLng = 0;
    for (const [lng, lat] of ring) { sumLat += lat; sumLng += lng; }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
}

// CAP alert geometry, when present, is a Polygon/MultiPolygon in standard
// GeoJSON [lng, lat] order -- centroid is a rough arithmetic mean of the
// ring's vertices, adequate for "which general area is under this warning",
// not precision navigation.
function centroidFromGeometry(geometry: CapAlertFeature['geometry']): { lat: number; lng: number } | null {
    if (!geometry) return null;
    if (geometry.type === 'Polygon') return ringCentroid((geometry.coordinates as number[][][])[0]);
    if (geometry.type === 'MultiPolygon') return ringCentroid((geometry.coordinates as number[][][][])[0]?.[0]);
    return null;
}

// Most CAP alerts (live-verified) carry no direct `geometry`, only a list of
// affected NWS zone codes (`geocode.UGC`) -- fall back to fetching the first
// zone's own polygon (live-verified this endpoint returns a real Polygon)
// and centroiding that instead. Returns null (caller skips the alert) if the
// zone lookup fails, matching this codebase's established "graceful skip,
// not a crash" convention for data that can't be resolved to coordinates.
async function centroidFromFirstZone(ugc: string, signal: AbortSignal): Promise<{ lat: number; lng: number } | null> {
    try {
        const response = await fetch(`${NWS_ZONES_URL}/forecast/${ugc}`, {
            signal,
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return centroidFromGeometry(data?.geometry ?? null);
    } catch {
        return null;
    }
}

// Returns `null` when the feed could not be read, `[]` when it was read and
// there are genuinely no active alerts -- the same distinction lib/firms.ts
// draws. Collapsing both to `[]` meant the caller recorded source health only
// when an alert existed, and tsunami alerts are rare, so no `nws-tsunami` row
// was ever written and /about could never show this source at all.
export async function fetchTsunamiAlerts(): Promise<TsunamiAlert[] | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const url = new URL(NWS_ALERTS_URL);
        url.searchParams.set('event', 'Tsunami Warning,Tsunami Watch,Tsunami Advisory');
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' }
        });
        if (!response.ok) throw new Error(`NWS upstream status: ${response.status}`);
        const data = await response.json();
        const features: CapAlertFeature[] = Array.isArray(data?.features) ? data.features : [];

        const alerts: TsunamiAlert[] = [];
        for (const f of features) {
            const { id, event, effective, sent, areaDesc, geocode } = f.properties;
            if (!id || !event) continue;
            // effective falls back to sent -- both are CAP-standard issuance
            // timestamps, effective is preferred when present (matches how
            // NWS's own alert pages present it).
            const time = new Date(effective ?? sent ?? '').getTime();
            if (Number.isNaN(time)) continue;

            let coords = centroidFromGeometry(f.geometry);
            if (!coords) {
                const firstZone = geocode?.UGC?.[0];
                if (!firstZone) {
                    log.warn('NWS tsunami alert has no geometry or zone to derive coordinates from, skipping', { id });
                    continue;
                }
                coords = await centroidFromFirstZone(firstZone, controller.signal);
            }
            if (!coords) {
                log.warn('NWS tsunami alert zone lookup failed, skipping', { id });
                continue;
            }

            alerts.push({
                // CAP messages get a brand-new `id` on every update (unlike a
                // stable per-event id), so re-ingesting every cycle just
                // upserts the current message as a no-op until NWS actually
                // issues an update -- same "id embeds freshness, no poll
                // gate needed" property as lib/noaaCyclones.ts.
                agencyNativeId: `nws-tsunami-${id.replace(/[^a-zA-Z0-9.-]/g, '-')}`,
                time,
                lat: coords.lat,
                lng: coords.lng,
                place: areaDesc || 'Unknown',
                alertLevel: event
            });
        }
        return alerts;
    } catch (err) {
        log.warn('NWS tsunami fetch failed', { error: String(err) });
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}
