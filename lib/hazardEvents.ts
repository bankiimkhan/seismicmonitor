import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { REGION_BY_ID, regionForPointStrict, type Region } from './regions';
import { countryFromPlace } from './countries';
import type { EventScope, NormalizedEvent } from './hazardModel';
import { dedupe } from './hazardAggregates';

export type { EventScope, NormalizedEvent };
// Re-exported so route handlers have one import for the whole layer; the
// implementations live in hazardAggregates.ts, which is pure and testable.
export { dedupe, groupBy, rankGroups, countByDay, headlineEvent } from './hazardAggregates';
export type { GroupStats, RankBy } from './hazardAggregates';

/**
 * THE normalized hazard-event layer.
 *
 * Every surface that counts, lists, maps or ranks events reads through this
 * module, so a number shown on Home is the same number the Local page arrives
 * at. Before this existed each view queried `hazard_events` (or, for
 * earthquakes, a live feed) with its own window, its own idea of what a region
 * is, and its own dedupe -- which is how the same 24 hours could be "150
 * events" in one place and "9" in another.
 *
 * Three rules this layer enforces that callers must not re-implement:
 *
 *  1. REGION IS COMPUTED, NEVER READ. The `region_id` column holds
 *     regionForPoint's nearest-region fallback, so 794 earthquakes are filed
 *     under 'north-america' out to lng -179.6 and 667 have no region at all.
 *     Region comes from regionForPointStrict(lat, lng) here, every time.
 *
 *  2. TIME WINDOWS ARE ANCHORED ONCE. `since` is derived from a single `now`
 *     per query, so the 24h count and the 24h list cannot disagree because
 *     they were built a few seconds apart.
 *
 *  3. DEDUPE IS UNCONDITIONAL. The ingest merge engine already collapses
 *     multi-agency reports of one earthquake, but EONET and the per-source
 *     adapters can still surface the same physical event under two ids (a
 *     storm tracked as both `cyclone` and `severe_weather`, a volcano
 *     reported by EONET and Smithsonian). dedupe() below is the backstop.
 */

export interface EventQuery {
    /** Hazard types to include. Empty/omitted means every type. */
    hazardTypes?: string[];
    scope: EventScope;
    /** Window length in hours, ending at `until`. */
    hours: number;
    /** Epoch ms the window ends at; defaults to now. Lets the exact-date filter
     * ask for one specific past day rather than "everything since that day",
     * which `limit` would then trim back to the most recent events. */
    until?: number;
    /** Row cap applied after normalization, newest first. */
    limit?: number;
    /** Drop events whose severity is below this. Ignored for hazard types that
     * report no severity, so a floor can never silently empty a volcano list. */
    minSeverity?: number;
    country?: string;
}

export interface EventQueryResult {
    events: NormalizedEvent[];
    /** Total matching the query before `limit` was applied, so a truncated list
     * can still report an honest count. */
    total: number;
    /** The window actually used, echoed so clients render the same range they
     * were served rather than recomputing it. */
    window: { sinceMs: number; untilMs: number; hours: number };
    /** True when `limit` cut the list short. */
    truncated: boolean;
}

// PostgREST silently caps an unbounded select at 1000 rows. Paging explicitly
// keeps a busy window from losing its newest data with no error anywhere --
// the same reasoning /api/trends already documents.
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

const SELECT_COLUMNS =
    'id, hazard_type, place, url, canonical_time, lat, lng, depth_km, magnitude, alert_level, confidence_tier';

interface RawRow {
    id: string;
    hazard_type: string;
    place: string | null;
    url: string | null;
    canonical_time: string;
    lat: number | null;
    lng: number | null;
    depth_km: number | null;
    magnitude: number | null;
    alert_level: string | null;
    confidence_tier: string | null;
}

/**
 * Bounding box used to pre-filter in SQL. Region boxes are exact, so this is a
 * cheap indexed narrowing; the precise region test still happens in JS because
 * REGIONS overlap and priority order decides which one an event belongs to.
 */
