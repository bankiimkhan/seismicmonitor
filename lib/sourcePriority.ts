import { regionForPoint } from './regions';

// Which providers to prefer, in order, for a given region -- and the
// fallback everywhere else. This is deliberately a plain data table, not
// branching code: adding a new provider for a new region (e.g. JMA for
// east-asia once that adapter exists) is a one-line addition here, nothing
// downstream needs to change.
//
// Only 'usgs' | 'ncs' | 'gdacs' exist as real adapters today (lib/earthquakes.ts,
// lib/gdacs.ts). The full target matrix (JMA/BMKG/GeoNet/NRCan/EMSC/...) is
// documented in the architecture review artifact -- add entries here only
// once the corresponding adapter actually exists, so this table never lists
// a provider nothing can fetch.
//
// No country-code (finer than continent-scale region) layer yet either --
// there's no second national-agency adapter to route to within a region, so
// a geocoding layer would have nothing to do. Add it once e.g. JMA exists
// and Japan needs to be carved out of the east-asia region's list.
const REGION_PROVIDER_PRIORITY: Record<string, string[]> = {
    'south-asia': ['ncs', 'usgs', 'gdacs'],
};

const DEFAULT_PROVIDER_PRIORITY = ['usgs', 'gdacs'];

/** Ordered list of provider ids to prefer for a given point, most-preferred
 * first. Falls back to the global default when no lat/lng is given (e.g. a
 * worldwide request) or the point's region has no specific override. */
export function resolvePreferredSource(lat?: number, lng?: number): string[] {
    if (lat === undefined || lng === undefined) return DEFAULT_PROVIDER_PRIORITY;
    const region = regionForPoint(lat, lng);
    return REGION_PROVIDER_PRIORITY[region.id] ?? DEFAULT_PROVIDER_PRIORITY;
}
