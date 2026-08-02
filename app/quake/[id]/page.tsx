"use client";
import { useEffect, useMemo, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/effects/Reveal';
import { getSeverity, Tag, type Severity } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChevronLeftIcon, ExternalLinkIcon } from '@/components/ui/icons';
import { ShareButton } from '@/components/ShareButton';
import { QuakeMap } from '@/components/QuakeMap';
import { FeltReportForm } from '@/components/FeltReportForm';
import { FeltReportSummary } from '@/components/FeltReportSummary';
import { useLocation } from '@/hooks/useLocation';
import { distanceKm, formatDistanceKm, formatDepthKm } from '@/lib/geo';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { useT } from '@/lib/i18n/LocaleProvider';
import { getStashedQuake } from '@/lib/quakeCache';

interface AftershockForecastBin { magnitude: number; probability: number; median: number; }
interface AftershockForecast {
    advisoryTimeFrame: string;
    modelName: string;
    creationTime: number;
    nextForecastTime: number;
    primaryWindow: { label: string; timeStart: number; timeEnd: number; bins: AftershockForecastBin[] };
    observations: { magnitude: number; count: number }[];
}

interface QuakeDetail {
    id: string;
    source?: string;
    // Nullable: /api/quake/[id] resolves out of `hazard_events`, whose
    // `magnitude` column is null by design for anything without a numeric
    // severity metric, and USGS's own detail feed reports `mag: null` for
    // some events too.
    mag: number | null;
    place: string;
    time: number;
    lat: number;
    lng: number;
    depth?: number;
    url?: string;
    aftershockForecast?: AftershockForecast | null;
}

const SEVERITY_TEXT: Record<Severity, string> = {
    stable: 'text-success',
    warning: 'text-warning',
    critical: 'text-danger',
};

