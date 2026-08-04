"use client";
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tag } from './ui/Badge';
import { ChevronDownIcon, ArrowUpIcon } from './ui/icons';
import { Skeleton } from './ui/Skeleton';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { distanceKm, formatDistanceKm, formatDepthKm } from '@/lib/geo';
import { REGION_BY_ID } from '@/lib/regions';
import type { HazardConfig } from '@/lib/hazardConfig';
import type { NormalizedEvent } from '@/lib/hazardModel';

type SortKey = 'time' | 'severity' | 'place' | 'distance';

interface EventTableProps {
    events: NormalizedEvent[];
    config: HazardConfig;
    loading?: boolean;
    /** Enables the distance column; only meaningful for a point-scoped view. */
    userLoc?: { lat: number; lng: number } | null;
    /** Shows which region each event fell in -- useful on Global, redundant on
     * a view already scoped to one region. */
    showRegion?: boolean;
    className?: string;
}

/**
 * One table for every hazard type, driven by that type's own SeverityMetric.
 *
 * Replaces the QuakeTable / HazardTable split, where the earthquake table
 * hardcoded "Magnitude", one decimal place and Richter colour bands, and the
 * generic one applied a single low/medium/high split at 10/50 to FRP,
 * wind speed and everything else alike. Both are now read from
 * `config.severity`, so a wildfire is banded in MW and a cyclone in knots
 * without either borrowing the other's thresholds -- and a hazard type with no
 * severity metric simply has no severity column, rather than a column of
 * em dashes implying a measurement went missing.
 */
export function EventTable({
    events, config, loading = false, userLoc, showRegion = false, className = '',
}: EventTableProps) {
    const router = useRouter();
    const metric = config.severity;
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });

    const rows = useMemo(() => events.map((event) => ({
        event,
        distance: userLoc ? distanceKm(userLoc, { lat: event.lat, lng: event.lng }) : null,
    })), [events, userLoc]);

    const sorted = useMemo(() => {
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            switch (sort.key) {
                // Unmeasured events sort as -Infinity so they cluster at the
                // weak end rather than scattering on NaN comparisons.
                case 'severity':
                    return ((a.event.severity ?? -Infinity) - (b.event.severity ?? -Infinity)) * factor;
                case 'place':
                    return a.event.place.localeCompare(b.event.place) * factor;
                case 'distance':
                    return ((a.distance ?? Infinity) - (b.distance ?? Infinity)) * factor;
                case 'time':
                default:
                    return (a.event.time - b.event.time) * factor;
            }
        });
    }, [rows, sort]);

    const toggleSort = (key: SortKey) => {
        setSort((s) => (s.key === key
            ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: key === 'place' ? 'asc' : 'desc' }));
    };

    if (loading && events.length === 0) {
        return (
            <div className={`space-y-2 rounded-lg border border-border bg-surface p-4 ${className}`}>
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }

    const severityClass = (value: number | null) => {
        if (value === null || !metric) return 'text-foreground-subtle';
        if (value >= metric.bands.critical) return 'text-danger';
        if (value >= metric.bands.warning) return 'text-warning';
        return 'text-success';
    };

    const goTo = (event: NormalizedEvent) => {
        router.push(`/quake/${encodeURIComponent(event.id)}`);
    };

    return (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-md backdrop-blur-xl ${className}`}>
            <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="sticky top-0 z-10 border-b-2 border-accent/50 bg-background/95 backdrop-blur-xl">
                            {metric && (
                                <th className="group px-4 py-3 text-left">
                                    <SortHeader label={metric.label} active={sort.key === 'severity'} dir={sort.dir} onClick={() => toggleSort('severity')} />
                                </th>
                            )}
                            <th className="group px-2 py-3 text-left">
                                <SortHeader label="Location" active={sort.key === 'place'} dir={sort.dir} onClick={() => toggleSort('place')} />
                            </th>
                            {showRegion && (
                                <th className="hidden px-2 py-3 text-left lg:table-cell">
                                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted">Region</span>
                                </th>
                            )}
                            {config.slug === 'earthquake' && (
                                <th className="hidden px-2 py-3 text-left md:table-cell">
                                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground-muted">Depth</span>
                                </th>
                            )}
                            {userLoc && (
                                <th className="group hidden px-2 py-3 text-left lg:table-cell">
                                    <SortHeader label="Distance" active={sort.key === 'distance'} dir={sort.dir} onClick={() => toggleSort('distance')} />
                                </th>
                            )}
                            <th className="group px-2 py-3 text-right">
                                <SortHeader align="right" label="Time" active={sort.key === 'time'} dir={sort.dir} onClick={() => toggleSort('time')} />
                            </th>
                            <th className="w-8 px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(({ event, distance }) => (
                            <tr
                                key={event.id}
                                tabIndex={0}
                                role="link"
                                onClick={() => goTo(event)}
                                onKeyDown={(e) => { if (e.key === 'Enter') goTo(event); }}
                                className="cursor-pointer border-b border-border/60 outline-none transition-colors last:border-b-0 hover:bg-surface-hover focus-visible:bg-surface-hover"
                            >
                                {metric && (
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <span className={`font-mono text-base font-bold ${severityClass(event.severity)}`}>
                                            {event.severity !== null ? metric.format(event.severity) : '—'}
                                        </span>
                                    </td>
                                )}
                                <td className="px-2 py-3">
                                    <div className="max-w-xs truncate font-medium text-foreground">{event.place}</div>
                                    <div className="mt-1 flex items-center gap-1.5">
                                        {event.alertLevel && <Tag>{event.alertLevel}</Tag>}
                                        {event.country && (
                                            <span className="text-xs text-foreground-subtle">{event.country}</span>
                                        )}
                                    </div>
                                </td>
                                {showRegion && (
                                    <td className="hidden whitespace-nowrap px-2 py-3 text-foreground-muted lg:table-cell">
                                        {/* Named explicitly rather than left blank: "outside every
                                            tracked region" is information, and a blank cell reads
                                            as missing data. */}
                                        {event.regionId ? REGION_BY_ID[event.regionId]?.label ?? event.regionId : 'Outside regions'}
                                    </td>
                                )}
                                {config.slug === 'earthquake' && (
                                    <td className="hidden whitespace-nowrap px-2 py-3 text-foreground-muted md:table-cell">
                                        {event.depthKm !== null ? formatDepthKm(event.depthKm) : '—'}
                                    </td>
                                )}
                                {userLoc && (
                                    <td className="hidden whitespace-nowrap px-2 py-3 text-foreground-muted lg:table-cell">
                                        {distance !== null ? formatDistanceKm(distance) : '—'}
                                    </td>
                                )}
                                <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-xs text-foreground-muted">
                                    {formatRelativeTime(event.time)}
                                </td>
                                <td className="px-4 py-3 text-right text-foreground-subtle">→</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SortHeader({ label, active, dir, onClick, align = 'left' }: {
    label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right';
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${active ? 'text-foreground' : 'text-foreground-muted'} ${align === 'right' ? 'flex-row-reverse' : ''}`}
        >
            {label}
            {active
                ? <ArrowUpIcon size={11} className={`transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`} />
                : <ChevronDownIcon size={11} className="opacity-0 group-hover:opacity-40" />}
        </button>
    );
}
