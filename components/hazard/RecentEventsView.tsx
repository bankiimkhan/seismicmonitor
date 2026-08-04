"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Badge';
import { QuakeCardSkeleton } from '@/components/ui/Skeleton';
import { UnavailableState, NoEventsState } from '@/components/ui/DataState';
import { ArrowUpRightIcon } from '@/components/ui/icons';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { formatDepthKm } from '@/lib/geo';
import { REGION_BY_ID } from '@/lib/regions';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';
import { scopeLabel, WINDOW_PRESETS, type EventScope } from '@/lib/hazardModel';

/**
 * The step between a Home card and a single event's detail page.
 *
 * The flow this implements is: card -> the events behind that card's number ->
 * one event's full detail. Previously a card jumped straight into the hazard's
 * monitoring module, which meant the number you clicked and the list you landed
 * on were two different queries, with the module's own default filters
 * reasserting themselves on arrival -- so "12 events" routinely opened a page
 * showing some other count.
 *
 * This view therefore takes the scope and window as parameters and applies no
 * defaults of its own. It is intentionally read-only: the filtering module is
 * one link away for anyone who wants to change the question.
 */
export function RecentEventsView({
    slug, scope, hours,
}: {
    slug: HazardSlug;
    scope: EventScope;
    hours: number;
}) {
    const config = HAZARD_CONFIG[slug];
    const router = useRouter();
    const metric = config.severity;

    const { status, events, total, error, offline, refetch } = useHazardQuery({
        types: config.hazardType.split(',').map((t) => t.trim()),
        scope,
        hours,
        limit: 200,
    });

    const windowLabel = WINDOW_PRESETS.find((w) => w.hours === hours)?.longLabel
        ?? `Last ${Math.round(hours / 24)} days`;
    const where = scopeLabel(scope);

    // Where to go to change the question. A region scope has a Regional tab
    // that can express it; a point scope has Local.
    const moduleHref = scope.kind === 'region' ? `/${slug}/regional`
        : scope.kind === 'point' ? `/${slug}/local`
            : `/${slug}/global`;

    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-10">
            <div className="mb-6">
                <Link href="/" className="text-xs uppercase tracking-[0.18em] text-foreground-muted transition-colors hover:text-accent">
                    ← Hazard watch
                </Link>
                <h1 className="glow-text mt-3 text-xl text-accent">{config.title}</h1>
                <p className="mt-1 text-sm text-foreground-muted">
                    {windowLabel} · {where}
                    {status === 'ready' && (
                        <>
                            <span className="mx-2 text-foreground-subtle">·</span>
                            <span className="font-medium text-foreground">
                                {total} {total === 1 ? config.itemNounSingular : config.itemNounPlural}
                            </span>
                        </>
                    )}
                </p>
            </div>

            {status === 'failed' ? (
                <UnavailableState
                    subject={`${config.title} data`}
                    message={error ?? undefined}
                    offline={offline}
                    onRetry={refetch}
                />
            ) : status === 'loading' ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <QuakeCardSkeleton key={i} />)}
                </div>
            ) : events.length === 0 ? (
                <NoEventsState
                    title={config.emptyTitle}
                    description={config.emptyDescription}
                    scopeNote={`${windowLabel} · ${where}`}
                    coverageNotice={config.coverageNotice}
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {events.map((event) => (
                        <Card
                            key={event.id}
                            interactive
                            padding="none"
                            className="group/card min-w-0 rounded-xl"
                        >
                            <button
                                type="button"
                                onClick={() => router.push(`/quake/${encodeURIComponent(event.id)}`)}
                                className="block w-full p-5 text-left"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold leading-tight text-foreground">
                                            {event.place}
                                        </h2>
                                        <p className="mt-1 font-mono text-xs text-foreground-muted">
                                            {formatRelativeTime(event.time)}
                                        </p>
                                        <p className="mt-1 text-xs text-foreground-subtle">
                                            {[
                                                event.country,
                                                event.regionId ? REGION_BY_ID[event.regionId]?.label : 'Outside regions',
                                                slug === 'earthquake' && event.depthKm !== null
                                                    ? formatDepthKm(event.depthKm)
                                                    : null,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                        {event.alertLevel && <Tag className="mt-2">{event.alertLevel}</Tag>}
                                    </div>

                                    <div className="flex flex-shrink-0 items-center gap-2 text-right">
                                        {/* Only rendered for hazard types that publish a
                                            severity number -- no em-dash placeholder
                                            implying a missing measurement. */}
                                        {metric && event.severity !== null && (
                                            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                                                {metric.format(event.severity)}
                                            </span>
                                        )}
                                        <ArrowUpRightIcon
                                            size={14}
                                            className="text-foreground-subtle transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>
                            </button>
                        </Card>
                    ))}
                </div>
            )}

            <div className="mt-8 border-t border-border pt-5">
                <Link href={moduleHref} className="text-sm text-accent underline underline-offset-2 hover:opacity-80">
                    Open the full {config.title.toLowerCase()} module — search, severity and date filters
                </Link>
            </div>
        </div>
    );
}
