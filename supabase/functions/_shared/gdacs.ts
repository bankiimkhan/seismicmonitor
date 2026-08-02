// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/gdacs.ts by scripts/sync-edge-shared.mjs. Edit the original.
import { EarthquakeFeature } from './earthquakes.ts';
import { log } from './logger.ts';

const GDACS_EVENT_LIST_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';

// GDACS aggregates several agencies' alerts (its earthquake feed is
// frequently sourced from NEIC/USGS under the hood -- properties.source
// reads "NEIC" on many events). It's included as a third live provider not
// for independent magnitude cross-checks, but for its cross-hazard breadth
// (volcano/flood/cyclone/drought/wildfire feeds share this same event-list
// API, selected via `eventlist` -- NOT `eventtype`, see below) and its own
// alert-level classification, which USGS/NCS don't provide. GDACS has no
// distinct tsunami event type (live-checked: only EQ/FL/WF/TC/DR/VO exist).
//
// No API key required -- confirmed against the live endpoint. Depth isn't a
// dedicated field; GDACS packs it into a free-text `severitytext` string
// ("Magnitude 5.8M, Depth:10km"), parsed the same way lib/earthquakes.ts's
// NCS parser already pulls fields out of semi-structured text.
const DEPTH_RE = /Depth:\s*([0-9.]+)\s*km/i;

interface GdacsFeature {
    properties: {
        eventid: number;
        eventtype: string;
        fromdate: string;
        alertlevel?: string;
        country?: string;
        source?: string;
        severitydata?: { severity?: number; severitytext?: string };
        url?: { report?: string };
    };
    geometry: { coordinates: [number, number] };
}

/** Returns `null` when the feed could not be read, `[]` when it was read and
 * genuinely reported no earthquakes -- the same distinction lib/firms.ts and
 * lib/noaaCyclones.ts draw. Returning `[]` for both (as this used to) meant the
 * ingest job's `try/catch` never saw a failure, so GDACS was recorded as
 * 'online' on /about no matter how long it had been down. */
export async function fetchGdacsFeatures(hours: number, limit: number): Promise<EarthquakeFeature[] | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
        const now = new Date();
        const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const url = new URL(GDACS_EVENT_LIST_URL);
        // `eventlist` is the real filter param -- `eventtype` (the old value
        // here) is silently ignored by GDACS's API and returns every hazard
        // type unfiltered (EQ/FL/WF/TC/DR/VO mixed together), live-verified
        // 2026-07-29. That meant this "earthquake" adapter had been feeding
        // floods/wildfires/cyclones/droughts/volcanoes into the earthquake
        // merge pipeline, mislabeled, using their unrelated severity score
        // as a fake magnitude. The `eventtype === 'EQ'` filter below is kept
        // as defense-in-depth in case the API's behavior shifts again.
        url.searchParams.set('eventlist', 'EQ');
        url.searchParams.set('fromdate', from.toISOString().slice(0, 10));
        url.searchParams.set('todate', now.toISOString().slice(0, 10));

        const response = await fetch(url.toString(), { signal: controller.signal });
        if (!response.ok) throw new Error(`GDACS upstream status: ${response.status}`);

        // GDACS signals "no events in this window" with `204 No Content` and an
        // empty body rather than an empty FeatureCollection (live-verified
        // 2026-08-02). 204 passes the `response.ok` check above, so this used to
        // reach `response.json()`, which throws on an empty body -- landing in
        // the catch below and reporting a perfectly healthy feed as unreadable.
        //
        // That is not a rare edge: the ingest job asks for a ~1-day window and
        // GDACS only publishes the larger events, so most windows are genuinely
        // empty. Every one of them would have marked gdacs 'fallback', climbed
        // consecutive_failures, and shown the source as degraded on /about.
        // Read the body once and treat "empty" as what it actually is -- a
        // successful read with no events, i.e. `[]`, never `null`.
        const body = await response.text();
        if (response.status === 204 || body.trim() === '') return [];

        // Still parsed inside the try: a genuinely malformed body should fall
        // through to the catch and return null, same as before.
        const data = JSON.parse(body);
        const features: GdacsFeature[] = Array.isArray(data?.features) ? data.features : [];

        // flatMap (not map) so a record with an unparseable date, or a
        // non-earthquake type that slipped through, is dropped instead of
        // carrying a NaN `time` downstream -- ingest/route.ts calls
        // `.toISOString()` on this value with no try/catch around it, so a
        // NaN here previously crashed the whole ingest cycle.
        return features.slice(0, limit).flatMap((f): EarthquakeFeature[] => {
            if (f.properties.eventtype !== 'EQ') return [];
            const { eventid, fromdate, alertlevel, country, severitydata, url: reportUrl } = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            const time = new Date(fromdate).getTime();
            if (Number.isNaN(time)) return [];
            const depthMatch = severitydata?.severitytext?.match(DEPTH_RE);
            const depth = depthMatch ? parseFloat(depthMatch[1]) : 0;

            return [{
                type: 'Feature',
                id: `gdacs-${eventid}`,
                properties: {
                    mag: severitydata?.severity ?? 0,
                    place: country ?? 'Unknown',
                    time,
                    url: reportUrl?.report ?? '',
                    alertLevel: alertlevel
                },
                geometry: { type: 'Point', coordinates: [lng, lat, depth] }
            }];
        });
    } catch (err) {
        log.warn('GDACS fetch failed', { error: String(err) });
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}
