import { useState, useEffect, useCallback, useRef } from 'react';
import { log } from '@/lib/logger';
import { useOnlineStatus } from './useOnlineStatus';

export interface HazardFeature {
    id: string;
    properties: {
        mag: number | null; // hazard-specific severity metric (FRP for wildfire, wind speed for storms); null when the hazard type has no such data (e.g. volcano/landslide)
        place: string;
        time: number;
        url: string;
        confidence?: 'low' | 'medium' | 'high';
        alertLevel?: string; // e.g. cyclone classification (TD/TS/HU/...) -- see lib/noaaCyclones.ts
    };
    geometry?: {
        coordinates: [number, number, number];
    };
}

interface UseHazardEventsParams {
    lat?: number;
    lng?: number;
    range?: string;
    hours?: string;
    limit?: string;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
}

// Generalized from the earlier wildfire-only useWildfires hook -- mirrors
// hooks/useEarthquakes.ts's shape/AbortController/visibility-aware polling
// pattern exactly, reading /api/hazards?type={hazardType} for whichever
// hazard type the caller passes. The poll interval defaults much longer
// here than earthquakes: none of these hazard types (wildfire/volcano/
// severe_weather/landslide) update faster than every couple hours at the
// source (FIRMS satellite revisit, EONET's own polling cadence).
export const useHazardEvents = (hazardType: string, params: UseHazardEventsParams) => {
    const [hazards, setHazards] = useState<HazardFeature[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOfflineError, setIsOfflineError] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const isOnline = useOnlineStatus();
    const abortRef = useRef<AbortController | null>(null);
    const hasLoadedOnceRef = useRef(false);

    const { lat, lng, range, hours, limit, autoRefresh = false, refreshIntervalMs = 600_000 } = params;

    const fetchHazards = useCallback(async () => {
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
            const queryParams = new URLSearchParams({ type: hazardType });
            if (lat !== undefined) queryParams.set('lat', String(lat));
            if (lng !== undefined) queryParams.set('lng', String(lng));
            if (range) queryParams.set('range', range);
            if (hours) queryParams.set('hours', hours);
            if (limit) queryParams.set('limit', limit);

            const response = await fetch(`/api/hazards?${queryParams.toString()}`, { signal: controller.signal });
            const data = await response.json();

            if (!response.ok) {
                setIsOfflineError(false);
                setError(data?.message || data?.error || 'Source unavailable');
            } else {
                setError(null);
                setIsOfflineError(false);
                setHazards(Array.isArray(data?.features) ? data.features : []);
            }
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            log.error('useHazardEvents fetch failed', { error: String(err), hazardType });
            if (!navigator.onLine) {
                setIsOfflineError(true);
                setError('You appear to be offline.');
            } else {
                setIsOfflineError(false);
                setError('Failed to connect to the hazard data source.');
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            hasLoadedOnceRef.current = true;
        }
    }, [hazardType, lat, lng, range, hours, limit]);

    useEffect(() => {
        hasLoadedOnceRef.current = false;
        fetchHazards();
        return () => abortRef.current?.abort();
    }, [fetchHazards]);

    useEffect(() => {
        if (isOnline && isOfflineError) fetchHazards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            if (document.hidden) return;
            fetchHazards();
        }, refreshIntervalMs);

        const onVisibilityChange = () => {
            if (!document.hidden) fetchHazards();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [autoRefresh, refreshIntervalMs, fetchHazards]);

    return { hazards, loading, isRefreshing, error, isOfflineError, lastUpdated, refetch: fetchHazards };
};
