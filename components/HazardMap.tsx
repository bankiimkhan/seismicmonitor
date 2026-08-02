"use client";
import { useEffect, useMemo, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, Popup, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CoverageNotice } from '@/components/CoverageNotice';
import { useHazardEvents } from '@/hooks/useHazardEvents';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';

// Same keyless vector basemap + worker-path fix as components/QuakeMap.tsx
// (see that file's comment for why the worker needs a static path under
// Turbopack) -- duplicated rather than imported since the two components
// share no other logic.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
if (typeof window !== 'undefined') {
    setWorkerUrl('/maplibre-gl-worker.mjs');
}

interface MapPoint {
    id: string;
    lat: number;
    lng: number;
    mag: number | null;
    place: string;
    url: string;
}

interface HazardMapProps {
    hazardSlug: HazardSlug;
    className?: string;
}

/** Generic point map for every non-earthquake hazard type -- deliberately a
 * fork of QuakeMap's mounting boilerplate, not a generalization of it:
 * QuakeMap's severity color-by-magnitude scheme and click-through to
 * /quake/[id] are earthquake-specific (Richter-scale color bands, a detail
 * page that only exists for earthquakes). Here, magnitude may be `null`
 * (volcano/landslide/tsunami), markers use one flat accent color sized by
 * value when present, and a click opens the source agency's own report URL
 * in a new tab instead of navigating internally. */
export function HazardMap({ hazardSlug, className = '' }: HazardMapProps) {
    const config = HAZARD_CONFIG[hazardSlug];
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const hasFitRef = useRef(false);

    const { hazards, loading, error } = useHazardEvents(config.hazardType, {
        hours: String(config.watchHours),
        limit: '300',
        autoRefresh: true,
        refreshIntervalMs: 600_000,
    });

    // Memoized on `hazards` because it's the marker-sync effect's dependency:
    // rebuilt inline it was a new array on every render, so every unrelated
    // re-render tore down and recreated all (up to 300) markers, closing any
    // open popup and re-registering another `once('load')` handler.
    const points: MapPoint[] = useMemo(
        () =>
            hazards
                .filter((h) => h.geometry?.coordinates)
                .map((h) => ({
                    id: h.id,
                    lat: h.geometry!.coordinates[1],
                    lng: h.geometry!.coordinates[0],
                    mag: h.properties.mag,
                    place: h.properties.place,
                    url: h.properties.url,
                })),
        [hazards]
    );

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const initialCenter = points[0] ?? { lat: 23.7, lng: 90.4 };
        const map = new MapLibreMap({
            container: containerRef.current,
            style: MAP_STYLE,
            center: [initialCenter.lng, initialCenter.lat],
            zoom: points.length > 1 ? 2 : 4,
            attributionControl: { compact: true },
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // Map instance is created once; points are synced separately below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const syncMarkers = () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];

            for (const p of points) {
                const el = document.createElement('button');
                el.setAttribute(
                    'aria-label',
                    p.mag !== null ? `${p.place}, ${config.valueLabel} ${p.mag.toFixed(1)}` : p.place
                );
                const size = p.mag !== null ? Math.min(28, 10 + Math.max(0, p.mag) * 1.5) : 10;
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;
                el.style.borderRadius = '50%';
                el.style.background = 'var(--accent)';
                el.style.border = '2px solid white';
                el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
                el.style.cursor = p.url ? 'pointer' : 'default';

                const popupText = p.mag !== null ? `${p.mag.toFixed(1)} -- ${p.place}` : p.place;
                const marker = new Marker({ element: el })
                    .setLngLat([p.lng, p.lat])
                    .setPopup(new Popup({ offset: 12 }).setText(popupText))
                    .addTo(map);

                if (p.url) {
                    el.addEventListener('click', () => window.open(p.url, '_blank', 'noopener,noreferrer'));
                }

                markersRef.current.push(marker);
            }

            // Fit once, the first time points arrive -- same "don't yank the
            // view on refresh" reasoning as QuakeMap.
            if (!hasFitRef.current && points.length > 0) {
                hasFitRef.current = true;
                if (points.length === 1) {
                    map.jumpTo({ center: [points[0].lng, points[0].lat], zoom: 5 });
                } else {
                    const bounds = points.reduce(
                        (b, p) => b.extend([p.lng, p.lat]),
                        new LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
                    );
                    map.fitBounds(bounds, { padding: 48, maxZoom: 5, duration: 0 });
                }
            }
        };

        if (map.isStyleLoaded()) syncMarkers();
        else map.once('load', syncMarkers);

        return () => {
            // Drop the pending listener too: when this effect re-runs before
            // the style has loaded, an un-removed handler still fires later
            // and re-syncs from its own stale `points` closure.
            map.off('load', syncMarkers);
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points]);

    if (error && points.length === 0) {
        return (
            <div className="space-y-4">
                <CoverageNotice notice={config.coverageNotice} />
                <div className="rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Local, Global and Trends all carry this; Map was the one tab that
                didn't, so the landslide map -- which is empty because nothing
                publishes to it, not because the world is quiet -- was showing a
                blank basemap with no explanation anywhere on the page. */}
            <CoverageNotice notice={config.coverageNotice} />

            <div className="relative">
                <div ref={containerRef} className={`w-full overflow-hidden rounded-lg border border-border ${className}`} />

                {loading && points.length === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/60 backdrop-blur-sm">
                        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground-muted shadow-md">
                            <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                            Loading…
                        </div>
                    </div>
                )}
                {!loading && points.length === 0 && !error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/60 p-6 text-center text-sm text-foreground-muted backdrop-blur-sm">
                        {config.emptyTitle}
                    </div>
                )}
            </div>
        </div>
    );
}
