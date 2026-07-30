"use client";
import { useCallback, useEffect, useState } from 'react';
import { useLocalStorageState } from './useLocalStorageState';

export type LocationSource = 'geo' | 'manual';
export interface ResolvedLocation {
    lat: number;
    lng: number;
    label?: string;
    source: LocationSource;
}

export type LocationStatus = 'checking' | 'prompting' | 'locating' | 'located' | 'denied';

// Centralizes the location-resolution flow shared by the Overview and Local
// pages (previously duplicated, silently-firing `getCurrentPosition` in
// both). Behavior:
//  - A location entered manually before, or already resolved, is reused
//    immediately -- no repeat prompting.
//  - When the Permissions API knows geolocation is already granted or
//    denied, we act on that directly (silently locate, or go straight to
//    manual entry) instead of re-asking.
//  - Only when permission state is genuinely unknown do we surface an
//    explanatory prompt *before* the browser's own permission dialog fires
//    (audit 3.2) -- and offer manual entry (audit 2.1) as an equal option,
//    not a dead end.
export function useLocation() {
    // `saved` IS the resolved location, not a seed for a second copy of it:
    // useLocalStorageState returns `initial` (null) on the first render and
    // only reconciles from localStorage in an effect, so a
    // `useState(saved)` alongside it would capture that first-render null
    // and never see the stored value -- a returning visitor's saved/manual
    // location was silently dropped and they got re-prompted every visit.
    const [saved, setSaved] = useLocalStorageState<ResolvedLocation | null>('last_location', null);
    const [status, setStatus] = useState<LocationStatus>('checking');
    const location = saved;

    const requestGeolocation = useCallback(() => {
        if (!navigator.geolocation) {
            setStatus('denied');
            return;
        }
        setStatus('locating');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc: ResolvedLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    source: 'geo',
                };
                setSaved(loc);
                setStatus('located');
            },
            () => setStatus('denied'),
            { timeout: 10000 }
        );
    }, [setSaved]);

    const setManualLocation = useCallback((loc: { lat: number; lng: number; label: string }) => {
        const resolved: ResolvedLocation = { ...loc, source: 'manual' };
        setSaved(resolved);
        setStatus('located');
    }, [setSaved]);

    const changeLocation = useCallback(() => {
        setStatus('prompting');
    }, []);

    // Depends on `saved` rather than running once on mount: on the first
    // render it's still null (localStorage hasn't been read yet), so a
    // mount-only effect would always start the permission dance even for a
    // visitor who already has a location stored. The re-run after hydration
    // is what settles a returning visitor straight to 'located'; the first
    // run's in-flight permission query is neutralized by `cancelled`.
    useEffect(() => {
        if (saved) {
            // Unconditional: the only ways this effect runs with a truthy
            // `saved` are hydration finding a stored location, or one having
            // just been saved. `changeLocation()`'s deliberate 'prompting'
            // leaves `saved` untouched, so it never re-triggers this and
            // can't be stomped here.
            setStatus('located');
            return;
        }
        if (!navigator.permissions?.query) {
            setStatus('prompting');
            return;
        }
        let cancelled = false;
        navigator.permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((result) => {
                if (cancelled) return;
                if (result.state === 'granted') requestGeolocation();
                else if (result.state === 'denied') setStatus('denied');
                else setStatus('prompting');
            })
            .catch(() => {
                if (!cancelled) setStatus('prompting');
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saved]);

    return { status, location, requestGeolocation, setManualLocation, changeLocation };
}
