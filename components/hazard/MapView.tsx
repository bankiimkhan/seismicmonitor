"use client";
import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { EventMap, HAZARD_COLOR } from '@/components/EventMap';
import { UnavailableState } from '@/components/ui/DataState';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { REGIONS } from '@/lib/regions';
import { HAZARD_SLUGS, HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';
import type { EventScope } from '@/lib/hazardModel';

// 24 hours first, and the default: a map is a "what is happening now" surface,
// and a 7-day plot of every hazard type is a screen of overlapping dots that
// answers no question. Longer ranges stay available for looking back.
const RANGES = [
    { hours: 24, label: 'Last 24 hours' },
    { hours: 168, label: 'Last 7 days' },
    { hours: 720, label: 'Last 30 days' },
    { hours: 2160, label: 'Last 90 days' },
];

const ALL_REGIONS = '__all__';
const ALL_COUNTRIES = '__all__';

/**
 * The map, filterable across hazard types rather than locked to one.
 *
 * Reached from a hazard section, so it opens on that section's type -- but the
 * type filter is a real control, because "what happened near here in the last
 * day" is rarely a single-hazard question. Region and country filters come from
 * the same normalized fields every other view groups by, so a country selected
 * here means exactly what it means on Trends.
 */
export function MapView({ slug }: { slug: HazardSlug }) {
    const [selectedSlugs, setSelectedSlugs] = useLocalStorageState<string[]>(`${slug}_map_types`, [slug]);
    const [hours, setHours] = useLocalStorageState(`${slug}_map_hours`, 24);
    const [regionId, setRegionId] = useLocalStorageState(`${slug}_map_region`, ALL_REGIONS);
    const [country, setCountry] = useLocalStorageState(`${slug}_map_country`, ALL_COUNTRIES);

    // Memoized: a fresh array identity here would re-key the `types` memo below
    // on every render, which re-runs the query and re-mounts every marker.
    const active = useMemo(
        () => (selectedSlugs.length > 0 ? selectedSlugs : [slug]),
        [selectedSlugs, slug]
    );

    const types = useMemo(
        () => active.flatMap((s) =>
            (HAZARD_CONFIG[s as HazardSlug]?.hazardType ?? s).split(',').map((t) => t.trim())
        ),
        [active]
    );

    const scope = useMemo<EventScope>(
        () => (regionId === ALL_REGIONS ? { kind: 'global' } : { kind: 'region', regionId }),
        [regionId]
    );

    const { status, events, total, error, offline, refetch } = useHazardQuery({
        types,
        scope,
        hours,
        limit: 1000,
        country: country === ALL_COUNTRIES ? undefined : country,
        autoRefresh: true,
        refreshIntervalMs: 600_000,
    });

    // Country options come from the events actually in range, so the list can
    // never offer a country with nothing to show. Events whose place string
    // carries no country are excluded rather than listed as "Unknown" — there
    // is nothing to filter to.
    const countries = useMemo(() => {
        const seen = new Set<string>();
        for (const event of events) if (event.country) seen.add(event.country);
        return [...seen].sort((a, b) => a.localeCompare(b));
    }, [events]);

    const toggleType = (candidate: string) => {
        setSelectedSlugs((current) => {
            const next = current.includes(candidate)
                ? current.filter((s) => s !== candidate)
                : [...current, candidate];
            // Never let the selection empty out into a blank map with no way
            // back -- the last remaining type stays on.
            return next.length === 0 ? current : next;
        });
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-8 md:px-8 md:pb-10">
            <Card>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <Label htmlFor="map-range">Time range</Label>
                        <select
                            id="map-range"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={hours}
                            onChange={(e) => setHours(Number(e.target.value))}
                        >
                            {RANGES.map((r) => <option key={r.hours} value={r.hours}>{r.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="map-region">Region</Label>
                        <select
                            id="map-region"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={regionId}
                            onChange={(e) => setRegionId(e.target.value)}
                        >
                            <option value={ALL_REGIONS}>Worldwide</option>
                            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <Label htmlFor="map-country">Country</Label>
                        <select
                            id="map-country"
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                        >
                            <option value={ALL_COUNTRIES}>All countries</option>
                            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                    <Label htmlFor="map-types">Disaster type</Label>
                    <div id="map-types" className="mt-2 flex flex-wrap gap-2">
                        {HAZARD_SLUGS.map((candidate) => {
                            const on = active.includes(candidate);
                            return (
                                <button
                                    key={candidate}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleType(candidate)}
                                    className={`pad flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                                        on ? 'bg-accent text-accent-foreground shadow-[var(--glow-sm)]' : 'bg-transparent text-foreground-muted hover:text-accent'
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-2 w-2 rounded-full"
                                        style={{ background: HAZARD_COLOR[candidate] }}
                                    />
                                    {HAZARD_CONFIG[candidate].title}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {status === 'failed' ? (
                <UnavailableState subject="Map data" message={error ?? undefined} offline={offline} onRetry={refetch} />
            ) : (
                <div className="relative">
                    <EventMap
                        events={events}
                        // Severity shading only makes sense against one scale.
                        singleSlug={active.length === 1 ? active[0] : undefined}
                        className="h-[70vh] min-h-[420px] shadow-sm"
                    />

                    <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs text-foreground-muted shadow-md backdrop-blur sm:right-auto">
                        <span className="font-medium text-foreground">
                            {status === 'loading'
                                ? 'Loading…'
                                : `${events.length} plotted${total > events.length ? ` of ${total}` : ''}`}
                        </span>
                        <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
                        <span>{RANGES.find((r) => r.hours === hours)?.label}</span>
                        <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
                        <span>Click a marker for full event details</span>
                    </div>
                </div>
            )}
        </div>
    );
}
