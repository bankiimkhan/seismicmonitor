"use client";
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { UnavailableState } from '@/components/ui/DataState';
import { useHazardSummary } from '@/hooks/useHazardQuery';
import { HAZARD_SLUGS, HAZARD_CONFIG } from '@/lib/hazardConfig';
import {
    scopeToParams, scopeLabel, hoursForWindow, WINDOW_PRESETS,
    type EventScope, type WindowKey, type HazardSummaryEntry,
} from '@/lib/hazardModel';

/**
 * Home's hazard grid: six counts for one scope and one window.
 *
 * What changed here, and why:
 *
 *  - The six cards used to each run their own fetch over their own window
 *    (`watchHours` was 24h for wildfire, 720h for landslide, 2160h for
 *    volcano). Six different spans of time sat under one heading looking
 *    comparable. They now share a single request, so the grid states one
 *    window and means it.
 *
 *  - A card is no longer a link into the hazard's monitoring module. It is a
 *    reading first, and it opens the events *behind* that reading -- the same
 *    type, scope and window it just displayed. The generic module is still
 *    reachable from the nav; it is just not what a count should open.
 *
 *  - There is no "count unknown" any more. Either the whole grid has numbers or
 *    it has none and says the archive is unreachable, because a mix of real
 *    counts and placeholders is unreadable at a glance.
 */
export function HazardWatchGrid({
    scope, windowKey, onWindowChange,
}: {
    scope: EventScope;
    windowKey: WindowKey;
    onWindowChange: (key: WindowKey) => void;
}) {
    const hours = hoursForWindow(windowKey);
    const { status, summary, error, refetch } = useHazardSummary(scope, hours);

    const label = scopeLabel(scope);
    const windowLabel = WINDOW_PRESETS.find((w) => w.key === windowKey)?.longLabel ?? 'Last 24 hours';

    return (
        <section className="mb-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="glow-text text-sm text-accent">Hazard Watch</h2>
                    <p className="mt-1 text-xs tracking-wider text-foreground-muted">
                        {windowLabel} · {label} — every hazard type, counted the same way.
                    </p>
                </div>

                {/* One control for all six cards, so they can never describe
                    different spans of time. */}
                <div className="bezel flex items-center gap-1 p-1" role="group" aria-label="Time window">
                    {WINDOW_PRESETS.map((preset) => (
                        <button
                            key={preset.key}
                            type="button"
                            aria-pressed={windowKey === preset.key}
                            onClick={() => onWindowChange(preset.key)}
                            className={`pad px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                                windowKey === preset.key
                                    ? 'bg-accent text-accent-foreground shadow-[var(--glow-sm)]'
                                    : 'bg-transparent text-foreground-muted hover:text-accent'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {status === 'failed' ? (
                <UnavailableState subject="Hazard data" message={error ?? undefined} onRetry={refetch} />
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {HAZARD_SLUGS.map((slug) => (
                        <HazardCard
                            key={slug}
                            slug={slug}
                            scope={scope}
                            hours={hours}
                            windowLabel={windowLabel}
                            scopeName={label}
                            entry={summary?.hazards.find((h) => h.slug === slug)}
                            loading={status === 'loading'}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function HazardCard({
    slug, scope, hours, windowLabel, scopeName, entry, loading,
}: {
    slug: string;
    scope: EventScope;
    hours: number;
    windowLabel: string;
    scopeName: string;
    entry?: HazardSummaryEntry;
    loading: boolean;
}) {
    const config = HAZARD_CONFIG[slug as keyof typeof HAZARD_CONFIG];
    const Icon = config.icon;

    // Carries the exact query this card is displaying, so the list it opens is
    // guaranteed to be the same set of events the number counted.
    const params = scopeToParams(scope);
    params.set('hours', String(hours));
    const href = `/watch/${slug}?${params.toString()}`;

    const count = entry?.count ?? 0;
    const headline = entry?.headline ?? null;

    const footer = loading
        ? 'Loading…'
        : count === 0
            // A real zero from a source that answered. Named to its scope so it
            // cannot be read as a worldwide all-clear.
            ? (config.coverageNotice ? 'No data reported — see notice' : `None in ${scopeName}`)
            : headline
                ? (
                    <span className="block max-w-[170px] truncate" title={headline.place}>
                        {headline.severity !== null && config.severity && (
                            <span className="font-mono text-foreground-muted">
                                {config.severity.format(headline.severity)} ·{' '}
                            </span>
                        )}
                        {headline.place}
                    </span>
                )
                : `${windowLabel} · ${scopeName}`;

    return (
        <Link href={href} className="block h-full">
            <StatCard
                interactive
                elevated
                className="h-full"
                label={config.title}
                value={count}
                // Only while genuinely unknown. A failed load never reaches
                // here -- the whole grid is replaced above in that case.
                placeholder={loading ? '—' : undefined}
                icon={<Icon size={16} />}
                sparkline={!loading && entry && entry.trend.length > 1 ? entry.trend : undefined}
                footer={footer}
            />
        </Link>
    );
}
