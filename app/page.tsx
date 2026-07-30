"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Accordion } from '@/components/ui/Accordion';
import { StatCard } from '@/components/ui/StatCard';
import { PageHero } from '@/components/layout/PageHero';
import {
  ActivityIcon, MapPinIcon, GlobeIcon, ArrowUpRightIcon,
  FlameIcon, VolcanoIcon, LandslideIcon, CycloneIcon,
} from '@/components/ui/icons';
import { QuakeList } from '@/components/QuakeList';
import { LocationPrompt } from '@/components/LocationPrompt';
import { CoverageStrip } from '@/components/CoverageStrip';
import { ShareAppCard } from '@/components/ShareAppCard';
import { HazardWatchCard } from '@/components/HazardWatchCard';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useLocation } from '@/hooks/useLocation';
import { regionForPoint, regionBoundsAsCenterRange } from '@/lib/regions';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';
import { useT } from '@/lib/i18n/LocaleProvider';

// --- EMERGENCY NUMBER DATABASE ---
const emergencyNumbers: { [key: string]: string } = {
  // South Asia
  BD: "02-58811651", IN: "112", PK: "1122", LK: "119", NP: "100", BT: "112", MM: "199",
  // North America
  US: "911", CA: "911", MX: "911",
  // Europe
  IT: "112", DE: "112", FR: "112", ES: "112", GB: "999", TR: "112",
  // Asia Pacific
  JP: "119", CN: "119", TW: "119", KR: "119", ID: "112", TH: "191", PH: "911", MY: "999", SG: "995", AU: "000", NZ: "111",
  // Middle East
  SA: "998", AE: "999", KW: "112", IL: "100", IR: "115",
  // Others
  RU: "112", ZA: "10111"
};

// Deliberately its own (slightly narrower) box, not lib/regions.ts's South
// Asia region -- this one exists purely to pick NCS (India's own agency,
// only authoritative for the subcontinent) vs USGS, a data-quality choice
// independent of the "which named region am I in" display concept below.
const IN_MIN_LAT = 5.0, IN_MAX_LAT = 35.0, IN_MIN_LNG = 60.0, IN_MAX_LNG = 100.0;

