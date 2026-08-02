"use client";
import Link from 'next/link';
import { useMemo } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { useHazardEvents, type HazardFeature } from '@/hooks/useHazardEvents';

interface HazardWatchCardProps {
    hazardType: string;
    title: string;
    icon: React.ReactNode;
    href: string;
    /** How far back to look, in hours -- mirrors that hazard type's own dedicated page's default time range. */
    hours: number;
    /** Unit label for hazard types with a real severity metric (FRP, wind speed); omit for volcano/landslide, which have none. */
    unit?: string;
    noActivityLabel: string;
    /** Shown in place of `noActivityLabel` when this hazard type has no working
     * source at all, so a structural gap doesn't read as a quiet day. */
    unavailableLabel?: string;
}

// One tile in Home's "Global Hazard Watch" grid -- generalizes the
// earthquake-only "quakes tracked" + "strongest activity" stat pair to every
// hazard type, reusing the same useHazardEvents fetch each dedicated hazard
// page already relies on. Reduces the fetched window down to one StatCard:
// tracked count + the single most severe reading, or (for hazard types with
// no severity metric, e.g. volcano/landslide) the most recent event instead.
export function HazardWatchCard({ hazardType, title, icon, href, hours, unit, noActivityLabel, unavailableLabel }: HazardWatchCardProps) {
    // `error` and `loading` are read, not discarded. Dropping them meant a
    // failing /api/hazards rendered a confident "0" with a "No activity"
    // footer -- i.e. this tile actively asserted that nothing was happening
    // whenever it had no idea, which is the worst thing a hazard dashboard can
    // do.
    const { hazards, loading, error } = useHazardEvents(hazardType, {
        hours: String(hours),
        limit: '300',
        autoRefresh: true,
        refreshIntervalMs: 600_000,
    });

    const { topValue, topPlace, sparkline } = useMemo(() => {
        const withMag = hazards.filter(
            (h): h is HazardFeature & { properties: { mag: number } } => h.properties.mag !== null
        );

        if (withMag.length > 0) {
            const top = withMag.reduce((max, h) => (h.properties.mag > max.properties.mag ? h : max));
            const trend = withMag.slice().reverse().slice(-12).map((h) => h.properties.mag);
            return {
                topValue: top.properties.mag,
                topPlace: top.properties.place,
                sparkline: trend.length > 1 ? trend : undefined,
            };
        }
        if (hazards.length > 0) {
            const mostRecent = hazards.reduce((max, h) => (h.properties.time > max.properties.time ? h : max));
            return { topValue: null as number | null, topPlace: mostRecent.properties.place, sparkline: undefined };
        }
        return { topValue: null as number | null, topPlace: null as string | null, sparkline: undefined };
    }, [hazards]);

    // An unreadable feed shows an em dash and says so. Only a successful,
    // genuinely empty response is allowed to render a count of 0.
    const unknown = error !== null || (loading && hazards.length === 0);
    const footer = unknown
        ? (error !== null ? "Couldn't load — count unknown" : 'Loading…')
        : topPlace ? (
            <span className="block max-w-[150px] truncate" title={topPlace}>
                {topValue !== null && (
                    <span className="font-mono text-foreground-muted">
                        {topValue.toFixed(1)}{unit ? ` ${unit}` : ''} ·{' '}
                    </span>
                )}
                {topPlace}
            </span>
        ) : (unavailableLabel ?? noActivityLabel);

    return (
        <Link href={href} className="block h-full">
            <StatCard
                interactive
                className="h-full"
                label={title}
                value={hazards.length}
                placeholder={unknown ? '—' : undefined}
                icon={icon}
                sparkline={unknown ? undefined : sparkline}
                footer={footer}
            />
        </Link>
    );
}
