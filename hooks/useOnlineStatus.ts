"use client";
import { useEffect, useState } from 'react';

// Starts `true` so SSR/first paint never claims the user is offline (browser
// APIs aren't available on the server); corrected immediately on mount.
export function useOnlineStatus(): boolean {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        // One-time correction from the SSR-safe `true` default to the
        // browser's real state -- can't be known at server-render time.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOnline(navigator.onLine);
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
}
