"use client";
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HazardTrends } from '@/components/HazardTrends';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';

interface StormSummary {
  sid: string;
  name: string;
  season: number;
  basin: string;
  peakWindKt: number | null;
  peakCategory: number | null;
  firstTime: string;
  lastTime: string;
}

const BASIN_LABELS: Record<string, string> = {
  NA: 'North Atlantic', EP: 'East Pacific', WP: 'West Pacific',
  NI: 'North Indian', SI: 'South Indian', SP: 'South Pacific', SA: 'South Atlantic',
};

// Storm-level historical summaries from IBTrACS (see lib/ibtracs.ts) --
// deliberately a different shape/table from hazard_events: one row per storm
// (aggregated across all its track points), not one row per point. Not
// live-polled -- this is a bulk archive refreshed once a day by the
// ingest-cyclone-history Edge Function, so a plain one-shot fetch (same pattern as
// app/about/page.tsx's health fetch) is enough, no AbortController/polling
// machinery needed. Lives on Trends (not the live Global listing) since
// storm-season history fits "trends" better than a live-advisory feed.
function RecentSeasons() {
  const [storms, setStorms] = useState<StormSummary[] | null>(null);
  const [error, setError] = useState(false);
  // Bumped by the retry button. Re-setting `season` to its current value would
  // not re-run the effect -- React bails out of an identical state update.
  const [reloadKey, setReloadKey] = useState(0);
  const [season, setSeason] = useLocalStorageState('cyclone_history_season', '');

  useEffect(() => {
    // `error` is tracked separately from an empty `storms` array. Collapsing a
    // failed request into `setStorms([])` rendered "No historical storms found
    // -- the daily archive sync may not have run", which is both wrong and
    // actively misleading when the sync did run and the *read* is what broke.
    let cancelled = false;
    // Reset before the new fetch settles so a season switch doesn't briefly
    // show the previous season's rows under the new selection -- same
    // one-time reconciliation pattern as components/HazardTrends.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorms(null);
    setError(false);
    const params = new URLSearchParams({ limit: '50' });
    if (season) params.set('season', season);
    fetch(`/api/cyclone-history?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { if (!cancelled) setStorms(d.storms ?? []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [season, reloadKey]);

  const seasonOptions = Array.from({ length: 4 }, (_, i) => new Date().getUTCFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-foreground">Recent Seasons</p>
        <div className="w-40">
          <Label htmlFor="cyclone-history-season">Season</Label>
          <select
            id="cyclone-history-season"
            className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            <option value="">All seasons</option>
            {seasonOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Couldn't load storm history"
          message="The historical cyclone archive is unreachable right now."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      )}
      {!error && storms === null && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}
      {!error && storms?.length === 0 && (
        <EmptyState title="No historical storms found" description="No IBTrACS records for this season yet -- the daily archive sync may not have run." />
      )}
      {storms && storms.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
          <div className="max-h-[50vh] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">Storm</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">Basin</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">Season</th>
                  <th className="px-2 py-3 text-right text-xs font-semibold uppercase tracking-wide text-foreground-muted">Peak Wind (kts)</th>
                  <th className="px-2 py-3 text-right text-xs font-semibold uppercase tracking-wide text-foreground-muted">Peak Category</th>
                </tr>
              </thead>
              <tbody>
                {storms.map((s) => (
                  <tr key={s.sid} className="border-b border-border/60 last:border-b-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-2 py-3 text-foreground-muted">{BASIN_LABELS[s.basin] ?? s.basin}</td>
                    <td className="px-2 py-3 text-foreground-muted">{s.season}</td>
                    <td className="px-2 py-3 text-right font-mono text-foreground">{s.peakWindKt ?? '—'}</td>
                    <td className="px-2 py-3 text-right font-mono text-foreground-muted">{s.peakCategory ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CycloneTrendsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 pb-8 md:px-8 md:pb-10">
      <HazardTrends hazardSlug="cyclone" />
      <div className="border-t border-border pt-8">
        <RecentSeasons />
      </div>
    </div>
  );
}
