"use client";
import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { StatCard } from '@/components/ui/StatCard';
import { UnavailableState, NoEventsState } from '@/components/ui/DataState';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { groupBy, rankGroups, countByDay } from '@/lib/hazardAggregates';
import { REGIONS } from '@/lib/regions';
import { HAZARD_CONFIG, RANKING_LABELS, type HazardSlug, type RankingMethod } from '@/lib/hazardConfig';
import type { EventScope } from '@/lib/hazardModel';

const RANGES = [
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
    { days: 365, label: 'Past year' },
];

const ALL_REGIONS = '__all__';

/**
 * Rankings of countries and regions for one hazard type.
 *
 * The ranking methods offered come from that hazard's own config: severity
 * options simply do not appear for volcano, landslide or tsunami, because
 * those sources publish no severity number and a leaderboard of "average
 * volcano" would be a column of nulls dressed up as analysis. What replaced
 * the old view is not more metrics but fewer wrong ones -- the previous
 * implementation labelled every hazard's value column "Magnitude" and bucketed
 * "regions" by the last comma-delimited token of the place string, which put
 * "CA", "Alaska" and "Hurricane Fausto" in the same ranking as "Afghanistan".
 *
 * Every number here is computed by lib/hazardAggregates.ts from the same
 * normalized events the lists render, so a country's count on this page is the
 * count its event list will contain.
 */
export function TrendsView({ slug }: { slug: HazardSlug }) {
    const config = HAZARD_CONFIG[slug];
    const metric = config.severity;

    const [days, setDays] = useLocalStorageState(`${slug}_trends_days`, 30);
    const [regionId, setRegionId] = useLocalStorageState(`${slug}_trends_region`, ALL_REGIONS);
    const [dimension, setDimension] = useLocalStorageState<'country' | 'region'>(`${slug}_trends_dim`, 'country');
    const [rankBy, setRankBy] = useLocalStorageState<RankingMethod>(`${slug}_trends_rank`, 'count');

    // A stored preference can outlive the config that allowed it (or be carried
    // over from a hazard type that has severity). Fall back rather than ranking
    // by a metric this hazard cannot produce.
    const activeRank: RankingMethod = config.rankings.includes(rankBy) ? rankBy : 'count';

    const scope = useMemo<EventScope>(
        () => (regionId === ALL_REGIONS ? { kind: 'global' } : { kind: 'region', regionId }),
        [regionId]
    );

    const hours = days * 24;
    const { status, events, total, error, offline, refetch } = useHazardQuery({
        types: config.hazardType.split(',').map((t) => t.trim()),
        scope,
        hours,
        limit: 2000,
    });

    const ranked = useMemo(
        () => rankGroups(groupBy(events, dimension, hours), activeRank),
        [events, dimension, hours, activeRank]
    );

    const daily = useMemo(() => countByDay(events), [events]);

    const measured = useMemo(
        () => events.filter((e) => e.severity !== null).map((e) => e.severity as number),
        [events]
    );
    const peak = measured.length > 0 ? Math.max(...measured) : null;
    const mean = measured.length > 0 ? measured.reduce((a, b) => a + b, 0) / measured.length : null;

    const formatRank = (value: number | null) => {
        if (value === null) return 'n/a';
        if (activeRank === 'count') return String(Math.round(value));
        if (activeRank === 'frequency') return `${value.toFixed(1)}/day`;
        return metric ? metric.format(value) : value.toFixed(1);
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-8 md:px-8 md:pb-10">
            <Card>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <Label htmlFor="trends-range">Time range</Label>
                        <select
                            id="trends-range"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="trends-region">Scope</Label>
                        <select
                            id="trends-region"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={regionId}
                            onChange={(e) => setRegionId(e.target.value)}
                        >
                            <option value={ALL_REGIONS}>Worldwide</option>
                            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="trends-dimension">Rank</Label>
                        <select
                            id="trends-dimension"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={dimension}
                            onChange={(e) => setDimension(e.target.value as 'country' | 'region')}
                        >
                            <option value="country">Countries</option>
                            <option value="region">Regions</option>
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="trends-rank">Sort by</Label>
                        <select
                            id="trends-rank"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={activeRank}
                            onChange={(e) => setRankBy(e.target.value as RankingMethod)}
                        >
                            {/* Only the methods this hazard type can actually
                                produce -- see HazardConfig.rankings. */}
                            {config.rankings.map((method) => (
                                <option key={method} value={method}>{RANKING_LABELS[method]}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!metric && (
                    <p className="mt-3 border-t border-border pt-3 text-xs text-foreground-muted">
                        {config.title} sources publish no severity measurement, so rankings here are by
                        how often events occur, not how strong they were.
                    </p>
                )}
            </Card>

            {status === 'failed' ? (
                <UnavailableState subject={`${config.title} trends`} message={error ?? undefined} offline={offline} onRetry={refetch} />
            ) : status === 'ready' && events.length === 0 ? (
                <NoEventsState
                    title={config.emptyTitle}
                    description={config.emptyDescription}
                    scopeNote={`${RANGES.find((r) => r.days === days)?.label} · ${regionId === ALL_REGIONS ? 'Worldwide' : REGIONS.find((r) => r.id === regionId)?.label}`}
                    coverageNotice={config.coverageNotice}
                />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <StatCard
                            label="Total events"
                            value={total}
                            placeholder={status === 'loading' ? '—' : undefined}
                            sparkline={daily.length > 1 ? daily.map((d) => d.count) : undefined}
                        />
                        <StatCard
                            label="Per day"
                            value={total / Math.max(days, 1)}
                            decimals={1}
                            placeholder={status === 'loading' ? '—' : undefined}
                        />
                        {/* Severity tiles exist only where severity does. */}
                        {metric && (
                            <>
                                <StatCard
                                    label={`Peak ${metric.label.toLowerCase()}`}
                                    value={peak ?? 0}
                                    decimals={metric.precision}
                                    suffix={` ${metric.unit}`}
                                    placeholder={status === 'loading' || peak === null ? '—' : undefined}
                                />
                                <StatCard
                                    label={`Mean ${metric.label.toLowerCase()}`}
                                    value={mean ?? 0}
                                    decimals={metric.precision}
                                    suffix={` ${metric.unit}`}
                                    placeholder={status === 'loading' || mean === null ? '—' : undefined}
                                />
                            </>
                        )}
                    </div>

                    <Card>
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-foreground-muted">
                            {dimension === 'country' ? 'Countries' : 'Regions'} by {RANKING_LABELS[activeRank].toLowerCase()}
                        </h3>

                        <ol className="space-y-2">
                            {ranked.slice(0, 12).map((group, index) => {
                                const value = group[activeRank];
                                const top = ranked[0]?.[activeRank];
                                const width = typeof value === 'number' && typeof top === 'number' && top > 0
                                    ? Math.max(2, (value / top) * 100)
                                    : 0;

                                return (
                                    <li key={group.key} className="flex items-center gap-3">
                                        <span className="w-5 flex-shrink-0 text-right font-mono text-xs text-foreground-subtle">
                                            {index + 1}
                                        </span>
                                        <span className="w-40 flex-shrink-0 truncate text-sm text-foreground" title={group.label}>
                                            {group.label}
                                        </span>
                                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                                            <span className="block h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                                        </span>
                                        <span className="w-20 flex-shrink-0 text-right font-mono text-xs text-foreground-muted">
                                            {formatRank(typeof value === 'number' ? value : null)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>

                        {ranked.length === 0 && status === 'ready' && (
                            <p className="text-sm text-foreground-muted">Nothing to rank in this window.</p>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
