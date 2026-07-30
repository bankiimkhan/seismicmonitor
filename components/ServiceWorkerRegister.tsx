"use client";
import { useEffect } from 'react';

async function unregisterAll() {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister().catch(() => {})));
    if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
}

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        // A service worker must never sit in front of a dev build. `next dev`
        // recompiles on every edit, and each recompile changes the
        // content-hashed /_next/static chunk URLs and publishes a new HMR
        // hot-update manifest. Any worker that answers those from cache hands
        // the HMR client artefacts that no longer match the running build,
        // and its recovery path is a full location.reload() -- which reloads
        // into the same cached artefacts. That is the reload loop.
        //
        // Tearing registrations *and* caches down (rather than merely not
        // registering) is what lets a browser already stuck in that loop heal
        // on its next load, since the previously-installed worker keeps
        // controlling the page until something unregisters it.
        if (process.env.NODE_ENV !== 'production') {
            unregisterAll().catch(() => {});
            return;
        }

        // Self-heal visitors still carrying a pre-redesign registration
        // (e.g. the old OneSignalSDKWorker.js, now deleted from public/) --
        // a stale worker controlling the page can keep serving/interfering
        // with the current app's chunks and trigger reload loops. Drop
        // anything that isn't our current worker before registering it.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
                const scriptUrl = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? registration.waiting?.scriptURL;
                if (scriptUrl && !scriptUrl.endsWith('/sw.js')) {
                    registration.unregister().catch(() => {});
                }
            }
        }).catch(() => {});

        // Registered client-side only, after mount -- keeps SW registration
        // out of the critical render path.
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // offline shell is a progressive enhancement, not a hard requirement
        });
    }, []);

    return null;
}
