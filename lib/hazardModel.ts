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

export type EventScope =
    | { kind: 'global' }
    | { kind: 'region'; regionId: string }
    | { kind: 'point'; lat: number; lng: number; rangeDeg: number };

/** Default box for a "near me" query, in degrees. Matches what the Local pages
 * used before this layer existed, so the meaning of "local" did not shift. */
export const DEFAULT_POINT_RANGE_DEG = 15;

/** The two windows the UI offers everywhere it offers a choice of window. Kept
 * here so Home's 24H/7D toggle and every other surface agree on what each
 * means down to the hour. */
export const WINDOW_PRESETS = [
    { key: '24h', hours: 24, label: '24H', longLabel: 'Last 24 hours' },
    { key: '7d', hours: 168, label: '7D', longLabel: 'Last 7 days' },
] as const;

export type WindowKey = (typeof WINDOW_PRESETS)[number]['key'];

export function hoursForWindow(key: WindowKey): number {
    return WINDOW_PRESETS.find((w) => w.key === key)?.hours ?? 24;
}

/** Serializes a scope into query params. The inverse of parseScope, and the
 * only place request-building knows the param names. */
export function scopeToParams(scope: EventScope, params = new URLSearchParams()): URLSearchParams {
    params.set('scope', scope.kind);
    if (scope.kind === 'region') {
        params.set('regionId', scope.regionId);
    } else if (scope.kind === 'point') {
        params.set('lat', String(scope.lat));
        params.set('lng', String(scope.lng));
        params.set('range', String(scope.rangeDeg));
    }
    return params;
}

function finite(raw: string | null): number | undefined {
    if (raw === null || raw.trim() === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Reads a scope out of request params, falling back to global.
 *
 * Falls back rather than erroring, but only to the *widest* scope: an
 * unparseable region or a half-supplied point becomes "worldwide", which
 * over-reports. Defaulting to a narrow scope instead would quietly hide events
 * the caller asked to see.
 */
export function parseScope(params: URLSearchParams): EventScope {
    const kind = params.get('scope');

    if (kind === 'region') {
        const regionId = params.get('regionId');
        if (regionId && REGION_BY_ID[regionId]) return { kind: 'region', regionId };
        return { kind: 'global' };
    }

    if (kind === 'point') {
        const lat = finite(params.get('lat'));
        const lng = finite(params.get('lng'));
        if (lat === undefined || lng === undefined) return { kind: 'global' };
        const rangeDeg = finite(params.get('range')) ?? DEFAULT_POINT_RANGE_DEG;
        return { kind: 'point', lat, lng, rangeDeg };
    }

    return { kind: 'global' };
}

/** How a scope is named in copy, e.g. "South Asia" / "Worldwide". */
export function scopeLabel(scope: EventScope): string {
    if (scope.kind === 'global') return 'Worldwide';
    if (scope.kind === 'region') return REGION_BY_ID[scope.regionId]?.label ?? 'Region';
    return 'Near you';
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
    window: { sinceMs: number; untilMs: number; hours: number };
    truncated: boolean;
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
