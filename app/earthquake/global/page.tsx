"use client";
import { Card } from '@/components/ui/Card';
import { PageHero } from '@/components/layout/PageHero';
import { Input, Label } from '@/components/ui/Input';
import { QuakeList } from '@/components/QuakeList';
import { QuakeTable } from '@/components/QuakeTable';
import { MagnitudeControl } from '@/components/MagnitudeControl';
import { ExportButtons } from '@/components/ExportButtons';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useT } from '@/lib/i18n/LocaleProvider';
import { track } from '@/lib/analytics';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function GlobalPage() {
  const { t } = useT();

  // FILTERS -- persisted across visits (audit 2.3)
  const [search, setSearch] = useLocalStorageState('global_filter_search', '');
  const [minMag, setMinMag] = useLocalStorageState('global_filter_minMag', 4.5);
  const [timeRange, setTimeRange] = useLocalStorageState('global_filter_timeRange', '30');
  const [specificDate, setSpecificDate] = useLocalStorageState('global_filter_date', '');

  // An exact date is a 24h window anchored at the end of that UTC day, via
  // /api/earthquakes' `endTime`. The old expression here subtracted that
  // day's 00:00 from its own 23:59 -- which is 24 for every date -- so the
  // window never actually moved and picking a date just showed the last 24
  // hours from now.
  const dayStartMs = specificDate ? Date.parse(`${specificDate}T00:00:00Z`) : NaN;
  const hasSpecificDay = Number.isFinite(dayStartMs);
  const hours = hasSpecificDay ? '24' : String((parseInt(timeRange, 10) || 30) * 24);
  const endTime = hasSpecificDay ? String(dayStartMs + DAY_MS) : undefined;

  // Audit 2.5: was hard-coded to 'usgs', silently excluding NCS-only
  // regional events from a page called "Global". Merged sources instead.
  const { quakes, loading, error, refetch } = useEarthquakes({
    source: 'both',
    hours,
    endTime,
    limit: '200',
    minMag: String(minMag),
  });

  // Client-side text search on top of server-side magnitude/time filtering
  const filteredQuakes = quakes.filter(q => {
    const placeName = q.properties.place || "Unknown";
    if (!placeName.toLowerCase().includes(search.toLowerCase())) return false;

    // Belt-and-braces on top of the server-side window: source='both' mixes
    // in the NCS scrape of that agency's *current* page, which can't honour
    // endTime, so without this a past-date selection would show today's NCS
    // events alongside the correct USGS ones.
    if (hasSpecificDay) {
      const t = q.properties.time;
      if (t < dayStartMs || t >= dayStartMs + DAY_MS) return false;
    }

    return true;
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">

      <PageHero
        title={t('home.globalDashboard')}
        description={<>{t('home.globalDashboardDesc')} (USGS + NCS)</>}
      />

      {/* TOOLBAR */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="global-search">{t('filters.searchCountry')}</Label>
            <Input
              id="global-search"
              type="text"
              placeholder={t('filters.searchCountry')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <MagnitudeControl
            value={minMag}
            onChange={(v) => { setMinMag(v); track('filter_changed', { page: 'global', field: 'minMag', value: v }); }}
            presets={[4.5, 5.5, 6.5, 7.5]}
          />

          <div>
            <Label htmlFor="global-time-range">{t('filters.timeRange')}</Label>
            <select
              id="global-time-range"
              disabled={!!specificDate}
              className={`w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${specificDate ? 'opacity-50' : ''}`}
              value={timeRange}
              onChange={(e) => { setTimeRange(e.target.value); track('filter_changed', { page: 'global', field: 'timeRange', value: e.target.value }); }}
            >
              <option value="1">{t('filters.last24h')}</option>
              <option value="7">{t('filters.last7')}</option>
              <option value="30">{t('filters.last30')}</option>
              <option value="365">{t('filters.lastYear')}</option>
            </select>
          </div>

          <div>
            <Label htmlFor="global-date">{t('filters.exactDate')}</Label>
            <Input
              id="global-date"
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
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
          <QuakeTable quakes={filteredQuakes} loading={loading} error={error} onRetry={refetch} />
        </div>
        <div className="md:hidden">
          <QuakeList quakes={filteredQuakes} loading={loading} error={error} onRetry={refetch} />
        </div>
      </div>

    </div>
  );
}
