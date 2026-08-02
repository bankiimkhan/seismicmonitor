"use client";
import React, { useMemo, useState } from 'react';
import { Tag } from './ui/Badge';
import { ChevronDownIcon, ArrowUpIcon } from './ui/icons';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { Skeleton } from './ui/Skeleton';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import type { HazardFeature } from '@/hooks/useHazardEvents';

type SortKey = 'time' | 'value';

// Thresholds aren't calibrated the way earthquake magnitude is
// (components/ui/Badge.tsx's getSeverity uses Richter-scale breakpoints
// that mean nothing for FRP/wind-speed/etc) -- this is a simple
// low/medium/high split usable as a generic "how big is this number" band
// across whichever hazard type is showing a real value.
function valueColorClass(value: number): string {
    if (value >= 50) return 'text-danger';
    if (value >= 10) return 'text-warning';
    return 'text-success';
}

interface HazardTableProps {
    hazards: HazardFeature[];
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
    /** Header label + unit for the numeric value column, e.g. "FRP (MW)" or
     * "Wind Speed (kts)" -- pass "—" for hazard types with no such metric
     * (volcano/landslide), where every row's value is null anyway. */
    valueLabel: string;
    emptyTitle?: string;
    emptyDescription?: string;
    errorTitle?: string;
    className?: string;
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${active ? 'text-foreground' : 'text-foreground-muted'}`}
        >
            {label}
            {active ? (
                <ArrowUpIcon size={11} className={`transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`} />
            ) : (
                <ChevronDownIcon size={11} className="opacity-0 group-hover:opacity-40" />
            )}
        </button>
    );
}

/** Shared first-cut list view for every non-earthquake hazard type (wildfire/
 * volcano/severe_weather/landslide): individual source records, not
 * clustered "incidents" (see lib/firms.ts, lib/eonet.ts). One responsive
 * table (horizontal scroll on narrow screens) rather than a separate
 * desktop/mobile component pair like QuakeTable/QuakeList -- there's no
 * per-item detail page or felt-report wiring to justify that split yet. */
export const HazardTable: React.FC<HazardTableProps> = ({
    hazards, loading, error, onRetry, valueLabel,
    emptyTitle = 'No events found', emptyDescription = 'Nothing reported in this window.',
    errorTitle = "Couldn't load hazard data",
    className = '',
}) => {
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });

    const sorted = useMemo(() => {
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...hazards].sort((a, b) => {
            if (sort.key === 'value') return ((a.properties.mag ?? 0) - (b.properties.mag ?? 0)) * factor;
            return (a.properties.time - b.properties.time) * factor;
        });
    }, [hazards, sort]);

    const toggleSort = (key: SortKey) => {
        setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    };

    if (loading && hazards.length === 0) {
        return (
            <div className={`space-y-2 rounded-lg border border-border bg-surface p-4 ${className}`}>
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }

    if (error && hazards.length === 0) return <ErrorState title={errorTitle} message={error} onRetry={onRetry} />;
    if (hazards.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

    return (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-md backdrop-blur-xl ${className}`}>
            <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                        <tr className="sticky top-0 z-10 border-b border-border/90 bg-[#090b0e]/95 backdrop-blur-xl">
                            <th className="group px-4 py-3 text-left"><SortHeader label={valueLabel} active={sort.key === 'value'} dir={sort.dir} onClick={() => toggleSort('value')} /></th>
                            <th className="px-2 py-3 text-left"><span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground-muted">Location</span></th>
                            <th className="px-2 py-3 text-left"><span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground-muted">Confidence</span></th>
                            <th className="group px-2 py-3 text-right"><SortHeader label="Reported" active={sort.key === 'time'} dir={sort.dir} onClick={() => toggleSort('time')} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((hazard) => {
                            // FIRMS wildfire hotspots have no place name, only
                            // coordinates; EONET-sourced rows have a real
                            // descriptive title (lib/eonet.ts uses the
                            // event's own title). Fall back to coordinates
                            // only when place is genuinely unknown.
                            const [lng, lat] = hazard.geometry?.coordinates ?? [];
                            const hasCoords = lat !== undefined && lng !== undefined;
                            const location = hazard.properties.place !== 'Unknown'
                                ? hazard.properties.place
                                : hasCoords ? `${lat.toFixed(3)}, ${lng.toFixed(3)}` : 'Unknown';
                            return (
                                <tr key={hazard.id} className="border-b border-border/60 last:border-b-0 hover:bg-surface-hover">
                                    <td className="px-4 py-3">
                                        {hazard.properties.mag !== null ? (
                                            <span className={`font-mono text-base font-bold ${valueColorClass(hazard.properties.mag)}`}>
                                                {hazard.properties.mag.toFixed(1)}
                                            </span>
                                        ) : (
                                            <span className="font-mono text-base text-foreground-subtle">—</span>
                                        )}
                                    </td>
                                    <td className="max-w-xs truncate px-2 py-3 text-foreground" title={location}>
                                        {location}
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-wrap items-center gap-1">
                                            {hazard.properties.alertLevel && <Tag>{hazard.properties.alertLevel}</Tag>}
                                            {hazard.properties.confidence && <Tag>{hazard.properties.confidence}</Tag>}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3 text-right font-mono text-xs text-foreground-muted">
                                        {formatRelativeTime(hazard.properties.time)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
