import { useState, useEffect, useCallback, useRef } from 'react';
import { log } from '@/lib/logger';
import { useOnlineStatus } from './useOnlineStatus';

interface QuakeFeature {
    id: string;
    properties: {
        // Nullable, matching components/QuakeList.tsx's exported QuakeFeature and
        // the detail page: /api/earthquakes passes USGS's GeoJSON straight
        // through and USGS reports `mag: null` for some events. Declaring it
        // `number` here didn't make it one -- it just hid the null from every
        // consumer of this hook, and `maxFeltDistanceKm(null)` coerced it to
        // magnitude 0 (see app/earthquake/local/page.tsx).
        mag: number | null;
        place: string;
        time: number;
        url: string;
        source?: 'usgs' | 'ncs';
    };
    geometry: {
        coordinates: [number, number, number];
    };
}

interface UseEarthquakesParams {
    source?: 'usgs' | 'ncs' | 'both';
    lat?: number;
    lng?: number;
    range?: string;
    hours?: string;
    limit?: string;
    minMag?: string;
    /** Epoch ms the `hours` window ends at; omit for a window ending now. */
    endTime?: string;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
}

export const useEarthquakes = (params: UseEarthquakesParams) => {
    const [quakes, setQuakes] = useState<QuakeFeature[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOfflineError, setIsOfflineError] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [sourceStatus, setSourceStatus] = useState<'online' | 'fallback' | undefined>(undefined);

    const isOnline = useOnlineStatus();
    const abortRef = useRef<AbortController | null>(null);
    const hasLoadedOnceRef = useRef(false);
    const knownIdsRef = useRef<Set<string> | null>(null);

    const {
        source, lat, lng, range, hours, limit, minMag, endTime,
        autoRefresh = false, refreshIntervalMs = 30000,
    } = params;

    const fetchQuakes = useCallback(async () => {
        if (!navigator.onLine) {
            setIsOfflineError(true);
            setError('You appear to be offline.');
            setLoading(false);
            setIsRefreshing(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (hasLoadedOnceRef.current) {
            setIsRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const queryParams = new URLSearchParams();
            if (source) queryParams.set('source', source);
            // `!== undefined`, not truthiness: lat/lng are numbers, and a
            // truthy test silently dropped an exact 0 -- the equator and the
            // prime meridian -- turning a local query into a worldwide one with
            // no indication. hooks/useHazardEvents.ts already guards this way.
            if (lat !== undefined) queryParams.set('lat', String(lat));
            if (lng !== undefined) queryParams.set('lng', String(lng));
            if (range) queryParams.set('range', range);
            if (hours) queryParams.set('hours', hours);
            if (limit) queryParams.set('limit', limit);
            if (minMag) queryParams.set('minMag', minMag);
            if (endTime) queryParams.set('endTime', endTime);

            const response = await fetch(`/api/earthquakes?${queryParams.toString()}`, {
                signal: controller.signal,
            });
            const data = await response.json();

            if (!response.ok) {
                setIsOfflineError(false);
                setError(data?.message || data?.error || 'Source unavailable');
                // Keep any previously loaded quakes on screen (e.g. a failed
                // background refresh) rather than blanking a working view.
            } else {
                setError(null);
                setIsOfflineError(false);
                setSourceStatus(data?.metadata?.status);
                const features: QuakeFeature[] = Array.isArray(data?.features) ? data.features : [];

                if (knownIdsRef.current) {
                    const fresh = new Set<string>();
                    for (const f of features) {
                        if (!knownIdsRef.current.has(f.id)) fresh.add(f.id);
                    }
                    // Set unconditionally, including to an empty set: only
                    // assigning when `fresh.size > 0` left the previous batch's
                    // ids marked "new" indefinitely, so the highlight and its
                    // screen-reader announcement stuck to stale rows until some
                    // later poll happened to bring something newer.
                    setNewIds(fresh);
                }
                knownIdsRef.current = new Set(features.map((f) => f.id));

                setQuakes(features);
            }
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            log.error('useEarthquakes fetch failed', { error: String(err) });
            if (!navigator.onLine) {
                setIsOfflineError(true);
                setError('You appear to be offline.');
            } else {
                setIsOfflineError(false);
                setError('Failed to connect to seismic network.');
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            hasLoadedOnceRef.current = true;
        }
    }, [source, lat, lng, range, hours, limit, minMag, endTime]);

    useEffect(() => {
        hasLoadedOnceRef.current = false;
        knownIdsRef.current = null;
        fetchQuakes();
        return () => abortRef.current?.abort();
    }, [fetchQuakes]);

    // Connectivity was restored after an offline error -- retry right away
    // instead of waiting for the next poll interval.
    useEffect(() => {
        if (isOnline && isOfflineError) fetchQuakes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            if (document.hidden) return;
            fetchQuakes();
        }, refreshIntervalMs);

        const onVisibilityChange = () => {
            if (!document.hidden) fetchQuakes();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [autoRefresh, refreshIntervalMs, fetchQuakes]);

    return {
        quakes, loading, isRefreshing, error, isOfflineError, lastUpdated, newIds,
        sourceStatus, refetch: fetchQuakes,
    };
};
