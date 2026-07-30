"use client";
import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, Popup, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouter } from 'next/navigation';
import { getSeverity } from './ui/Badge';
import { stashQuake } from '@/lib/quakeCache';

// Keyless vector basemap -- https://openfreemap.org, no account/API key.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// maplibre-gl resolves its worker script at runtime relative to its own
// bundle's `import.meta.url`. Under Turbopack that bundle lives at a
// content-hashed chunk URL, so the literal "maplibre-gl-worker.mjs" path
// maplibre computes 404s -- the worker still "constructs" but then fails
// silently (an opaque error event, zero tile requests, blank map). Point
// it at a static copy instead (see scripts/copy-maplibre-worker.mjs).
if (typeof window !== 'undefined') {
    setWorkerUrl('/maplibre-gl-worker.mjs');
}

const SEVERITY_COLOR: Record<string, string> = {
    critical: '#dc2626',
    warning: '#d97706',
    stable: '#16a34a',
};
// Neutral grey for an event with no reported magnitude -- borrowing 'stable'
// green would claim a measurement we don't have (same "null isn't 0"
// convention as /api/hazards and /api/trends).
const UNKNOWN_MAG_COLOR = '#71717a';

export interface MapQuake {
    id: string;
    lat: number;
    lng: number;
    mag: number | null;
    place: string;
    source?: string;
    time?: number;
    depth?: number;
    url?: string;
}

interface QuakeMapProps {
    quakes: MapQuake[];
    center?: { lat: number; lng: number };
    zoom?: number;
    interactive?: boolean;
    className?: string;
}

export function QuakeMap({ quakes, center, zoom, interactive = true, className = '' }: QuakeMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const hasFitRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const initialCenter = center ?? (quakes[0] ? { lat: quakes[0].lat, lng: quakes[0].lng } : { lat: 23.7, lng: 90.4 });

        const map = new MapLibreMap({
            container: containerRef.current,
            style: MAP_STYLE,
            center: [initialCenter.lng, initialCenter.lat],
            zoom: zoom ?? (quakes.length > 1 ? 4 : 7),
            interactive,
            attributionControl: { compact: true },
        });
        if (interactive) map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // Map instance is created once; quake markers are synced separately below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const syncMarkers = () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];

            for (const q of quakes) {
                const el = document.createElement('button');
                el.setAttribute(
                    'aria-label',
                    q.mag !== null ? `${q.place}, magnitude ${q.mag.toFixed(1)}` : `${q.place}, magnitude unknown`
                );
                const size = 10 + Math.max(0, q.mag ?? 0) * 3;
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;
                el.style.borderRadius = '50%';
                el.style.background = q.mag !== null ? SEVERITY_COLOR[getSeverity(q.mag)] : UNKNOWN_MAG_COLOR;
                el.style.border = '2px solid white';
                el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
                el.style.cursor = 'pointer';

                const marker = new Marker({ element: el })
                    .setLngLat([q.lng, q.lat])
                    .setPopup(new Popup({ offset: 12 }).setText(q.mag !== null ? `M${q.mag.toFixed(1)} -- ${q.place}` : q.place))
                    .addTo(map);

                if (interactive) {
                    el.addEventListener('click', () => {
                        if (q.time !== undefined) {
                            stashQuake({
                                id: q.id, source: q.source, mag: q.mag, place: q.place,
                                time: q.time, lat: q.lat, lng: q.lng, depth: q.depth, url: q.url,
                            });
                        }
                        router.push(`/quake/${encodeURIComponent(q.id)}`);
                    });
                }

                markersRef.current.push(marker);
            }

            // Fit the viewport to wherever the quakes actually are, once,
            // the first time they arrive -- without this the map stays at
            // its initial mount-time center/zoom (picked before any data
            // had loaded) and markers can end up entirely off-screen.
            // Skipped when an explicit `center` was given (single-pin
            // detail-page usage, which should stay centered on that pin)
            // and on subsequent live-refreshes, so it doesn't yank the
            // view out from under someone who's panned around.
            if (!center && !hasFitRef.current && quakes.length > 0) {
                hasFitRef.current = true;
                if (quakes.length === 1) {
                    map.jumpTo({ center: [quakes[0].lng, quakes[0].lat], zoom: 6 });
                } else {
                    const bounds = quakes.reduce(
                        (b, q) => b.extend([q.lng, q.lat]),
                        new LngLatBounds([quakes[0].lng, quakes[0].lat], [quakes[0].lng, quakes[0].lat])
                    );
                    map.fitBounds(bounds, { padding: 48, maxZoom: 6, duration: 0 });
                }
            }
        };

        if (map.isStyleLoaded()) syncMarkers();
        else map.once('load', syncMarkers);

        return () => {
            // Drop the pending listener too: when this effect re-runs before
            // the style has loaded, an un-removed handler still fires later
            // and re-syncs from its own stale `quakes` closure.
            map.off('load', syncMarkers);
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
        };
    }, [quakes, interactive, router, center]);

    return <div ref={containerRef} className={`w-full overflow-hidden rounded-lg border border-border ${className}`} />;
}
