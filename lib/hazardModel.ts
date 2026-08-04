import { REGION_BY_ID } from './regions';

/**
 * The wire contract for the normalized hazard layer -- shared by the routes
 * that serve it and the client code that asks for it.
 *
 * Deliberately free of server imports so both halves compile against the same
 * definitions. When the shape of a scope or an event changes, it changes for
 * everyone at once; that is the mechanism that keeps Home, Local, Regional,
 * Global, Map and Trends from drifting into six slightly different ideas of
 * what "events in the last 24 hours near me" means.
 */

/** One event, as every consumer sees it. See lib/hazardEvents.ts for how the
 * raw archive row becomes this. */
export interface NormalizedEvent {
    id: string;
    hazardType: string;
    place: string;
    /** Null when the source string carries no country -- never guessed. */
    country: string | null;
    /** Null when the event falls outside every predefined region. */
    regionId: string | null;
    time: number;
    lat: number;
    lng: number;
    depthKm: number | null;
    /** This hazard's own severity number, or null when it reports none. */
    severity: number | null;
    alertLevel: string | null;
    confidence: string | null;
    url: string;
}

/**
 * The two slices of the world anything can be scoped to.
 *
 * A third kind, `point` (a box around the user's coordinates), backed the Local
 * view and was removed with it. It was a genuinely different shape from a
 * region rather than a subset -- so an event could be "local" without being in
 * your region, and vice versa, and the two counts disagreed by construction.
 * With it gone, every geographic bucket in the app comes from the same region
 * definitions.
 */
export type EventScope =
    | { kind: 'global' }
    | { kind: 'region'; regionId: string };

/** The two windows Home's toggle offers. Kept here so that control and every
 * other surface agree on what each means down to the hour. */
export const WINDOW_PRESETS = [
    { key: '24h', hours: 24, label: '24H', longLabel: 'Last 24 hours' },
    { key: '7d', hours: 168, label: '7D', longLabel: 'Last 7 days' },
] as const;

/** Range options for the Regional and Global event lists.
 *
 * `hours: null` is "every record ever archived", and it is deliberately first
 * and the default: those two views are meant to be the complete history of a
 * place, newest first. The bounded ranges remain as a way to narrow down, not
 * as the starting point. */
export const RANGE_OPTIONS: { hours: number | null; label: string }[] = [
    { hours: null, label: 'All records' },
    { hours: 24, label: 'Last 24 hours' },
    { hours: 168, label: 'Last 7 days' },
    { hours: 720, label: 'Last 30 days' },
    { hours: 2160, label: 'Last 90 days' },
    { hours: 8760, label: 'Past year' },
];

export function rangeLabel(hours: number | null): string {
    return RANGE_OPTIONS.find((r) => r.hours === hours)?.label ?? `Last ${Math.round((hours ?? 0) / 24)} days`;
}

export type WindowKey = (typeof WINDOW_PRESETS)[number]['key'];

export function hoursForWindow(key: WindowKey): number {
    return WINDOW_PRESETS.find((w) => w.key === key)?.hours ?? 24;
}

/** Serializes a scope into query params. The inverse of parseScope, and the
 * only place request-building knows the param names. */
export function scopeToParams(scope: EventScope, params = new URLSearchParams()): URLSearchParams {
    params.set('scope', scope.kind);
    if (scope.kind === 'region') params.set('regionId', scope.regionId);
    return params;
}

/**
 * Reads a scope out of request params, falling back to global.
 *
 * Falls back rather than erroring, but only to the *widest* scope: an
 * unrecognised region becomes "worldwide", which over-reports. Defaulting to a
 * narrower scope would quietly hide events the caller asked to see. Old
 * `scope=point` links from before the Local view was removed land here and
 * resolve to global for the same reason.
 */
export function parseScope(params: URLSearchParams): EventScope {
    if (params.get('scope') === 'region') {
        const regionId = params.get('regionId');
        if (regionId && REGION_BY_ID[regionId]) return { kind: 'region', regionId };
    }
    return { kind: 'global' };
}

/** How a scope is named in copy, e.g. "South Asia" / "Worldwide". */
export function scopeLabel(scope: EventScope): string {
    if (scope.kind === 'region') return REGION_BY_ID[scope.regionId]?.label ?? 'Region';
    return 'Worldwide';
}

/**
 * The three states any hazard-data surface can be in.
 *
 * This exists because "0" and "we don't know" were being rendered the same
 * way. They are different claims: `ready` with an empty list is the app
 * asserting that nothing happened, which it may only do when a source actually
 * answered. `failed` must never render a count.
 */
export type DataStatus = 'loading' | 'ready' | 'failed';

export interface EventsResponse {
    events: NormalizedEvent[];
    total: number;
    /** `sinceMs`/`hours` are null for an all-records query. */
    window: { sinceMs: number | null; untilMs: number; hours: number | null };
    truncated: boolean;
    /** `total` is a floor, not the exact count -- paging hit its ceiling. */
    countCapped: boolean;
}

/** Per-hazard-type rollup behind Home's card grid. */
export interface HazardSummaryEntry {
    slug: string;
    count: number;
    headline: {
        id: string;
        place: string;
        severity: number | null;
        time: number;
    } | null;
    /** Per-day counts for the card sparkline. */
    trend: number[];
}

export interface SummaryResponse {
    scope: { kind: string; label: string };
    window: { sinceMs: number; untilMs: number; hours: number };
    hazards: HazardSummaryEntry[];
}
