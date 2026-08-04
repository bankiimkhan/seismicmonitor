"use client";
import { useState, useEffect, useMemo } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Readout } from '@/components/ui/Readout';
import { Accordion } from '@/components/ui/Accordion';
import { ActivityMeters } from '@/components/ActivityMeters';
import { PageHero } from '@/components/layout/PageHero';
import { LocationPrompt } from '@/components/LocationPrompt';
import { ShareAppCard } from '@/components/ShareAppCard';
import { HazardWatchGrid } from '@/components/home/HazardWatchGrid';
import { useHazardQuery } from '@/hooks/useHazardQuery';
import { useLocation } from '@/hooks/useLocation';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { regionForPoint } from '@/lib/regions';
import { hoursForWindow, type EventScope, type WindowKey } from '@/lib/hazardModel';
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

// The USGS-vs-NCS box that used to live here is gone: source selection is the
// ingest pipeline's concern now, not this page's. Every count on Home reads the
// merged archive through the normalized layer, where all three agencies have
// already been reconciled into one event apiece.

export default function Home() {
  const { t } = useT();
  const { status: locationStatus, location, requestGeolocation, setManualLocation } = useLocation();

  // The window every card on this page is counted over. One control, one
  // window: the six cards used to each fetch their own span (24h to 90 days)
  // and present the results as if they were comparable.
  const [windowKey, setWindowKey] = useLocalStorageState<WindowKey>('home_window', '24h');

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
  // The scope every count on this page shares. No location resolved yet means
  // worldwide -- an honest wider answer rather than a guessed region.
  const scope = useMemo<EventScope>(
    () => (region ? { kind: 'region', regionId: region.id } : { kind: 'global' }),
    [region]
  );

  // The seismic strip reads through the same normalized layer and the same
  // window as the card grid below it, so the two cannot disagree. It used to
  // run its own live feed on a different window entirely.
  const seismic = useHazardQuery({
    types: ['earthquake'],
    scope,
    hours: hoursForWindow(windowKey),
    limit: 500,
    autoRefresh: true,
    refreshIntervalMs: 600_000,
  });

  // Pull country-specific safety info -- runs for both geolocation and
  // manually-entered locations.
  useEffect(() => {
    if (!location) return;

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

  // Only events with a real magnitude can be "strongest" -- some are reported
  // unmeasured, and comparing against null silently returned whichever happened
  // to be first, then threw on `.toFixed()` downstream.
  const strongest = useMemo(() => {
    const measured = seismic.events.filter(
      (e): e is typeof e & { severity: number } => e.severity !== null
    );
    if (measured.length === 0) return null;
    return measured.reduce((max, e) => (e.severity > max.severity ? e : max));
  }, [seismic.events]);

  // Only a source that actually answered may produce a count of 0. This is now
  // a single check on one status value rather than each surface re-deriving
  // "did this fail?" from a loading flag and an error string.
  const seismicUnknown = seismic.status !== 'ready';

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
                Scoped to{' '}
                <span className="font-medium text-foreground">{region.label}</span>
              </>
            )}
          </>
        }
      />

      <LocationPrompt status={locationStatus} onAllow={requestGeolocation} onManual={setManualLocation} />

      {seismic.offline && (
        <div className="mb-6 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
          <span className="font-medium">{t('offline.title')}</span> -- {t('offline.desc')}
        </div>
      )}

      {/* Input/output strip -- earthquakes only, on the same scope and window
          as the grid below. A combined meter across incomparable units (FRP,
          wind speed, magnitude) would be a number that means nothing. */}
      <ActivityMeters
        className="mb-8"
        label={region ? `Seismic · ${region.label}` : 'Seismic · Worldwide'}
        count={seismic.total}
        peakMag={strongest ? strongest.severity : null}
        unknown={seismicUnknown}
      />

      <HazardWatchGrid scope={scope} windowKey={windowKey} onWindowChange={setWindowKey} />

      {/* No earthquake feed here. This page is the all-hazard overview, and a
          list of individual quakes gave one of the six hazards a whole section
          of its own -- the Hazard Watch tile above is that hazard's place here,
          and the full feed lives in the Earthquake section. */}

      {/* SAFETY PROTOCOLS */}
      <section className="mb-12 border-t-2 border-accent/25 pt-10">
        <h2 className="glow-text mb-6 text-sm text-accent">{t('home.safetyFor', { country })}</h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel title={t('home.emergencyHotline')} titleAlign="left">
            {emergencyNum ? (
              // The number is the one thing on this page someone reads under
              // duress, so it gets the largest lit display on the face.
              <a
                href={`tel:${emergencyNum.replace(/[^0-9+]/g, '')}`}
                className="block transition-opacity hover:opacity-80"
                aria-label={`Call ${emergencyNum}`}
              >
                <Readout value={emergencyNum} ghostFor={emergencyNum} size="xl" align="center" unit="Tel" block />
              </a>
            ) : (
              <p className="text-xs leading-relaxed tracking-wider text-foreground-muted">
                No verified emergency number for {country}. Look up your local emergency
                number now, before you need it.
              </p>
            )}
          </Panel>

          <Panel title={t('home.protectionDua')} titleAlign="left" tone="dim">
            <p className="mb-3 text-right text-lg leading-loose text-foreground" dir="rtl">
              اللَّهُمَّ احْفَظْنَا مِنَ الزَّلَازِلِ وَالْمِحَنِ
            </p>
            <div className="space-y-1.5 border-t border-accent/25 pt-3">
              <p className="text-xs italic tracking-wider text-foreground-muted">
                &ldquo;Allahumma ahfizna min az-zalazil wal-mihan&rdquo;
              </p>
              <p className="text-xs tracking-wider text-foreground-subtle">
                O Allah, protect us from earthquakes and calamities.
              </p>
            </div>
          </Panel>
        </div>

        <Panel title={t('home.preparedness')} titleAlign="left" tone="dim" className="mt-5">
          <Accordion items={preparednessItems} />
        </Panel>
      </section>

      {/* Not safety information -- it was sitting under the "Safety information
          for {country}" heading, which claimed it as such. */}
      <ShareAppCard />

    </div>
  );
}
