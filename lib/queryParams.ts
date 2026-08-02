// Query params are strings, and `Number('abc')` is NaN. A NaN reaching a route
// handler is never harmless: `new Date(NaN).toISOString()` throws an uncaught
// RangeError, a NaN bbox is rejected by the upstream feeds, and a NaN sent into
// a PostgREST filter fails the whole request rather than just ignoring an
// unusable filter. Treat any non-finite value as "not supplied" so each param
// falls back to its own default.
//
// This lived as three byte-identical copies in the earthquakes/hazards/trends
// routes, and cyclone-history -- the one route that never got a copy -- was the
// one that 500'd on `?season=abc` and silently returned an empty list on
// `?limit=abc`.

/** Parses a query param as a finite number, or `undefined` when absent, blank, or non-numeric. */
export function finiteParam(raw: string | null): number | undefined {
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

/** `finiteParam` with a fallback, for params that always need a concrete value. */
export function finiteParamOr(raw: string | null, fallback: number): number {
    return finiteParam(raw) ?? fallback;
}
