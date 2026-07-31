// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/regions.ts by scripts/sync-edge-shared.mjs. Edit the original.
// Coarse, continent-scale world regions used to give Home/Trends a "your
// region" framing without a manual switcher (auto-detected from the
// resolved user location only -- see hooks/useLocation.ts). Deliberately
// approximate: these are for a friendly label and a sensible data-fetch
// window, not precise geopolitical borders.
export interface Region {
    id: string;
    label: string;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

// Priority order matters: several boxes deliberately overlap at their edges
// (Middle East / Central Asia / South Asia / Europe all border each other
// messily), and regionForPoint returns the first match -- so the smaller,
// more specific regions are listed before the larger ones that would
// otherwise swallow their edges.
export const REGIONS: Region[] = [
    { id: 'south-asia', label: 'South Asia', minLat: 5, maxLat: 40, minLng: 60, maxLng: 100 },
    { id: 'middle-east', label: 'Middle East', minLat: 12, maxLat: 42, minLng: 25, maxLng: 63 },
    { id: 'central-asia', label: 'Central Asia', minLat: 35, maxLat: 56, minLng: 46, maxLng: 88 },
    { id: 'southeast-asia', label: 'Southeast Asia', minLat: -11, maxLat: 23, minLng: 92, maxLng: 141 },
    { id: 'oceania', label: 'Oceania', minLat: -50, maxLat: 0, minLng: 110, maxLng: 180 },
    { id: 'east-asia', label: 'East Asia', minLat: 18, maxLat: 55, minLng: 100, maxLng: 150 },
    { id: 'europe', label: 'Europe', minLat: 35, maxLat: 72, minLng: -25, maxLng: 45 },
    { id: 'africa', label: 'Africa', minLat: -37, maxLat: 38, minLng: -20, maxLng: 52 },
    { id: 'north-america', label: 'North America', minLat: 7, maxLat: 85, minLng: -170, maxLng: -50 },
    { id: 'south-america', label: 'South America', minLat: -60, maxLat: 13, minLng: -90, maxLng: -30 },
];

/** Resolves any lat/lng to a region -- falls back to the nearest region by
 * bbox-center distance for points outside every box (open ocean, poles,
 * remote islands), so callers never need to handle a "no region" case. */
export function regionForPoint(lat: number, lng: number): Region {
    for (const region of REGIONS) {
        if (lat >= region.minLat && lat <= region.maxLat && lng >= region.minLng && lng <= region.maxLng) {
            return region;
        }
    }
    let best = REGIONS[0];
    let bestDist = Infinity;
    for (const region of REGIONS) {
        const cLat = (region.minLat + region.maxLat) / 2;
        const cLng = (region.minLng + region.maxLng) / 2;
        const dist = Math.hypot(lat - cLat, lng - cLng);
        if (dist < bestDist) {
            bestDist = dist;
            best = region;
        }
    }
    return best;
}

export function regionById(id: string): Region | undefined {
    return REGIONS.find((r) => r.id === id);
}

/** Converts a region's rectangle into center+range, so existing lat/lng/range
 * call sites (buildBBoxFromCenter in lib/earthquakes.ts) can fetch "this
 * region" with no new query-param plumbing. */
export function regionBoundsAsCenterRange(region: Region): { lat: number; lng: number; range: number } {
    const lat = (region.minLat + region.maxLat) / 2;
    const lng = (region.minLng + region.maxLng) / 2;
    const range = Math.max(region.maxLat - region.minLat, region.maxLng - region.minLng) / 2;
    return { lat, lng, range };
}
