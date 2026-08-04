import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from './ui/Card';
import { Tag, getSeverity, type Severity } from './ui/Badge';
import { QuakeCardSkeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { ShareButton } from './ShareButton';
import { ArrowUpRightIcon } from './ui/icons';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { distanceKm, formatDistanceKm, formatDepthKm } from '@/lib/geo';
import { stashQuake } from '@/lib/quakeCache';
import { useT } from '@/lib/i18n/LocaleProvider';

export interface QuakeFeature {
    id: string;
    properties: {
        // Nullable: /api/earthquakes passes USGS's GeoJSON through untouched,
        // and USGS reports `mag: null` for some events (see the matching note
        // in app/quake/[id]/page.tsx). Declaring it `number` didn't make it
        // one -- it just meant `.toFixed()` would throw and blank the feed.
        mag: number | null;
        place: string;
        time: number;
        url: string;
        source?: 'usgs' | 'ncs';
    };
    geometry?: {
        coordinates: [number, number, number];
    };
}

interface QuakeListProps {
    quakes: QuakeFeature[];
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
    visibleCount?: number;
    newIds?: Set<string>;
    userLoc?: { lat: number; lng: number } | null;
}

const SEVERITY_DOT: Record<Severity, string> = {
    stable: 'bg-success',
    warning: 'bg-warning',
    critical: 'bg-danger',
};

const SEVERITY_TEXT: Record<Severity, string> = {
    stable: 'text-success',
    warning: 'text-warning',
    critical: 'text-danger',
};

export const QuakeList: React.FC<QuakeListProps> = ({
    quakes, loading, error, onRetry, visibleCount = quakes.length, newIds, userLoc,
}) => {
    const { t } = useT();
    const [announcement, setAnnouncement] = useState('');
    const prevNewIds = useRef<Set<string>>(new Set());

    // Screen-reader announcement for newly-arrived live entries (audit 7.1)
    // -- parallels the visual animate-highlight-new treatment on the cards
    // themselves, which is otherwise invisible to assistive tech.
    useEffect(() => {
        if (!newIds || newIds.size === 0) return;
        const isNewSet = newIds !== prevNewIds.current;
        prevNewIds.current = newIds;
        if (!isNewSet) return;
        setAnnouncement(t('quake.newAnnouncement', { count: newIds.size, plural: newIds.size === 1 ? '' : 's' }));
    }, [newIds, t]);

    const liveRegion = (
        <div aria-live="polite" role="status" className="sr-only">
            {announcement}
        </div>
    );

    if (loading && quakes.length === 0) {
        return (
            <div className="space-y-3">
                {liveRegion}
                {Array.from({ length: 4 }).map((_, i) => (
                    <QuakeCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (error && quakes.length === 0) {
        return (
            <>
                {liveRegion}
                <ErrorState message={error} onRetry={onRetry} />
            </>
        );
    }

    if (quakes.length === 0) {
        return (
            <>
                {liveRegion}
                <EmptyState title={t('quake.noneFound')} description={t('quake.noneFoundDesc')} />
            </>
        );
    }

    const visible = quakes.slice(0, visibleCount);

    return (
        <div className="space-y-3">
            {liveRegion}
            {visible.map((quake, i) => {
                // null severity = "no measurement", rendered neutral rather
                // than borrowing 'stable' green, which would read as an
                // all-clear we haven't actually been told.
                const severity = quake.properties.mag !== null ? getSeverity(quake.properties.mag) : null;
                const isNew = newIds?.has(quake.id);
                const [lng, lat, depth] = quake.geometry?.coordinates ?? [];
                const hasCoords = lat !== undefined && lng !== undefined;
                const distance = userLoc && hasCoords ? distanceKm(userLoc, { lat, lng }) : null;
                const detailHref = `/quake/${encodeURIComponent(quake.id)}`;
                const stash = () => hasCoords && stashQuake({
                    id: quake.id,
                    source: quake.properties.source,
                    mag: quake.properties.mag,
                    place: quake.properties.place,
                    time: quake.properties.time,
                    lat, lng, depth,
                    url: quake.properties.url,
                });

                return (
                    <div key={quake.id} className="flex gap-3">
                        {/* Timeline rail */}
                        <div className="flex flex-shrink-0 flex-col items-center pt-6">
                            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${severity ? SEVERITY_DOT[severity] : 'bg-foreground-subtle'} ${isNew ? 'live-dot' : ''}`} />
                            {i < visible.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
                        </div>

                        <Card
                            interactive
                            padding="none"
                            className={`group/card min-w-0 flex-1 rounded-xl ${isNew ? 'animate-highlight-new' : ''}`}
                        >
                            <Link href={detailHref} className="block p-5" onClick={stash}>
                                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold leading-tight text-foreground">{quake.properties.place}</h2>
                                        <p className="mt-1 font-mono text-xs text-foreground-muted">
                                            {formatRelativeTime(quake.properties.time)} · {new Date(quake.properties.time).toLocaleString()}
                                        </p>
                                        {(distance !== null || (depth !== undefined && depth > 0)) && (
                                            <p className="mt-1 text-xs text-foreground-subtle">
                                                {distance !== null && formatDistanceKm(distance)}
                                                {distance !== null && depth !== undefined && ' · '}
                                                {depth !== undefined && formatDepthKm(depth)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-shrink-0 items-center gap-2 text-right">
                                        <div className={`font-mono text-3xl font-bold tabular-nums ${severity ? SEVERITY_TEXT[severity] : 'text-foreground-subtle'}`}>
                                            {quake.properties.mag !== null ? quake.properties.mag.toFixed(1) : '—'}
                                        </div>
                                        {/* Carries the affordance the separate
                                            "View details" link used to: the whole
                                            card is already this same link, so that
                                            footer copy was a second control for an
                                            action the card itself performs. */}
                                        <ArrowUpRightIcon size={14} className="text-foreground-subtle transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5" aria-hidden="true" />
                                    </div>
                                </div>
                            </Link>
                            <div className="flex items-center justify-between border-t border-border px-5 py-3">
                                <div className="flex items-center gap-2">
                                    {quake.properties.source && <Tag>{quake.properties.source}</Tag>}
                                </div>
                                <ShareButton
                                    title={quake.properties.place}
                                    text={quake.properties.mag !== null
                                        ? `M${quake.properties.mag.toFixed(1)} -- ${quake.properties.place}`
                                        : quake.properties.place}
                                    url={typeof window !== 'undefined' ? `${window.location.origin}${detailHref}` : detailHref}
                                    eventName="share_quake"
                                />
                            </div>
                        </Card>
                    </div>
                );
            })}
        </div>
    );
};
