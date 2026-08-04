"use client";
import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { EventTable } from '@/components/EventTable';
import { ExportButtons } from '@/components/ExportButtons';
import { CoverageNotice } from '@/components/CoverageNotice';
import { UnavailableState, NoEventsState } from '@/components/ui/DataState';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';
import { scopeLabel, rangeLabel, RANGE_OPTIONS, type EventScope } from '@/lib/hazardModel';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sentinel for the <select>, whose values must be strings. */
const ALL_RECORDS = 'all';

interface HazardScopeViewProps {
    slug: HazardSlug;
    scope: EventScope;
    /** Scope-specific controls rendered into the filter bar -- the region
     * picker on Regional, nothing on Global. */
    scopeControls?: React.ReactNode;
    /** Persists filters per view, so Regional and Global don't share one. */
    storageKey: string;
}

/**
 * The body shared by Regional and Global for every hazard type.
 *
 * These were five near-identical page bodies (HazardFeed for the five
 * non-earthquake hazards, plus earthquake's own hand-rolled ones) each running
 * their own fetch with their own window. Now they differ only by the `scope`
 * they are handed: "earthquakes in South Asia" is the same query whether it was
 * reached from Regional or by clicking a card on Home.
 *
 * Both views default to the entire archive, newest first -- they are the
 * complete record of a place, not a recent slice of it. The range control
 * narrows from there rather than being the starting point.
 *
 * Filters adapt to the hazard type rather than assuming earthquakes: the
 * severity control only appears for types that report a severity number, and it
 * is labelled and stepped in that type's own units.
 */
export function HazardScopeView({ slug, scope, scopeControls, storageKey }: HazardScopeViewProps) {
    const config = HAZARD_CONFIG[slug];
    const metric = config.severity;

    const [search, setSearch] = useLocalStorageState(`${storageKey}_search`, '');
    // null = every record. Stored as null rather than a large number so
    // "all" never silently becomes a very long but finite window.
    const [rangeHours, setRangeHours] = useLocalStorageState<number | null>(`${storageKey}_hours`, null);
    const [minSeverity, setMinSeverity] = useLocalStorageState(`${storageKey}_minSeverity`, 0);
    const [specificDate, setSpecificDate] = useLocalStorageState(`${storageKey}_date`, '');

    // An exact date is a 24h window anchored at the end of that UTC day. The
    // layer takes `until` for exactly this, so the window genuinely moves
    // instead of always meaning "the last 24 hours from now".
    const dayStartMs = specificDate ? Date.parse(`${specificDate}T00:00:00Z`) : NaN;
    const hasSpecificDay = Number.isFinite(dayStartMs);
    const hours = hasSpecificDay ? 24 : rangeHours ?? undefined;
    const until = hasSpecificDay ? dayStartMs + DAY_MS : undefined;

    const hazardTypes = useMemo(
        () => config.hazardType.split(',').map((t) => t.trim()),
        [config.hazardType]
    );

    const { status, events, total, truncated, countCapped, error, offline, refetch } = useHazardQuery({
        types: hazardTypes,
        scope,
        hours,
        until,
        limit: 500,
        // Sent only when this hazard type actually has a severity number to
        // compare against. A floor on a type that reports none would be a
        // filter nothing could pass.
        minSeverity: metric && minSeverity > 0 ? minSeverity : undefined,
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

    // CSV/JSON export lived on the old earthquake Local page and would have
    // been lost with it. Adapted here rather than dropped -- lib/exportQuakes.ts
    // carries CSV-injection hardening that is worth keeping, and export applies
    // to every hazard type, not just the one page that happened to have it.
    const exportable = useMemo(() => visible.map((event) => ({
        id: event.id,
        properties: {
            mag: event.severity,
            place: event.place,
            time: event.time,
            url: event.url,
        },
        geometry: { coordinates: [event.lng, event.lat, event.depthKm ?? 0] as [number, number, number] },
    })), [visible]);

    const windowLabel = hasSpecificDay ? specificDate : rangeLabel(rangeHours);
    const scopeNote = `${windowLabel} · ${scopeLabel(scope)}`;

    return (
        <div className="space-y-4">
            <CoverageNotice notice={config.coverageNotice} />

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
                            value={rangeHours === null ? ALL_RECORDS : rangeHours}
                            onChange={(e) => setRangeHours(e.target.value === ALL_RECORDS ? null : Number(e.target.value))}
                        >
                            {/* Identical on every hazard type: the per-hazard
                                rangeOptionsDays lists made two sections'
                                "default view" cover different spans, which is
                                exactly the inconsistency this work removes. */}
                            {RANGE_OPTIONS.map((option) => (
                                <option
                                    key={option.hours ?? ALL_RECORDS}
                                    value={option.hours ?? ALL_RECORDS}
                                >
                                    {option.label}
                                </option>
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

            {status === 'failed' ? (
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
                                    {truncated && !search.trim() && ` — newest 500 of ${countCapped ? `${total}+` : total}`}
                                </>}
                        </p>
                        <div className="flex items-center gap-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">{scopeNote}</p>
                            <ExportButtons quakes={exportable} />
                        </div>
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
                            showRegion={scope.kind === 'global'}
                        />
                    )}
                </>
            )}
        </div>
    );
}
