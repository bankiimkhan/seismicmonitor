"use client";
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { HazardTable } from '@/components/HazardTable';
import { CoverageNotice } from '@/components/CoverageNotice';
import { LocationPrompt } from '@/components/LocationPrompt';
import { LocationSwitcher } from '@/components/LocationSwitcher';
import { useHazardEvents } from '@/hooks/useHazardEvents';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useLocation } from '@/hooks/useLocation';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';

// Same bbox width as earthquake's /local (lib's felt-distance table tops out
// around a 20-degree box) -- reused here for consistency even though the
// non-earthquake hazards don't have their own felt-distance model to derive
// a tuned per-hazard value from.
const FETCH_RANGE_DEG = '15';

interface HazardFeedProps {
    hazardSlug: HazardSlug;
    scope: 'local' | 'global';
}

/** Shared Local/Global content for every non-earthquake hazard type --
 * replaces the near-duplicated bodies previously copy-pasted across
 * app/wildfire, app/volcano, app/landslide, app/cyclone, app/severe-weather.
 * "Local" wires the same lat/lng/range params useHazardEvents (and
 * /api/hazards) already supported but these pages never used; "Global" omits
 * them for the unfiltered worldwide view. */
export function HazardFeed({ hazardSlug, scope }: HazardFeedProps) {
    const config = HAZARD_CONFIG[hazardSlug];
    const [timeRange, setTimeRange] = useLocalStorageState(
        `${hazardSlug}_${scope}_filter_timeRange`,
        String(config.defaultRangeDays)
    );

    const { status: locationStatus, location, requestGeolocation, setManualLocation, changeLocation } = useLocation();

    const { hazards, loading, error, refetch } = useHazardEvents(config.hazardType, {
        hours: String(parseInt(timeRange) * 24),
        limit: '300',
        lat: scope === 'local' ? location?.lat : undefined,
        lng: scope === 'local' ? location?.lng : undefined,
        range: scope === 'local' ? FETCH_RANGE_DEG : undefined,
        autoRefresh: true,
        refreshIntervalMs: 600_000,
    });

    return (
        <div className="space-y-4">
            <CoverageNotice notice={config.coverageNotice} />

            {scope === 'local' && (
                <LocationPrompt
                    status={locationStatus}
                    onAllow={requestGeolocation}
                    onManual={setManualLocation}
                    title={`See ${config.itemNounPlural} near you`}
                />
            )}

            <Card>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="w-full max-w-[220px]">
                        <Label htmlFor={`${hazardSlug}-${scope}-time-range`}>Time range</Label>
                        <select
                            id={`${hazardSlug}-${scope}-time-range`}
                            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                        >
                            {config.rangeOptionsDays.map((d) => (
                                <option key={d} value={d}>{d === 1 ? 'Last 24h' : `Last ${d} days`}</option>
                            ))}
                        </select>
                    </div>

                    {scope === 'local' && location && (
                        <LocationSwitcher current={location} onChangeLocation={changeLocation} onSelectSaved={setManualLocation} />
                    )}
                </div>
            </Card>

            <p className="text-sm text-foreground-muted">
                {hazards.length} {hazards.length === 1 ? config.itemNounSingular : config.itemNounPlural} reported
            </p>

            <HazardTable
                hazards={hazards}
                loading={loading}
                error={error}
                onRetry={refetch}
                valueLabel={config.valueLabel}
                emptyTitle={config.emptyTitle}
                emptyDescription={config.emptyDescription}
                errorTitle={config.errorTitle}
            />
        </div>
    );
}