export default function QuakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Route params can arrive still percent-encoded (observed for ids
    // containing reserved characters, e.g. NCS's "YYYY-MM-DD HH:MM:SS
    // Place" ids with spaces/colons -- USGS's plain alphanumeric ids never
    // exposed this). Decode once so it matches the raw id used as the
    // sessionStorage key in lib/quakeCache.ts.
    const { id: rawId } = usePromise(params);
    const id = decodeURIComponent(rawId);
    const { t } = useT();
    const router = useRouter();
    const { location } = useLocation();

    // "Back" used to be a hard link to "/", so arriving here from the global
    // list, a map marker or a search result and pressing it dumped you on the
    // Overview page instead of the list you were reading. Real history where
    // there is any; Overview only for a cold landing (shared link, new tab).
    const goBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
    };

    // Instant path: if this page was reached by clicking a card/marker that
    // was already showing full quake data, QuakeList/QuakeMap stashed it in
    // sessionStorage just before navigating -- use it immediately rather
    // than waiting on a network round-trip (and, for NCS events, rather
    // than depending on the ingest cron having already run -- see
    // lib/quakeCache.ts). `sessionStorage` doesn't exist during SSR, so the
    // initial state must be deterministically `null` on both server and
    // client (matching), and the stash check has to happen in an effect --
    // reading it in a lazy useState initializer would make the client's
    // pre-hydration first render diverge from the server-rendered HTML
    // whenever a stash exists, causing a hydration mismatch.
    const [quake, setQuake] = useState<QuakeDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const stashed = getStashedQuake(id);
        if (stashed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQuake(stashed);
        }
        // Always fetch even when a stash exists: the stash (lib/quakeCache.ts)
        // only carries the fields a list row already had (mag/place/time/...),
        // never server-only enrichment like aftershockForecast -- without
        // this, the instant-path (by far the most common navigation, per the
        // comment above) would never show a forecast at all.
        let cancelled = false;
        fetch(`/api/quake/${encodeURIComponent(id)}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => { if (!cancelled) setQuake(data); })
            .catch(() => {
                // A stash is already showing something reasonable -- don't
                // blank a working view just because the enrichment fetch failed.
                if (!cancelled && !stashed) setNotFound(true);
            });
        return () => { cancelled = true; };
    }, [id]);

    // Memoized, and declared before the early returns below so the hook order
    // stays stable. Passing inline literals here meant a new array/object
    // identity on every render, and QuakeMap's marker-sync effect keys on
    // those -- so the pin and its popup were destroyed and recreated on each
    // parent re-render (useLocation state settling causes several).
    const mapQuakes = useMemo(
        () => (quake ? [{ id: quake.id, lat: quake.lat, lng: quake.lng, mag: quake.mag, place: quake.place }] : []),
        [quake]
    );
    const mapCenter = useMemo(
        () => (quake ? { lat: quake.lat, lng: quake.lng } : undefined),
        [quake]
    );

    if (notFound) {
        return (
            <div className="mx-auto w-full max-w-2xl px-4 py-12">
                <ErrorState message="This event hasn't been indexed yet -- try again in a few minutes." />
            </div>
        );
    }

    if (!quake) {
        return (
            <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
                <Skeleton className="mb-6 h-44 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    // An unknown magnitude reads as "no measurement", not as a calm one --
    // `.toFixed()` on it used to throw and blank the whole detail page.
    const severity = quake.mag !== null ? getSeverity(quake.mag) : null;
    const distance = location ? distanceKm(location, { lat: quake.lat, lng: quake.lng }) : null;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
            <button
                type="button"
                onClick={goBack}
                className="link-underline mb-6 inline-flex items-center gap-1 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
                <ChevronLeftIcon size={14} />
                {t('quake.backToList')}
            </button>

            <Reveal variant="scale">
            <Card elevated className="mb-6 rounded-xl">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-foreground">{quake.place}</h1>
                        <p className="mt-1 font-mono text-xs text-foreground-muted">
                            {formatRelativeTime(quake.time)} · {new Date(quake.time).toLocaleString()}
                        </p>
                    </div>
                    <div className={`flex-shrink-0 font-mono text-4xl font-bold tabular-nums ${severity ? SEVERITY_TEXT[severity] : 'text-foreground-subtle'}`}>
                        {quake.mag !== null ? quake.mag.toFixed(1) : '—'}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    {quake.source && <Tag>{quake.source}</Tag>}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                    {quake.depth !== undefined && (
                        <div>
                            <dt className="text-xs text-foreground-subtle">{t('quake.depth')}</dt>
                            <dd className="font-medium text-foreground">{formatDepthKm(quake.depth)}</dd>
                        </div>
                    )}
                    {distance !== null && (
                        <div>
                            <dt className="text-xs text-foreground-subtle">{t('quake.distance')}</dt>
                            <dd className="font-medium text-foreground">{formatDistanceKm(distance)}</dd>
                        </div>
                    )}
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <ShareButton title={quake.place} url={shareUrl} eventName="share_quake_detail" />
                    {quake.url && (
                        <a href={quake.url} target="_blank" rel="noopener noreferrer" className="link-underline flex items-center gap-1 text-xs font-medium text-foreground-muted transition-colors hover:text-accent">
                            {t('quake.openOriginal')}
                            <ExternalLinkIcon size={12} />
                        </a>
                    )}
                </div>
            </Card>
            </Reveal>

            <div className="mb-6">
                <QuakeMap
                    quakes={mapQuakes}
                    center={mapCenter}
                    zoom={7}
                    interactive={false}
                    className="h-64"
                />
            </div>

            {quake.aftershockForecast && (
                <Card className="mb-6">
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-foreground">Aftershock Forecast</p>
                        <Tag>USGS Forecast</Tag>
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                        {quake.aftershockForecast.modelName} · updated {formatRelativeTime(quake.aftershockForecast.creationTime)}, next update {formatRelativeTime(quake.aftershockForecast.nextForecastTime)}
                    </p>

                    {quake.aftershockForecast.observations[0] && (
                        <p className="mt-3 text-sm text-foreground">
                            {quake.aftershockForecast.observations[0].count} M{quake.aftershockForecast.observations[0].magnitude.toFixed(1)}+ aftershock{quake.aftershockForecast.observations[0].count === 1 ? '' : 's'} observed so far
                        </p>
                    )}

                    <div className="mt-3 overflow-x-auto border-t border-border pt-3">
                        <table className="w-full min-w-[280px] border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground-muted">Magnitude</th>
                                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-foreground-muted">Probability</th>
                                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-foreground-muted">Expected</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quake.aftershockForecast.primaryWindow.bins.map((bin) => (
                                    <tr key={bin.magnitude} className="border-t border-border/60">
                                        <td className="py-1.5 font-mono text-foreground-muted">≥ M{bin.magnitude.toFixed(1)}</td>
                                        <td className="py-1.5 text-right font-mono font-medium text-foreground">{(bin.probability * 100).toFixed(1)}%</td>
                                        <td className="py-1.5 text-right font-mono text-foreground-muted">{bin.median}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="mt-2 text-xs text-foreground-subtle">Probability of one or more aftershocks in the next {quake.aftershockForecast.primaryWindow.label.toLowerCase()}.</p>
                    </div>

                    <p className="mt-3 border-t border-border pt-3 text-xs text-foreground-subtle">
                        Probabilistic forecast from USGS&apos;s aftershock model -- not a prediction of whether or when a specific aftershock will occur.
                    </p>
                </Card>
            )}

            <Card>
                <p className="font-semibold text-foreground">{t('quake.feltIt')}</p>
                <p className="mb-3 mt-1 text-sm text-foreground-muted">{t('quake.feltItDesc')}</p>
                <FeltReportForm quakeId={quake.id} onSubmitted={() => setRefreshKey((k) => k + 1)} />
                <div className="mt-3">
                    <FeltReportSummary quakeId={quake.id} refreshKey={refreshKey} />
                </div>
            </Card>
        </div>
    );
}
