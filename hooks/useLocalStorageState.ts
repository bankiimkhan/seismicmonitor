"use client";
import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from '@/lib/safeStorage';

// Generic localStorage-persisted state. Starts from `initial` on every
// render (server and first client paint agree) and reconciles from
// localStorage in an effect, to avoid hydration mismatches -- the same
// pattern already used for theme in components/ThemeToggle.tsx.
export function useLocalStorageState<T>(key: string, initial: T) {
    const [value, setValue] = useState<T>(initial);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const stored = readLocal(key);
            // One-time reconciliation from the SSR-safe `initial` default to
            // the persisted value -- can't be known at server-render time.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (stored !== null) setValue(JSON.parse(stored));
        } catch {
            // ignore malformed JSON
        }
        setHydrated(true);
    }, [key]);

    useEffect(() => {
        if (!hydrated) return;
        writeLocal(key, JSON.stringify(value));
    }, [key, value, hydrated]);

    return [value, setValue] as const;
}
