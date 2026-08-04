"use client";
import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { EventTable } from '@/components/EventTable';
import { CoverageNotice } from '@/components/CoverageNotice';
import { UnavailableState, NoEventsState } from '@/components/ui/DataState';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';
import { scopeLabel, type EventScope } from '@/lib/hazardModel';

const DAY_MS = 24 * 60 * 60 * 1000;

interface HazardScopeViewProps {
    slug: HazardSlug;
    scope: EventScope;
    /** Scope-specific controls rendered into the filter bar -- the location
     * switcher on Local, the region picker on Regional, nothing on Global. */
    scopeControls?: React.ReactNode;
    /** Rendered above the filters, e.g. Local's location prompt. */
    banner?: React.ReactNode;
    /** Blocks the query until a prerequisite resolves (Local has no scope until
     * a location does). Renders `pendingMessage` instead. */
    enabled?: boolean;
    pendingMessage?: string;
    /** Distance column + felt-distance context; only for point scopes. */
    userLoc?: { lat: number; lng: number } | null;
    /** Persists filters per view, so Local and Global don't share one setting. */
    storageKey: string;
}

/**
 * The body shared by Local, Regional and Global for every hazard type.
 *
 * These were five near-identical page bodies (HazardFeed for the five
 * non-earthquake hazards, plus earthquake's own hand-rolled Local and Global)
 * each running their own fetch with their own window. Now they differ only by
 * the `scope` they are handed, which is the whole point: "12 earthquakes in
 * South Asia in the last 24 hours" is the same query whether it was reached
 * from Local, from Regional, or by clicking a card on Home.
 *
 * Filters adapt to the hazard type rather than assuming earthquakes: the
 * severity control only appears for types that report a severity number, and it
 * is labelled and stepped in that type's own units.
 */
export function HazardScopeView({
    slug, scope, scopeControls, banner, enabled = true, pendingMessage, userLoc, storageKey,
}: HazardScopeViewProps) {
    const config = HAZARD_CONFIG[slug];
    const metric = config.severity;

    const [search, setSearch] = useLocalStorageState(`${storageKey}_search`, '');
    const [days, setDays] = useLocalStorageState(`${storageKey}_days`, config.defaultRangeDays);
    const [minSeverity, setMinSeverity] = useLocalStorageState(`${storageKey}_minSeverity`, 0);
    const [specificDate, setSpecificDate] = useLocalStorageState(`${storageKey}_date`, '');

    // An exact date is a 24h window anchored at the end of that UTC day. The
    // layer takes `until` for exactly this, so the window genuinely moves
    // instead of always meaning "the last 24 hours from now".
    const dayStartMs = specificDate ? Date.parse(`${specificDate}T00:00:00Z`) : NaN;
    const hasSpecificDay = Number.isFinite(dayStartMs);
    const hours = hasSpecificDay ? 24 : days * 24;
    const until = hasSpecificDay ? dayStartMs + DAY_MS : undefined;

    const hazardTypes = useMemo(
        () => config.hazardType.split(',').map((t) => t.trim()),
        [config.hazardType]
    );

    const { status, events, total, truncated, error, offline, refetch } = useHazardQuery({
        types: hazardTypes,
        scope,
        hours,
        until,
        limit: 500,
        // Sent only when this hazard type actually has a severity number to
        // compare against. A floor on a type that reports none would be a
        // filter nothing could pass.
        minSeverity: metric && minSeverity > 0 ? minSeverity : undefined,
        enabled,
        autoRefresh: true,
        refreshIntervalMs: 600_000,
    });

    // Text search stays client-side: it filters what is already loaded, so
    // typing doesn't re-query, and the count beside it always describes the
    // rows actually on screen.
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return events;
        return events.filter((e) =>
            e.place.toLowerCase().includes(needle) || (e.country ?? '').toLowerCase().includes(needle)
        );
    }, [events, search]);

    const windowLabel = hasSpecificDay
        ? specificDate
        : days === 1 ? 'Last 24 hours' : `Last ${days} days`;
    const scopeNote = `${windowLabel} · ${scopeLabel(scope)}`;

    return (
        <div className="space-y-4">
            <CoverageNotice notice={config.coverageNotice} />
            {banner}

            <Card>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Label htmlFor={`${storageKey}-search`}>Search location</Label>
                        <Input
                            id={`${storageKey}-search`}
                            type="text"
                            placeholder="Search location…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor={`${storageKey}-range`}>Time range</Label>
                        <select
                            id={`${storageKey}-range`}
                            disabled={hasSpecificDay}
                            className={`w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${hasSpecificDay ? 'opacity-50' : ''}`}
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            {/* 24h is offered on every hazard type, because it is
                                what Home's cards link in with. */}
                            {[...new Set([1, ...config.rangeOptionsDays])].sort((a, b) => a - b).map((d) => (
                                <option key={d} value={d}>{d === 1 ? 'Last 24 hours' : `Last ${d} days`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Only for hazard types that publish a severity number.
                        Volcano, landslide and tsunami report none, so there is
                        nothing here to filter on and no control is shown. */}
                    {metric && (
                        <div>
                            <Label htmlFor={`${storageKey}-severity`}>
                                {metric.label} {minSeverity > 0 ? `≥ ${metric.format(minSeverity)}` : '(any)'}
                            </Label>
                            <input
                                id={`${storageKey}-severity`}
                                type="range"
                                min={0}
                                max={metric.bands.critical * 1.5}
                                step={metric.precision === 0 ? 5 : 0.5}
                                value={minSeverity}
                                onChange={(e) => setMinSeverity(Number(e.target.value))}
                                className="mt-2 w-full accent-accent"
                            />
                        </div>
                    )}

                    <div>
                        <Label htmlFor={`${storageKey}-date`}>Exact date</Label>
                        <Input
                            id={`${storageKey}-date`}
                            type="date"
                            value={specificDate}
                            onChange={(e) => setSpecificDate(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>

                {scopeControls && (
                    <div className="mt-4 border-t border-border pt-4">{scopeControls}</div>
                )}
            </Card>

            {!enabled ? (
                <NoEventsState
                    title={pendingMessage ?? 'Waiting for a location'}
                    description="Share or enter a location above and this view will fill in."
                />
            ) : status === 'failed' ? (
                // No count is rendered on this path at all -- see DataState.
                <UnavailableState
                    subject={`${config.title} data`}
                    message={error ?? undefined}
                    offline={offline}
                    onRetry={refetch}
                />
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-foreground-muted">
                            {status === 'loading'
                                ? 'Loading…'
                                : <>
                                    <span className="font-medium text-foreground">{visible.length}</span>
                                    {' '}{visible.length === 1 ? config.itemNounSingular : config.itemNounPlural}
                                    {search.trim() && total !== visible.length && ` of ${total} in range`}
                                    {truncated && !search.trim() && ` (showing newest 500 of ${total})`}
                                </>}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">{scopeNote}</p>
                    </div>

                    {status === 'ready' && visible.length === 0 ? (
                        <NoEventsState
                            title={config.emptyTitle}
                            description={config.emptyDescription}
                            scopeNote={scopeNote}
                            coverageNotice={config.coverageNotice}
                        />
                    ) : (
                        <EventTable
                            events={visible}
                            config={config}
                            loading={status === 'loading'}
                            userLoc={userLoc}
                            showRegion={scope.kind === 'global'}
                        />
                    )}
                </>
            )}
        </div>
    );
}
