import { log } from './logger';

export interface AftershockForecastBin {
    magnitude: number;
    probability: number;
    median: number;
}

export interface AftershockForecast {
    advisoryTimeFrame: string; // e.g. "1 Week" -- which forecast window USGS itself flags as the headline
    modelName: string;
    creationTime: number;
    nextForecastTime: number;
    primaryWindow: { label: string; timeStart: number; timeEnd: number; bins: AftershockForecastBin[] };
    observations: { magnitude: number; count: number }[];
}

interface UsgsForecastWindow {
    label: string;
    timeStart: number;
    timeEnd: number;
    bins: { magnitude: number; probability: number; median: number }[];
}

interface UsgsForecastJson {
    advisoryTimeFrame: string;
    creationTime: number;
    nextForecastTime: number;
    model?: { name?: string };
    observations?: { magnitude: number; count: number }[];
    forecast: UsgsForecastWindow[];
}

// USGS's Operational Aftershock Forecast (OAF) is a real product, but
// coverage is inconsistent -- most events (verified: a recent M6.8 Japan
// event) have none at all, while some California events do. It's also
// USGS-specific: NCS/GDACS/FIRMS-sourced hazard_events have no equivalent.
// Both functions below return `null` for the (common) no-forecast case
// rather than throwing, matching every other adapter's resilience
// convention (lib/gdacs.ts, lib/firms.ts).

/** Pure -- takes an already-fetched USGS detail geojson's `properties.products`
 * (no new fetch for the detail geojson itself), but still has to fetch the
 * one `forecast.json` file the product only points to by URL. */
export async function extractAftershockForecast(products: unknown): Promise<AftershockForecast | null> {
    try {
        const oaf = (products as Record<string, unknown> | null | undefined)?.oaf as
            | { contents?: Record<string, { url?: string }> }[]
            | undefined;
        const url = oaf?.[0]?.contents?.['forecast.json']?.url;
        if (!url) return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) return null;
            const data: UsgsForecastJson = await response.json();

            const primaryWindow =
                data.forecast.find((w) => w.label === data.advisoryTimeFrame) ?? data.forecast[0];
            if (!primaryWindow) return null;

            return {
                advisoryTimeFrame: data.advisoryTimeFrame,
                modelName: data.model?.name ?? 'USGS aftershock model',
                creationTime: data.creationTime,
                nextForecastTime: data.nextForecastTime,
                primaryWindow: {
                    label: primaryWindow.label,
                    timeStart: primaryWindow.timeStart,
                    timeEnd: primaryWindow.timeEnd,
                    bins: primaryWindow.bins.map((b) => ({
                        magnitude: b.magnitude, probability: b.probability, median: b.median,
                    })),
                },
                observations: data.observations ?? [],
            };
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (err) {
        log.warn('aftershock forecast extraction failed', { error: String(err) });
        return null;
    }
}

/** Fetches the USGS detail geojson for an id, then delegates to
 * extractAftershockForecast -- used when no detail geojson has already
 * been fetched (the hazard_events-resolved lookup path in
 * app/api/quake/[id]/route.ts). */
export async function fetchAftershockForecast(usgsEventId: string): Promise<AftershockForecast | null> {
    try {
        const res = await fetch(
            `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${encodeURIComponent(usgsEventId)}.geojson`
        );
        if (!res.ok) return null;
        const geojson = await res.json();
        return extractAftershockForecast(geojson?.properties?.products);
    } catch (err) {
        log.warn('aftershock forecast fetch failed', { error: String(err), usgsEventId });
        return null;
    }
}
