"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Accordion } from '@/components/ui/Accordion';
import { StatCard } from '@/components/ui/StatCard';
import { PageHero } from '@/components/layout/PageHero';
import {
  ActivityIcon, FlameIcon, VolcanoIcon, LandslideIcon, CycloneIcon, WavesIcon,
} from '@/components/ui/icons';
import { LocationPrompt } from '@/components/LocationPrompt';
import { ShareAppCard } from '@/components/ShareAppCard';
import { HazardWatchCard } from '@/components/HazardWatchCard';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { useLocation } from '@/hooks/useLocation';
import { regionForPoint, regionBoundsAsCenterRange } from '@/lib/regions';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';
import { useT } from '@/lib/i18n/LocaleProvider';

// --- EMERGENCY NUMBER DATABASE ---
// Only numbers that have been checked go in here. There is deliberately NO
// catch-all default: this used to fall back to "112" for any unmapped country,
// which is right for the EU/GSM and wrong across much of the world (Brazil is
// 190/192, Nigeria 199, and so on). Presenting a confident wrong number in a
// disaster app is worse than admitting we don't know -- see the null branch at
// the render site below.
const emergencyNumbers: { [key: string]: string } = {
  // South Asia. BD is the National Emergency Service (police/fire/ambulance),
  // not the Dhaka Fire Service HQ landline that used to be here.
  BD: "999", IN: "112", PK: "1122", LK: "119", NP: "100", BT: "112", MM: "199",
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

  // Still region-resolved (see the effect below), just no longer switchable
  // from this page: the USGS/NCS toggle existed to re-source the earthquake
  // feed that used to live here, and with the feed gone it would be an
  // earthquake-only data-source control on an all-hazard overview, affecting
  // one tile's count. The full source picker still lives where the
  // earthquake lists it applies to do.
  const [source, setSource] = useState<'usgs' | 'ncs'>('usgs');

  // DYNAMIC SAFETY INFO. `null` = we have no verified number for this country
  // (or location/reverse-geocode hasn't resolved yet), which is rendered as an
  // explicit "look it up" prompt rather than a plausible-looking guess.
  const [country, setCountry] = useState("your area");
  const [emergencyNum, setEmergencyNum] = useState<string | null>(null);

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

  // Feeds the Hazard Watch tile only, so its window and cap now match what
  // every other tile in that grid asks for (that hazard's own `watchHours`,
  // limit 300) instead of the 8-or-50 row budget the removed feed needed.
  const { quakes, loading, isRefreshing, error, isOfflineError, sourceStatus, lastUpdated } = useEarthquakes({
    source,
    lat: feedBounds?.lat,
    lng: feedBounds?.lng,
    range: feedBounds ? String(feedBounds.range) : undefined,
    hours: String(HAZARD_CONFIG.earthquake.watchHours),
    limit: '300',
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

    // Reverse-geocode to name the country and pick its emergency number. This
    // sends the resolved coordinates to a third party (disclosed in the
    // location prompt and on /about); it is bounded by an abort timeout so a
    // hanging provider can't leave the safety card stuck on its placeholder
    // indefinitely.
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=en`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`geocode status ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setCountry(data.countryName || "your area");
        // No "|| 112" fallback: an unmapped country yields null, which renders
        // as an explicit prompt to look up the local number.
        setEmergencyNum(emergencyNumbers[data.countryCode] ?? null);
      })
      .catch(() => {
        // Leaves country/emergencyNum at their "unknown" defaults rather than
        // asserting a number we can't stand behind.
      });
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [location]);

  // Only events with a real magnitude can be "strongest" -- USGS reports
  // `mag: null` for some events, and comparing against null silently returned
  // whichever happened to be first, then threw on `.toFixed()` downstream.
  const strongest = useMemo(() => {
    const measured = quakes.filter(
      (q): q is typeof q & { properties: { mag: number } } => q.properties.mag !== null
    );
    if (measured.length === 0) return null;
    return measured.reduce((max, q) => (q.properties.mag > max.properties.mag ? q : max));
  }, [quakes]);

  const magSparkline = useMemo(
    () => [...quakes].reverse().slice(-12)
      .map((q) => q.properties.mag)
      .filter((m): m is number => m !== null),
    [quakes]
  );

  // Same rule the other five tiles already follow (see HazardWatchCard): only a
  // successful, genuinely empty response may render a count of 0. This tile was
  // hand-rolled and skipped it, so a failed fetch showed a confident "0 -- No
  // activity yet". That was survivable while the feed below it showed the real
  // error; as the only earthquake surface on this page, it would now be the
  // page quietly asserting nothing is happening whenever it cannot tell.
  const quakeCountUnknown = error !== null || (loading && quakes.length === 0);

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
          // Scope and freshness. This used to read "Monitoring {region}", which
          // described the earthquake feed that lived below it -- as the header
          // of an all-hazard page sitting directly above a grid titled "Global
          // Hazard Watch", it now names one tile's scope while appearing to
          // describe all six. So: the page is worldwide, and the one tile that
          // is regional says so.
          <>
            {t('home.worldwideWatch')}
            {region && (
              <>
                <span className="mx-2 text-foreground-subtle">·</span>
                {t('home.quakesNear')}{' '}
                <span className="font-medium text-foreground">{region.label}</span>
              </>
            )}
            <span className="mx-2 text-foreground-subtle">·</span>
            {t('home.updated')} {lastUpdated || '…'}
            {isRefreshing && <span className="ml-1 text-accent">· {t('home.refreshing')}</span>}
          </>
        }
      />

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
          earthquake-only "tracked count + strongest activity" stat pair.
          Six hazards, six tiles, nothing else: a "Detected Location" tile used
          to sit in here too, which put a non-hazard in the hazard grid, repeated
          the region the header above already names, and sent you to the local
          earthquake archive from a label that never said so. */}
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
              label={t('home.earthquakes')}
              value={quakes.length}
              placeholder={quakeCountUnknown ? '—' : undefined}
              icon={<ActivityIcon size={16} />}
              sparkline={quakeCountUnknown || magSparkline.length <= 1 ? undefined : magSparkline}
              footer={
                quakeCountUnknown
                  ? (error !== null ? "Couldn't load — count unknown" : 'Loading…')
                  : strongest ? (
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
          {/* unavailableLabel: EONET's landslide category publishes nothing, so a
              zero here is "no source", not "no landslides" -- see
              lib/hazardConfig.ts's coverageNotice for the same caveat in full. */}
          <HazardWatchCard hazardType={HAZARD_CONFIG.landslide.hazardType} title={t('home.landslides')} icon={<LandslideIcon size={16} />} href="/landslide/global" hours={HAZARD_CONFIG.landslide.watchHours} noActivityLabel={t('dashboard.noActivity')} unavailableLabel="No source reporting" />
          <HazardWatchCard hazardType={HAZARD_CONFIG.cyclone.hazardType} title={t('home.cyclones')} icon={<CycloneIcon size={16} />} href="/cyclone/global" hours={HAZARD_CONFIG.cyclone.watchHours} unit={HAZARD_CONFIG.cyclone.unit} noActivityLabel={t('dashboard.noActivity')} />
          {/* Tsunami was the one nav section with no tile here, in a grid whose
              own description promises "every hazard type" -- and it is the one
              hazard where a reader most needs to see "nothing active" stated
              rather than inferred from its absence. Its zero names its own
              scope: NOAA/NWS covers US waters only (see this hazard's
              coverageNotice), so a bare "No activity yet" would read as a
              worldwide all-clear this feed cannot give. */}
          <HazardWatchCard hazardType={HAZARD_CONFIG.tsunami.hazardType} title={t('home.tsunamis')} icon={<WavesIcon size={16} />} href="/tsunami/global" hours={HAZARD_CONFIG.tsunami.watchHours} noActivityLabel="None active in US waters" />
        </div>
      </section>

      {/* No earthquake feed here. This page is the all-hazard overview, and a
          list of individual quakes gave one of the six hazards a whole section
          of its own -- the Hazard Watch tile above is that hazard's place here,
          and the full feed lives in the Earthquake section. */}

      {/* SAFETY PROTOCOLS */}
      <section className="mb-12 border-t border-border pt-10">
        <h2 className="mb-6 text-lg font-semibold text-foreground">{t('home.safetyFor', { country })}</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card elevated>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{t('home.emergencyHotline')}</p>
            {emergencyNum ? (
              <a
                href={`tel:${emergencyNum.replace(/[^0-9+]/g, '')}`}
                className="text-3xl font-bold tracking-tight text-foreground transition-colors hover:text-accent"
              >
                {emergencyNum}
              </a>
            ) : (
              <p className="text-sm text-foreground-muted">
                No verified emergency number for {country}. Look up your local emergency
                number now, before you need it.
              </p>
            )}
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
      </section>

      {/* Not safety information -- it was sitting under the "Safety information
          for {country}" heading, which claimed it as such. */}
      <ShareAppCard />

    </div>
  );
}
