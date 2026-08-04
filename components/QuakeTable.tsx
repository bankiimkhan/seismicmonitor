"use client";
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSeverity, Tag, type Severity } from './ui/Badge';
import { ChevronDownIcon, ArrowUpIcon } from './ui/icons';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { Skeleton } from './ui/Skeleton';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { distanceKm, formatDistanceKm, formatDepthKm } from '@/lib/geo';
import { stashQuake } from '@/lib/quakeCache';
import { useT } from '@/lib/i18n/LocaleProvider';
import type { QuakeFeature } from './QuakeList';

type SortKey = 'time' | 'mag' | 'place' | 'distance';

const SEVERITY_TEXT: Record<Severity, string> = {
    stable: 'text-success',
    warning: 'text-warning',
    critical: 'text-danger',
};

interface QuakeTableProps {
    quakes: QuakeFeature[];
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
    userLoc?: { lat: number; lng: number } | null;
    /** Overrides the generic "try widening the search" empty state for callers
     * that know why the list is empty -- Local's felt-distance filter can empty
     * it while events genuinely did occur nearby, and the default copy would
     * send you to widen filters that were never the reason. */
    emptyTitle?: string;
    emptyDescription?: string;
    className?: string;
}

function SortHeader({ label, active, dir, onClick, align = 'left' }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${active ? 'text-foreground' : 'text-foreground-muted'} ${align === 'right' ? 'flex-row-reverse' : ''}`}
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

/** Desktop, sortable, sticky-header presentation for a quake list. Mobile falls back to QuakeList's cards. */
export const QuakeTable: React.FC<QuakeTableProps> = ({ quakes, loading, error, onRetry, userLoc, emptyTitle, emptyDescription, className = '' }) => {
    const { t } = useT();
    const router = useRouter();
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'time', dir: 'desc' });

    const rows = useMemo(() => {
        return quakes.map((q) => {
            const [lng, lat, depth] = q.geometry?.coordinates ?? [];
            const hasCoords = lat !== undefined && lng !== undefined;
            const distance = userLoc && hasCoords ? distanceKm(userLoc, { lat, lng }) : null;
            return { quake: q, lat, lng, depth, distance };
        });
    }, [quakes, userLoc]);

    const sorted = useMemo(() => {
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            switch (sort.key) {
                // Unmeasured events sort as -Infinity so they cluster at the
                // weak end rather than scattering on NaN comparisons.
                case 'mag': return ((a.quake.properties.mag ?? -Infinity) - (b.quake.properties.mag ?? -Infinity)) * factor;
                case 'place': return a.quake.properties.place.localeCompare(b.quake.properties.place) * factor;
                case 'distance': return ((a.distance ?? Infinity) - (b.distance ?? Infinity)) * factor;
                case 'time':
                default: return (a.quake.properties.time - b.quake.properties.time) * factor;
            }
        });
    }, [rows, sort]);

    const toggleSort = (key: SortKey) => {
        setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'place' ? 'asc' : 'desc' }));
    };

    if (loading && quakes.length === 0) {
        return (
            <div className={`space-y-2 rounded-lg border border-border bg-surface p-4 ${className}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        );
    }

    if (error && quakes.length === 0) return <ErrorState message={error} onRetry={onRetry} />;
    if (quakes.length === 0) {
        return <EmptyState title={emptyTitle ?? t('quake.noneFound')} description={emptyDescription ?? t('quake.noneFoundDesc')} />;
    }

    const hasDistance = !!userLoc;

    const goTo = (row: (typeof rows)[number]) => {
        const { quake, lat, lng, depth } = row;
        if (lat !== undefined && lng !== undefined) {
            stashQuake({
                id: quake.id, source: quake.properties.source, mag: quake.properties.mag,
                place: quake.properties.place, time: quake.properties.time, lat, lng, depth, url: quake.properties.url,
            });
        }
        router.push(`/quake/${encodeURIComponent(quake.id)}`);
    };

    return (
        <div className={`overflow-hidden rounded-2xl border border-border/80 bg-surface/90 shadow-md backdrop-blur-xl ${className}`}>
            <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="sticky top-0 z-10 border-b-2 border-accent/50 bg-background/95 backdrop-blur-xl">
                            <th className="group px-4 py-3 text-left"><SortHeader label={t('quake.magnitude')} active={sort.key === 'mag'} dir={sort.dir} onClick={() => toggleSort('mag')} /></th>
                            <th className="group px-2 py-3 text-left"><SortHeader label="Location" active={sort.key === 'place'} dir={sort.dir} onClick={() => toggleSort('place')} /></th>
                            <th className="hidden px-2 py-3 text-left md:table-cell"><span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground-muted">{t('quake.depth')}</span></th>
                            {hasDistance && (
                                <th className="group hidden px-2 py-3 text-left lg:table-cell"><SortHeader label="Distance" active={sort.key === 'distance'} dir={sort.dir} onClick={() => toggleSort('distance')} /></th>
                            )}
                            <th className="group px-2 py-3 text-right"><SortHeader align="right" label={t('quake.time')} active={sort.key === 'time'} dir={sort.dir} onClick={() => toggleSort('time')} /></th>
                            <th className="w-8 px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row) => {
                            const { quake, depth, distance } = row;
                            const severity = quake.properties.mag !== null ? getSeverity(quake.properties.mag) : null;
                            return (
                                <tr
                                    key={quake.id}
                                    tabIndex={0}
                                    role="link"
                                    onClick={() => goTo(row)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') goTo(row); }}
                                    className="cursor-pointer border-b border-border/60 outline-none transition-colors last:border-b-0 hover:bg-surface-hover focus-visible:bg-surface-hover"
                                >
                                    <td className="px-4 py-3">
                                        <span className={`font-mono text-base font-bold ${severity ? SEVERITY_TEXT[severity] : 'text-foreground-subtle'}`}>
                                            {quake.properties.mag !== null ? quake.properties.mag.toFixed(1) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="max-w-xs truncate font-medium text-foreground">{quake.properties.place}</div>
                                        {quake.properties.source && <Tag className="mt-1">{quake.properties.source}</Tag>}
                                    </td>
                                    <td className="hidden px-2 py-3 text-foreground-muted md:table-cell">{depth !== undefined ? formatDepthKm(depth) : '—'}</td>
                                    {hasDistance && (
                                        <td className="hidden px-2 py-3 text-foreground-muted lg:table-cell">{distance !== null && distance !== undefined ? formatDistanceKm(distance) : '—'}</td>
                                    )}
                                    <td className="px-2 py-3 text-right font-mono text-xs text-foreground-muted">{formatRelativeTime(quake.properties.time)}</td>
                                    <td className="px-4 py-3 text-right text-foreground-subtle">→</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