export default function Home() {
  const { t } = useT();
  const { status: locationStatus, location, requestGeolocation, setManualLocation } = useLocation();

  const [source, setSource] = useState<'usgs' | 'ncs'>('usgs');
  const [visibleCount, setVisibleCount] = useState(4);
  const [fullDataLoaded, setFullDataLoaded] = useState(false);

  // DYNAMIC SAFETY INFO
  const [country, setCountry] = useState("your area");
  const [emergencyNum, setEmergencyNum] = useState("112");

  const hoursWindow = fullDataLoaded ? '24' : '12';

  // Auto-detected region (lib/regions.ts) -- Home shows "your region"'s
  // activity, not an arbitrary fixed-degree box around the user's exact
  // point. No location resolved yet -> no bounds -> fetchEarthquakeFeatures'
  // default (worldwide) applies, same graceful fallback Trends uses.
  const region = useMemo(
    () => (location ? regionForPoint(location.lat, location.lng) : null),
    [location]
  );
  const feedBounds = useMemo(
    () => (region ? regionBoundsAsCenterRange(region) : null),
    [region]
  );

  const { quakes, loading, isRefreshing, error, isOfflineError, sourceStatus, lastUpdated, newIds, refetch } = useEarthquakes({
    source,
    lat: feedBounds?.lat,
    lng: feedBounds?.lng,
    range: feedBounds ? String(feedBounds.range) : undefined,
    hours: hoursWindow,
    limit: fullDataLoaded ? '50' : '8',
    autoRefresh: true,
    refreshIntervalMs: 30000,
  });

  // Pick USGS vs NCS based on resolved location, and pull country-specific
  // safety info -- runs for both geolocation and manually-entered locations.
  useEffect(() => {
    if (!location) return;
    const inIndiaSubcontinent =
      location.lat >= IN_MIN_LAT && location.lat <= IN_MAX_LAT &&
      location.lng >= IN_MIN_LNG && location.lng <= IN_MAX_LNG;
    // Derives from `location` (an external signal from geolocation/manual
    // entry) alongside the reverse-geocode fetch below -- both belong in
    // the same effect since they react to the same external change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(inIndiaSubcontinent ? 'ncs' : 'usgs');

    let cancelled = false;
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setCountry(data.countryName || "your area");
        setEmergencyNum(emergencyNumbers[data.countryCode] || "112");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location]);

  const strongest = useMemo(() => {
    if (quakes.length === 0) return null;
    return quakes.reduce((max, q) => (q.properties.mag > max.properties.mag ? q : max), quakes[0]);
  }, [quakes]);

  const magSparkline = useMemo(
    () => [...quakes].reverse().slice(-12).map((q) => q.properties.mag),
    [quakes]
  );

  const preparednessItems = [
    { title: t('prep.dropTitle'), content: t('prep.dropBody') },
    { title: t('prep.bagTitle'), content: t('prep.bagBody') },
    { title: t('prep.aftershockTitle'), content: t('prep.aftershockBody') },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">

      {/* HERO */}
      <PageHero
        title={t('home.title')}
        description={
          <>
            {t('home.monitoring')}{' '}
            <span className="font-medium text-foreground">{region ? region.label : 'Worldwide'}</span>
            <span className="mx-2 text-foreground-subtle">·</span>
            <span className="font-medium text-foreground">{source === 'usgs' ? 'USGS' : 'NCS India'}</span>
            <span className="mx-2 text-foreground-subtle">·</span>
            {t('home.updated')} {lastUpdated || '…'}
            {isRefreshing && <span className="ml-1 text-accent">· {t('home.refreshing')}</span>}
          </>
        }
        actions={
          <div className="flex items-center gap-2 self-start rounded-full border border-border bg-surface p-1 md:self-auto">
            <button
              onClick={() => setSource('usgs')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${source === 'usgs' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              USGS
            </button>
            <button
              onClick={() => setSource('ncs')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${source === 'ncs' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              NCS
            </button>
          </div>
        }
      />

      <div className="mb-6">
        <CoverageStrip />
      </div>

      <LocationPrompt status={locationStatus} onAllow={requestGeolocation} onManual={setManualLocation} />

      {isOfflineError && (
        <div className="mb-6 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <span className="font-medium">{t('offline.title')}</span> -- {t('offline.desc')}
        </div>
      )}

      {!isOfflineError && error && quakes.length > 0 && (
        <div className="mb-6 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('home.liveDegraded', { error })}
        </div>
      )}

      {sourceStatus === 'fallback' && (
        <div className="mb-6 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('quake.fallbackNotice')}
        </div>
      )}

      {/* GLOBAL HAZARD WATCH -- one tile per hazard type (earthquakes plus
          every hazard_events-backed type), each generalizing the old
          earthquake-only "tracked count + strongest activity" stat pair. */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t('home.hazardWatch')}</h2>
          <p className="text-sm text-foreground-muted">{t('home.hazardWatchDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Link href="/earthquake/global" className="block h-full">
            <StatCard
              interactive
              elevated
              className="h-full"
              label={t('dashboard.quakesTracked')}
              value={quakes.length}
              icon={<ActivityIcon size={16} />}
              sparkline={magSparkline.length > 1 ? magSparkline : undefined}
              footer={
                strongest ? (
                  <span className="block max-w-[150px] truncate" title={strongest.properties.place}>
                    <span className="font-mono text-foreground-muted">{strongest.properties.mag.toFixed(1)} · </span>
                    {strongest.properties.place}
                  </span>
                ) : t('dashboard.noActivity')
              }
            />
          </Link>
          <HazardWatchCard hazardType={HAZARD_CONFIG.wildfire.hazardType} title={t('home.wildfires')} icon={<FlameIcon size={16} />} href="/wildfire/global" hours={HAZARD_CONFIG.wildfire.watchHours} unit={HAZARD_CONFIG.wildfire.unit} noActivityLabel={t('dashboard.noActivity')} />
          <HazardWatchCard hazardType={HAZARD_CONFIG.volcano.hazardType} title={t('home.volcanoes')} icon={<VolcanoIcon size={16} />} href="/volcano/global" hours={HAZARD_CONFIG.volcano.watchHours} noActivityLabel={t('dashboard.noActivity')} />
          <HazardWatchCard hazardType={HAZARD_CONFIG.landslide.hazardType} title={t('home.landslides')} icon={<LandslideIcon size={16} />} href="/landslide/global" hours={HAZARD_CONFIG.landslide.watchHours} noActivityLabel={t('dashboard.noActivity')} />
          <HazardWatchCard hazardType={HAZARD_CONFIG.cyclone.hazardType} title={t('home.cyclones')} icon={<CycloneIcon size={16} />} href="/cyclone/global" hours={HAZARD_CONFIG.cyclone.watchHours} unit={HAZARD_CONFIG.cyclone.unit} noActivityLabel={t('dashboard.noActivity')} />

          {/* Detected location, not a hazard tile -- occupies the slot
              freed by folding Severe Weather into Cyclones above (EONET's
              severeStorms category and NOAA's cyclone feed are both
              tropical-storm data, just different sources/granularities --
              see lib/eonet.ts / lib/noaaCyclones.ts -- so showing them as
              two separate boxes here just duplicated the same phenomenon).
              Placed last so the hazard tiles stay grouped together first. */}
          <Link href="/earthquake/local" className="block h-full">
            <Card interactive className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{t('dashboard.detectedLocation')}</p>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
                  <MapPinIcon size={16} />
                </span>
              </div>
              <p className="truncate text-2xl font-bold tracking-tight text-foreground" title={country}>{country}</p>
              <p className="text-xs text-foreground-subtle">{region ? region.label : 'Worldwide'}</p>
            </Card>
          </Link>
        </div>
      </section>

      {/* MAIN FEED */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('home.recentActivity')}</h2>
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
            {t('nav.live')}
          </span>
        </div>

        <QuakeList
          quakes={quakes}
          loading={loading}
          error={error}
          onRetry={refetch}
          visibleCount={visibleCount}
          newIds={newIds}
          userLoc={location}
        />

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!fullDataLoaded && (
            <Button variant="secondary" onClick={() => setFullDataLoaded(true)}>
              {t('home.loadOlder')}
            </Button>
          )}
          {fullDataLoaded && quakes.length > visibleCount && (
            <Button variant="secondary" onClick={() => setVisibleCount(quakes.length)}>
              {t('home.showAll', { count: quakes.length })}
            </Button>
          )}
        </div>
      </section>

      {/* NAVIGATION SHORTCUTS */}
      <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/earthquake/local">
          <Card interactive className="flex h-full items-center gap-4 rounded-xl">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <MapPinIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{t('home.localArchive')}</h3>
              <p className="truncate text-sm text-foreground-muted">{t('home.localArchiveDesc')}</p>
            </div>
            <ArrowUpRightIcon size={16} className="flex-shrink-0 text-foreground-subtle" />
          </Card>
        </Link>
        <Link href="/earthquake/global">
          <Card interactive className="flex h-full items-center gap-4 rounded-xl">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <GlobeIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{t('home.globalDashboard')}</h3>
              <p className="truncate text-sm text-foreground-muted">{t('home.globalDashboardDesc')}</p>
            </div>
            <ArrowUpRightIcon size={16} className="flex-shrink-0 text-foreground-subtle" />
          </Card>
        </Link>
      </div>

      {/* SAFETY PROTOCOLS */}
      <section className="border-t border-border pt-10">
        <h3 className="mb-6 text-sm font-medium text-foreground-muted">{t('home.safetyFor', { country })}</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card elevated>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{t('home.emergencyHotline')}</p>
            <a href={`tel:${emergencyNum.replace('-', '')}`} className="text-3xl font-bold tracking-tight text-foreground transition-colors hover:text-accent">
              {emergencyNum}
            </a>
          </Card>

          <Card>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">{t('home.protectionDua')}</p>
            <p className="mb-3 text-right text-lg leading-loose text-foreground" dir="rtl">
              اللَّهُمَّ احْفَظْنَا مِنَ الزَّلَازِلِ وَالْمِحَنِ
            </p>
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-sm italic text-foreground-muted">
                &ldquo;Allahumma ahfizna min az-zalazil wal-mihan&rdquo;
              </p>
              <p className="text-sm text-foreground-subtle">
                O Allah, protect us from earthquakes and calamities.
              </p>
            </div>
          </Card>
        </div>

        <Card className="mt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground-muted">{t('home.preparedness')}</p>
          <Accordion items={preparednessItems} />
        </Card>

        <div className="mt-4">
          <ShareAppCard />
        </div>
      </section>

    </div>
  );
}
