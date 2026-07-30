"use client";
import { QuakeList } from '@/components/QuakeList';
import { useEarthquakes } from '@/hooks/useEarthquakes';

// Chromeless, compact feed meant to be <iframe>'d into a third-party page
// (audit 4.3) -- see the snippet on /about. No Navbar (see Navbar.tsx),
// no filters, just the live list plus a small credit link back.
export default function EmbedPage() {
    const { quakes, loading, error } = useEarthquakes({
        source: 'both',
        hours: '24',
        limit: '15',
        autoRefresh: true,
        refreshIntervalMs: 30000,
    });

    return (
        <div className="mx-auto w-full max-w-md px-3 py-3">
            <QuakeList quakes={quakes} loading={loading} error={error} visibleCount={8} />
            <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-[11px] text-foreground-subtle hover:text-accent"
            >
                Seismic Monitor
            </a>
        </div>
    );
}
