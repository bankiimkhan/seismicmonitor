"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { log } from '@/lib/logger';
import { useOnlineStatus } from './useOnlineStatus';
import {
    scopeToParams,
    type DataStatus,
    type EventScope,
    type EventsResponse,
    type NormalizedEvent,
    type SummaryResponse,
} from '@/lib/hazardModel';

/**
 * The single client entry point to the normalized hazard layer.
 *
 * The important thing this hook does is refuse to let a caller confuse an
 * outage with a quiet day. The old hooks returned `{ hazards: [], error }` and
 * left every call site to remember to check `error` before rendering
 * `hazards.length` -- and each card, table and tile remembered differently,
 * which is where "COUNT UNKNOWN" and confident zeroes both came from.
 *
 * Here the data is only reachable through a discriminated `status`:
 *
 *   loading -> nothing is known yet
 *   ready   -> a source answered; `events` is the truth, and an empty array
 *              genuinely means zero events
 *   failed  -> no count exists; there is no number to render
 *
 * `status` is DERIVED from whether the result in hand was produced by the query
 * currently being asked, rather than stored and flipped in an effect. That is
 * what guarantees a result can never be displayed against a different question
 * than the one it answers -- switching region or window shows "loading", not
 * the previous region's count sitting there looking authoritative.
 */

interface QueryOptions {
    /** Raw hazard_type values. Omit for every type. */
    types?: string[];
    scope: EventScope;
    /** Omit for every record ever archived -- see RANGE_OPTIONS. */
    hours?: number;
    limit?: number;
    minSeverity?: number;
    country?: string;
    /** Epoch ms the window ends at; omit for a window ending now. */
    until?: number;
    /** Skip fetching entirely -- e.g. a Local view with no location yet. */
    enabled?: boolean;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
}

interface QueryResult {
    status: DataStatus;
    events: NormalizedEvent[];
    /** Matching events before `limit`; equals events.length when not truncated. */
    total: number;
    truncated: boolean;
    /** True when `total` is a floor because paging hit its ceiling. */
    countCapped: boolean;
    window: { sinceMs: number | null; untilMs: number; hours: number | null } | null;
    /** Human-readable failure reason. Only set when status === 'failed'. */
    error: string | null;
    /** Distinguishes "you are offline" from "the source is down", because the
     * user can act on the first and not the second. */
    offline: boolean;
    refetch: () => void;
}

const DEFAULT_REFRESH_MS = 600_000;

/** A result tagged with the query that produced it. The tag is what makes
 * status derivable. */
interface Tagged<T> {
    query: string;
    value: T;
}

interface Failure {
    message: string;
    offline: boolean;
}

function buildQueryString(options: QueryOptions): string {
    const params = scopeToParams(options.scope);
    if (options.types && options.types.length > 0) params.set('types', options.types.join(','));
    // Left off entirely for an all-records query; the route reads an absent
    // `hours` as "no lower bound".
    if (options.hours !== undefined) params.set('hours', String(options.hours));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.minSeverity !== undefined) params.set('minSeverity', String(options.minSeverity));
    if (options.country) params.set('country', options.country);
    if (options.until !== undefined) params.set('until', String(options.until));
    return params.toString();
}

