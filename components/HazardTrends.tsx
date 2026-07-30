"use client";
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Tag } from '@/components/ui/Badge';
import { LineChart, BarList } from '@/components/ui/charts';
import { ActivityIcon, TrendingUpIcon, GlobeIcon } from '@/components/ui/icons';
import { LocationPrompt } from '@/components/LocationPrompt';
import { useLocation } from '@/hooks/useLocation';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';

interface TrendsData {
    days: number;
    region: { id: string; label: string } | null;
    total: number;
    avgValue: number | null;
    byDay: { day: string; count: number }[];
    topRegions: { region: string; count: number }[];
}

const WINDOWS = [7, 30, 90, 365];

interface HazardTrendsProps {
    hazardSlug: HazardSlug;
}

/** Generalized from an earlier earthquake-only trends page -- StatCards +
 * LineChart(byDay) + BarList(topRegions) was already hazard-agnostic in
 * shape, so this is used by all 6 hazard sections via /api/trends'
 * `hazardType` param. The average-value StatCard is hidden for hazard types
 * with no numeric severity metric (volcano/landslide/tsunami all report
 * magnitude: null -- see lib/hazardConfig.ts's `hasValue`). */
export function HazardTrends({ hazardSlug }: HazardTrendsProps) {
    const config = HAZARD_CONFIG[hazardSlug];
    const { status: locationStatus, location, requestGeolocation, setManualLocation } = useLocation();
    const [days, setDays] = useState(30);
    const [data, setData] = useState<TrendsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Reset before the new fetch settles so a window/hazard switch
        // doesn't briefly show stale data under the new selection.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(null);
        setError(null);
        const params = new URLSearchParams({ days: String(days), hazardType: config.hazardType });
        if (location) {
            params.set('lat', String(location.lat));
            params.set('lng', String(location.lng));
        }
        fetch(`/api/trends?${params.toString()}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((d) => { if (!cancelled) setData(d); })
            .catch(() => { if (!cancelled) setError('Trends unavailable'); });
        return () => { cancelled = true; };
    }, [days, location, config.hazardType]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                {data && (
                    <Tag className="normal-case tracking-normal">
                        <GlobeIcon size={10} />
                        {data.region ? data.region.label : 'Worldwide'}
                    </Tag>
                )}
                {/* Segmented window control -- date range is the filter every reader reaches for first */}
                <div className="ml-auto flex items-center gap-1 self-start rounded-full border border-border bg-surface p-1 md:self-auto">
                    {WINDOWS.map((w) => (
                        <button
                            key={w}
                            onClick={() => setDays(w)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${days === w ? 'bg-accent text-accent-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}
                        >
                            {w}d
                        </button>
                    ))}
                </div>
            </div>

            <LocationPrompt
                status={locationStatus}
                onAllow={requestGeolocation}
                onManual={setManualLocation}
                title={`See ${config.itemNounPlural} near you`}
            />

            {error && <Card>{error}</Card>}

            {data && data.total === 0 && (
                <Card padding="lg" className="py-14 text-center text-sm text-foreground-muted">{config.emptyDescription}</Card>
            )}

            {!data && !error && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="skeleton h-28 rounded-lg" />
                    <div className="skeleton h-28 rounded-lg" />
                    <div className="skeleton h-64 rounded-lg sm:col-span-2" />
                    <div className="skeleton h-48 rounded-lg sm:col-span-2" />
                </div>
            )}

            {data && data.total > 0 && (
                <div className="space-y-6">
                    <div className={`grid grid-cols-1 gap-4 ${config.hasValue && data.avgValue !== null ? 'sm:grid-cols-2' : ''}`}>
                        <StatCard
                            label={`Total ${config.itemNounPlural}`}
                            value={data.total}
                            icon={<ActivityIcon size={16} />}
                            footer={`${data.days}d window`}
                        />
                        {config.hasValue && data.avgValue !== null && (
                            <StatCard
                                label={`Average ${config.valueLabel}`}
                                value={data.avgValue}
                                decimals={1}
                                icon={<TrendingUpIcon size={16} />}
                            />
                        )}
                    </div>

                    <Card padding="lg">
                        <p className="mb-4 text-sm font-semibold text-foreground">Activity by day</p>
                        <LineChart
                            ariaLabel="Activity by day"
                            data={data.byDay.map((d) => ({ label: d.day.slice(5), value: d.count }))}
                            formatValue={(v) => String(Math.round(v))}
                        />
                    </Card>

                    <Card padding="lg">
                        <p className="mb-4 text-sm font-semibold text-foreground">Top regions</p>
                        <BarList data={data.topRegions.map((r) => ({ label: r.region, value: r.count }))} />
                    </Card>
                </div>
            )}
        </div>
    );
}
