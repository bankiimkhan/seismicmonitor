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

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(
    REGIONS.map((r) => [r.id, r])
);

/** True when the point falls inside this region's box. */
export function pointInRegion(lat: number, lng: number, region: Region): boolean {
    return lat >= region.minLat && lat <= region.maxLat && lng >= region.minLng && lng <= region.maxLng;
}

/**
 * Resolves a point to the region that actually contains it, or `null` when no
 * region does.
 *
 * This is the classification function -- the one to use for bucketing events,
 * filtering a Regional view, or deciding what "worldwide" contains beyond the
 * named regions. regionForPoint below cannot do that job: it never returns
 * null, so every mid-ocean event lands in whichever region's centre happens to
 * be nearest.
 *
 * That distinction is not theoretical. The `region_id` column on hazard_events
 * was populated with the nearest-region answer, which is why 794 earthquakes
 * are stored as 'north-america' spanning lat -29.4 to 69.4 and out to lng
 * -179.6 -- well outside that region's box (lat 7..85, lng -170..-50) -- and a
 * further 667 rows carry no region at all. Nothing reads that column for
 * classification any more; region is computed here, from lat/lng, so every
 * surface buckets an event the same way.
 */
export function regionForPointStrict(lat: number, lng: number): Region | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    for (const region of REGIONS) {
        if (pointInRegion(lat, lng, region)) return region;
    }
    return null;
}

/** Resolves any lat/lng to a region -- falls back to the nearest region by
 * bbox-center distance for points outside every box (open ocean, poles,
 * remote islands), so callers never need to handle a "no region" case.
 *
 * Use this only to *label* a user's own location ("your region"). For
 * classifying events use regionForPointStrict, which admits when a point is
 * outside every region instead of inventing the closest one. */
export function regionForPoint(lat: number, lng: number): Region {
    const exact = regionForPointStrict(lat, lng);
    if (exact) return exact;
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