export function useHazardQuery(options: QueryOptions): QueryResult {
    const {
        enabled = true,
        autoRefresh = false,
        refreshIntervalMs = DEFAULT_REFRESH_MS,
    } = options;

    const [result, setResult] = useState<Tagged<EventsResponse> | null>(null);
    const [failure, setFailure] = useState<Tagged<Failure> | null>(null);

    const isOnline = useOnlineStatus();
    const abortRef = useRef<AbortController | null>(null);

    // The query string is the whole dependency: the effect re-runs on a genuine
    // change of question, not on a new object identity for the same one.
    const queryString = buildQueryString(options);

    const run = useCallback(async () => {
        if (!enabled) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setFailure({ query: queryString, value: { message: 'You appear to be offline.', offline: true } });
            return;
        }

        try {
            const response = await fetch(`/api/events?${queryString}`, { signal: controller.signal });
            const body = await response.json();

            if (!response.ok) {
                // No partial credit: a non-ok response never populates a
                // result, so a stale count cannot survive into a failed state.
                setFailure({
                    query: queryString,
                    value: { message: body?.error || `Request failed (${response.status})`, offline: false },
                });
                return;
            }

            setResult({ query: queryString, value: body as EventsResponse });
            setFailure(null);
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            log.error('useHazardQuery failed', { error: String(err), query: queryString });
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;
            setFailure({
                query: queryString,
                value: {
                    message: offline ? 'You appear to be offline.' : 'Could not reach the hazard archive.',
                    offline,
                },
            });
        }
    }, [enabled, queryString]);

    // Starting a fetch is the archetypal effect: it synchronises React with an
    // external system. Every state update inside `run` happens after an await
    // (or in the offline branch, which is a terminal state, not a cascade), so
    // there is no synchronous re-render loop here -- the rule cannot see
    // through the async callback to establish that.
    useEffect(() => {
        run();
        return () => abortRef.current?.abort();
    }, [run]);

    // Retry the moment connectivity returns, so a page that failed while
    // offline recovers without the user reloading it.
    useEffect(() => {
        if (isOnline && failure?.value.offline) run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    useEffect(() => {
        if (!autoRefresh || !enabled) return;
        const interval = setInterval(() => {
            if (!document.hidden) run();
        }, refreshIntervalMs);
        const onVisible = () => { if (!document.hidden) run(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [autoRefresh, enabled, refreshIntervalMs, run]);

    // Only a result produced by the question currently being asked counts as an
    // answer to it.
    const fresh = enabled && result?.query === queryString ? result.value : null;
    const failed = enabled && failure?.query === queryString ? failure.value : null;

    const status: DataStatus = fresh ? 'ready' : failed ? 'failed' : 'loading';

    return {
        status,
        events: fresh?.events ?? [],
        total: fresh?.total ?? 0,
        truncated: fresh?.truncated ?? false,
        countCapped: fresh?.countCapped ?? false,
        window: fresh?.window ?? null,
        error: failed?.message ?? null,
        offline: failed?.offline ?? false,
        refetch: run,
    };
}

/** Home's card grid, in one request. Same derived-status contract as above. */
export function useHazardSummary(scope: EventScope, hours: number, enabled = true) {
    const [result, setResult] = useState<Tagged<SummaryResponse> | null>(null);
    const [failure, setFailure] = useState<Tagged<string> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const queryString = useMemo(() => {
        const params = scopeToParams(scope);
        params.set('hours', String(hours));
        return params.toString();
    }, [scope, hours]);

    const run = useCallback(async () => {
        if (!enabled) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const response = await fetch(`/api/events/summary?${queryString}`, { signal: controller.signal });
            const body = await response.json();
            if (!response.ok) {
                setFailure({ query: queryString, value: body?.error || `Request failed (${response.status})` });
                return;
            }
            setResult({ query: queryString, value: body as SummaryResponse });
            setFailure(null);
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            log.error('useHazardSummary failed', { error: String(err) });
            setFailure({ query: queryString, value: 'Could not reach the hazard archive.' });
        }
    }, [enabled, queryString]);

    useEffect(() => {
        // See the note on the equivalent effect above: every state update in
        // `run` happens after an await, so no synchronous cascade is possible.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        run();
        return () => abortRef.current?.abort();
    }, [run]);

    const fresh = enabled && result?.query === queryString ? result.value : null;
    const failed = enabled && failure?.query === queryString ? failure.value : null;

    return {
        status: (fresh ? 'ready' : failed ? 'failed' : 'loading') as DataStatus,
        summary: fresh,
        error: failed,
        refetch: run,
    };
}
