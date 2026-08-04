"use client";
import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, Popup, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouter } from 'next/navigation';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';
import type { NormalizedEvent } from '@/lib/hazardModel';

// Same keyless vector basemap and worker-path fix as before: maplibre resolves
// its worker relative to its own bundle URL, which under Turbopack is a
// content-hashed chunk, so the computed path 404s and the map silently renders
// blank. See scripts/copy-maplibre-worker.mjs for the static copy.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
if (typeof window !== 'undefined') {
    setWorkerUrl('/maplibre-gl-worker.mjs');
}

// Literal hex, not CSS custom properties: maplibre paints to a canvas and never
// resolves them.
const SEVERITY_COLOR = { critical: '#ff3b21', warning: '#ff8c1a', stable: '#ffc93c' };

// One colour per hazard type, for when the map is showing several at once and
// their severity numbers are not comparable (you cannot shade megawatts and
// knots on one scale).
export const HAZARD_COLOR: Record<string, string> = {
    earthquake: '#ff8c1a',
    wildfire: '#ff3b21',
    volcano: '#ff5c8a',
    landslide: '#b98b4a',
    cyclone: '#4aa3ff',
    tsunami: '#39d0d8',
};

/** Neutral tone for an event with no reported severity -- borrowing the low
 * band would claim a measurement we do not have. */
const UNMEASURED_COLOR = '#96601a';

interface EventMapProps {
    events: NormalizedEvent[];
    /** Slug when the map shows exactly one hazard type: markers are then scaled
     * and coloured by that type's own severity bands. With several types
     * selected there is no shared scale, so markers are coloured by type. */
    singleSlug?: string;
    className?: string;
}

/**
 * One map for every hazard type, driven by normalized events.
 *
 * Replaces the QuakeMap / HazardMap pair, which had diverged: the earthquake
 * map sized and coloured markers on the Richter scale and linked them to event
 * detail pages, while the generic one used a flat 10/50 threshold for every
 * metric and its markers were not clickable at all.
 */
export function EventMap({ events, singleSlug, className = '' }: EventMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const hasFitRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new MapLibreMap({
            container: containerRef.current,
            style: MAP_STYLE,
            center: [0, 20],
            zoom: 1.4,
            attributionControl: { compact: true },
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // Created once; markers sync separately below.
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const metric = singleSlug ? HAZARD_CONFIG[singleSlug as keyof typeof HAZARD_CONFIG]?.severity : undefined;

        const colorFor = (event: NormalizedEvent) => {
            if (event.severity === null) return UNMEASURED_COLOR;
            if (metric) {
                if (event.severity >= metric.bands.critical) return SEVERITY_COLOR.critical;
                if (event.severity >= metric.bands.warning) return SEVERITY_COLOR.warning;
                return SEVERITY_COLOR.stable;
            }
            return HAZARD_COLOR[event.hazardType] ?? UNMEASURED_COLOR;
        };

        // Sized against this hazard's own critical threshold, so a 200 MW fire
        // and an M6 quake both read as "large for their kind" rather than the
        // fire dwarfing everything because its numbers are bigger.
        const sizeFor = (event: NormalizedEvent) => {
            if (event.severity === null || !metric) return 11;
            const ratio = Math.min(Math.max(event.severity / metric.bands.critical, 0), 1.6);
            return 9 + ratio * 13;
        };

        const syncMarkers = () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];

            for (const event of events) {
                const config = HAZARD_CONFIG[event.hazardType as keyof typeof HAZARD_CONFIG];
                const severityText = event.severity !== null && config?.severity
                    ? config.severity.format(event.severity)
                    : null;

                const el = document.createElement('button');
                el.setAttribute('aria-label', severityText ? `${event.place}, ${severityText}` : event.place);
                const size = sizeFor(event);
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;
                el.style.borderRadius = '50%';
                el.style.background = colorFor(event);
                el.style.border = '2px solid white';
                el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
                el.style.cursor = 'pointer';

                const marker = new Marker({ element: el })
                    .setLngLat([event.lng, event.lat])
                    .setPopup(new Popup({ offset: 12 }).setText(
                        severityText ? `${severityText} — ${event.place}` : event.place
                    ))
                    .addTo(map);

                el.addEventListener('click', () => {
                    router.push(`/quake/${encodeURIComponent(event.id)}`);
                });

                markersRef.current.push(marker);
            }

            // Fit to wherever the events actually are, once. Skipped on
            // refreshes so it doesn't yank the view out from under someone who
            // has panned.
            if (!hasFitRef.current && events.length > 0) {
                hasFitRef.current = true;
                if (events.length === 1) {
                    map.jumpTo({ center: [events[0].lng, events[0].lat], zoom: 6 });
                } else {
                    const bounds = events.reduce(
                        (b, e) => b.extend([e.lng, e.lat]),
                        new LngLatBounds([events[0].lng, events[0].lat], [events[0].lng, events[0].lat])
                    );
                    map.fitBounds(bounds, { padding: 48, maxZoom: 6, duration: 0 });
                }
            }
        };

        if (map.isStyleLoaded()) syncMarkers();
        else map.once('load', syncMarkers);

        return () => {
            // Drop the pending listener too: if this effect re-runs before the
            // style loads, an un-removed handler fires later against a stale
            // `events` closure.
            map.off('load', syncMarkers);
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
        };
    }, [events, router, singleSlug]);

    return <div ref={containerRef} className={`w-full overflow-hidden rounded-lg border border-border ${className}`} />;
}
