"use client";
import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { QuakeMap } from '@/components/QuakeMap';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useT } from '@/lib/i18n/LocaleProvider';

const LEGEND = [
  { label: 'M < 5.0', color: 'bg-success' },
  { label: 'M 5.0–5.9', color: 'bg-warning' },
  { label: 'M ≥ 6.0', color: 'bg-danger' },
];

export default function MapPage() {
  const { t } = useT();
  const { quakes, loading, error } = useEarthquakes({
    source: 'both',
    hours: '168',
    limit: '200',
    minMag: '3.0',
  });

  // Memoized: QuakeMap's marker-sync effect keys on this array's identity, so
  // rebuilding it every render tore down and recreated all ~200 markers and
  // their popups each time.
  const mapQuakes = useMemo(
    () => quakes
      .filter((q) => q.geometry?.coordinates)
      .map((q) => ({
        id: q.id,
        lat: q.geometry.coordinates[1],
        lng: q.geometry.coordinates[0],
        depth: q.geometry.coordinates[2],
        mag: q.properties.mag,
        place: q.properties.place,
        time: q.properties.time,
        source: q.properties.source,
        url: q.properties.url,
      })),
    [quakes]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
      {error && mapQuakes.length === 0 ? (
        <Card>{error}</Card>
      ) : (
        <div className="relative">
          <QuakeMap quakes={mapQuakes} className="h-[70vh] min-h-[420px] shadow-sm" />

          {/* Legend + what's plotted, in one strip -- the event count used to
              live up in the page header, a screen away from the markers it
              counts. */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs text-foreground-muted shadow-md backdrop-blur sm:right-auto">
            <span className="font-medium text-foreground">
              {mapQuakes.length} events · {t('filters.last7')}
            </span>
            <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>

          {loading && mapQuakes.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground-muted shadow-md">
                <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                Loading seismic data…
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
