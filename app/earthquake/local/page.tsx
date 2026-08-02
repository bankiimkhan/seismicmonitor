"use client";
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { QuakeList } from '@/components/QuakeList';
import { QuakeTable } from '@/components/QuakeTable';
import { LocationPrompt } from '@/components/LocationPrompt';
import { LocationSwitcher } from '@/components/LocationSwitcher';
import { MagnitudeControl } from '@/components/MagnitudeControl';
import { ExportButtons } from '@/components/ExportButtons';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useLocation } from '@/hooks/useLocation';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useT } from '@/lib/i18n/LocaleProvider';
import { track } from '@/lib/analytics';
import { distanceKm, maxFeltDistanceKm } from '@/lib/geo';

// Widest tier in the felt-distance table is ~2000km (M8.9+); fetch a bbox
// generous enough to cover it (1 degree of latitude is ~111km) so the
// server-side query doesn't exclude a large quake before the client-side
// felt-distance filter below even sees it.
const FETCH_RANGE_DEG = '20';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function LocalPage() {
  const { t } = useT();
  const { status: locationStatus, location, requestGeolocation, setManualLocation, changeLocation } = useLocation();

  // FILTERS -- persisted across visits (audit 2.3)
  const [search, setSearch] = useLocalStorageState('local_filter_search', '');
  const [minMag, setMinMag] = useLocalStorageState('local_filter_minMag', 3.0);
  const [timeRange, setTimeRange] = useLocalStorageState('local_filter_timeRange', '30');
  const [specificDate, setSpecificDate] = useLocalStorageState('local_filter_date', '');

  // An exact date is a 24h window anchored at the end of that UTC day, via
  // /api/earthquakes' `endTime`. The old expression here subtracted that
  // day's 00:00 from its own 23:59 -- which is 24 for every date -- so the
  // window never actually moved and picking a date just showed the last 24
  // hours from now.
  const dayStartMs = specificDate ? Date.parse(`${specificDate}T00:00:00Z`) : NaN;
  const hasSpecificDay = Number.isFinite(dayStartMs);
  const hours = hasSpecificDay ? '24' : String((parseInt(timeRange, 10) || 30) * 24);
  const endTime = hasSpecificDay ? String(dayStartMs + DAY_MS) : undefined;

  const source = location && location.lat >= 5 && location.lat <= 35 && location.lng >= 60 && location.lng <= 100 ? 'ncs' : 'usgs';

  const { quakes, loading, error, refetch } = useEarthquakes({
    source,
    lat: location?.lat,
    lng: location?.lng,
    range: FETCH_RANGE_DEG,
    hours,
    endTime,
    limit: '200',
    minMag: String(minMag),
  });

  // Client-side text search, plus the "did you feel it" distance criteria:
  // a quake only counts as local if its magnitude could plausibly be felt
  // at the user's distance from it (see lib/geo.ts maxFeltDistanceKm).
  const filteredQuakes = quakes.filter(q => {
    const placeName = q.properties.place || "Unknown location";
    if (!placeName.toLowerCase().includes(search.toLowerCase())) return false;

    // Belt-and-braces on top of the server-side window: the NCS source is a
    // scrape of that agency's *current* page and can't honour endTime, so
    // without this a past-date selection would show today's NCS events.
    if (hasSpecificDay) {
      const t = q.properties.time;
      if (t < dayStartMs || t >= dayStartMs + DAY_MS) return false;
    }

    // Only events with a real magnitude can be measured against the felt-distance
    // table. An unmeasured one (USGS reports `mag: null`, typically on an event
    // too fresh to have been reviewed yet) used to reach maxFeltDistanceKm as a
    // `null` that coerced to magnitude 0 -- yielding a 5km cutoff, so the newest
    // nearby events were the ones silently dropped from a page whose whole job is
    // to surface them. Keep them: the server-side bbox already scopes the query
    // to the region, and "we don't know yet" is not grounds for hiding an event.
    if (location && q.properties.mag !== null) {
      const [lng, lat] = q.geometry?.coordinates ?? [];
      if (lat !== undefined && lng !== undefined) {
        const distance = distanceKm(location, { lat, lng });
        if (distance > maxFeltDistanceKm(q.properties.mag)) return false;
      }
    }

    return true;
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">

      <LocationPrompt status={locationStatus} onAllow={requestGeolocation} onManual={setManualLocation} />

      {/* TOOLBAR -- the location this page is scoped to is a filter like any
          other, so it sits with the rest of them (and matches where HazardFeed
          already puts it) rather than off in the page header. */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="local-search">{t('filters.search')}</Label>
            <Input
              id="local-search"
              type="text"
              placeholder={t('filters.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <MagnitudeControl
            value={minMag}
            onChange={(v) => { setMinMag(v); track('filter_changed', { page: 'local', field: 'minMag', value: v }); }}
          />

          <div>
            <Label htmlFor="local-time-range">{t('filters.timeRange')}</Label>
            <select
              id="local-time-range"
              disabled={!!specificDate}
              className={`w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${specificDate ? 'opacity-50' : ''}`}
              value={timeRange}
              onChange={(e) => { setTimeRange(e.target.value); track('filter_changed', { page: 'local', field: 'timeRange', value: e.target.value }); }}
            >
              <option value="7">{t('filters.last7')}</option>
              <option value="30">{t('filters.last30')}</option>
              <option value="90">{t('filters.last90')}</option>
              <option value="365">{t('filters.lastYear')}</option>
            </select>
          </div>

          <div>
            <Label htmlFor="local-date">{t('filters.exactDate')}</Label>
            <Input
              id="local-date"
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {location && (
          <div className="mt-4 border-t border-border pt-4">
            <LocationSwitcher current={location} onChangeLocation={changeLocation} onSelectSaved={setManualLocation} />
          </div>
        )}
      </Card>

      {/* RESULTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            {t('filters.eventsFound', { count: filteredQuakes.length, plural: filteredQuakes.length === 1 ? '' : 's' })}
          </p>
          <ExportButtons quakes={filteredQuakes} />
        </div>

        <div className="hidden md:block">
          <QuakeTable quakes={filteredQuakes} loading={loading} error={error} onRetry={refetch} userLoc={location} />
        </div>
        <div className="md:hidden">
          <QuakeList quakes={filteredQuakes} loading={loading} error={error} onRetry={refetch} userLoc={location} />
        </div>
      </div>

    </div>
  );
}