function bboxForScope(scope: EventScope): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
    if (scope.kind === 'global') return null;
    if (scope.kind === 'region') {
        const region: Region | undefined = REGION_BY_ID[scope.regionId];
        if (!region) return null;
        return { minLat: region.minLat, maxLat: region.maxLat, minLng: region.minLng, maxLng: region.maxLng };
    }
    return {
        minLat: Math.max(-90, scope.lat - scope.rangeDeg),
        maxLat: Math.min(90, scope.lat + scope.rangeDeg),
        minLng: scope.lng - scope.rangeDeg,
        maxLng: scope.lng + scope.rangeDeg,
    };
}

export function normalizeRow(row: RawRow): NormalizedEvent | null {
    // A row with no position cannot be regionally classified, mapped, or
    // distance-filtered. Dropping it is better than defaulting to (0, 0), which
    // would plot every unlocatable event in the Gulf of Guinea.
    if (row.lat === null || row.lng === null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
        return null;
    }
    const time = new Date(row.canonical_time).getTime();
    if (!Number.isFinite(time)) return null;

    const region = regionForPointStrict(row.lat, row.lng);

    return {
        id: row.id,
        hazardType: row.hazard_type,
        place: row.place ?? 'Unknown location',
        country: countryFromPlace(row.place),
        regionId: region?.id ?? null,
        time,
        lat: row.lat,
        lng: row.lng,
        depthKm: row.depth_km,
        severity: row.magnitude,
        alertLevel: row.alert_level,
        confidence: row.confidence_tier,
        url: row.url ?? '',
    };
}

async function fetchRows(
    admin: SupabaseClient,
    query: EventQuery,
    sinceIso: string,
    untilIso: string
): Promise<RawRow[]> {
    const bbox = bboxForScope(query.scope);
    const rows: RawRow[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
        let q = admin
            .from('hazard_events')
            .select(SELECT_COLUMNS)
            .gte('canonical_time', sinceIso)
            .lte('canonical_time', untilIso)
            .order('canonical_time', { ascending: false })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (query.hazardTypes && query.hazardTypes.length > 0) {
            q = q.in('hazard_type', query.hazardTypes);
        }
        if (bbox) {
            q = q
                .gte('lat', bbox.minLat).lte('lat', bbox.maxLat)
                .gte('lng', bbox.minLng).lte('lng', bbox.maxLng);
        }

        const { data, error } = await q;
        if (error) throw error;

        const batch = (data ?? []) as RawRow[];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
    }

    return rows;
}

/**
 * Runs a query through the normalized layer. This is the only function that
 * should read `hazard_events` for display purposes.
 */
export async function queryEvents(query: EventQuery): Promise<EventQueryResult> {
    // Anchored once, so the count and the list this query produces cannot
    // disagree because they were derived a few seconds apart.
    const untilMs = query.until ?? Date.now();
    const sinceMs = untilMs - query.hours * 60 * 60 * 1000;
    const sinceIso = new Date(sinceMs).toISOString();

    const rows = await fetchRows(getSupabaseAdmin(), query, sinceIso, new Date(untilMs).toISOString());

    let events = rows
        .map(normalizeRow)
        .filter((e): e is NormalizedEvent => e !== null);

    // Exact region membership. The SQL bbox above is only a prefilter: REGIONS
    // overlap at their edges and priority order decides the winner, so a point
    // inside Europe's box may belong to Middle East. Re-testing here is what
    // makes "in South Asia" mean the same thing on every page.
    if (query.scope.kind === 'region') {
        const regionId = query.scope.regionId;
        events = events.filter((e) => e.regionId === regionId);
    }

    if (query.country) {
        const wanted = query.country.toLowerCase();
        events = events.filter((e) => (e.country ?? '').toLowerCase() === wanted);
    }

    // Applied only to events that actually carry a severity number. A hazard
    // type reporting none must not be emptied by a severity floor it cannot
    // satisfy -- that would render "no volcanoes" for a filter volcanoes have
    // no way to pass.
    if (query.minSeverity !== undefined) {
        const floor = query.minSeverity;
        events = events.filter((e) => e.severity === null || e.severity >= floor);
    }

    events = dedupe(events);
    events.sort((a, b) => b.time - a.time);

    const total = events.length;
    const limit = query.limit;
    const truncated = limit !== undefined && total > limit;

    return {
        events: limit !== undefined ? events.slice(0, limit) : events,
        total,
        window: { sinceMs, untilMs, hours: query.hours },
        truncated,
    };
}

