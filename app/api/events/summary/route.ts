import { NextRequest, NextResponse } from 'next/server';
import { queryEvents, countByDay, headlineEvent } from '@/lib/hazardEvents';
import { parseScope, scopeLabel, type HazardSummaryEntry } from '@/lib/hazardModel';
import { HAZARD_SLUGS, HAZARD_CONFIG } from '@/lib/hazardConfig';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParamOr } from '@/lib/queryParams';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Every Home card's numbers in one response.
 *
 * Home used to mount six independent HazardWatchCards, each running its own
 * fetch with its own window (`watchHours` differed per hazard: 24h for
 * wildfire, 720h for landslide, 2160h for volcano). So the grid's six counts
 * described six different spans of time while sitting under one heading, and
 * the 24H/7D control now above them would have had nothing coherent to switch.
 *
 * Serving them together also means one window, one scope, one archive read --
 * the counts cannot disagree with each other, and they cannot disagree with the
 * event list a card opens, because that list re-runs the identical query
 * through the same layer.
 *
 * A failure fails the whole response rather than degrading per-card. Six cards
 * where two silently show stale or absent numbers is exactly the ambiguity this
 * work is meant to remove.
 */
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, remaining, resetMs } = checkRateLimit(`events-summary:${ip}`);
    if (!ok) {
        log.warn('events summary route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const scope = parseScope(searchParams);
    const hours = Math.min(8760, Math.max(1, finiteParamOr(searchParams.get('hours'), 24)));

    try {
        // One read covering every hazard type, then split by slug in memory.
        // Six scoped queries would be six chances for the window to drift and
        // six subrequests against the Workers limit.
        const allTypes = HAZARD_SLUGS.flatMap((slug) =>
            HAZARD_CONFIG[slug].hazardType.split(',').map((t) => t.trim())
        );

        const { events, window } = await queryEvents({
            hazardTypes: allTypes,
            scope,
            hours,
            // No limit: these are counts, and a cap would understate them. The
            // window is short (24h/7d) and the layer pages explicitly.
        });

        const hazards: HazardSummaryEntry[] = HAZARD_SLUGS.map((slug) => {
            const types = new Set(HAZARD_CONFIG[slug].hazardType.split(',').map((t) => t.trim()));
            const mine = events.filter((e) => types.has(e.hazardType));
            const top = headlineEvent(mine);

            return {
                slug,
                count: mine.length,
                headline: top
                    ? { id: top.id, place: top.place, severity: top.severity, time: top.time }
                    : null,
                trend: countByDay(mine).map((d) => d.count),
            };
        });

        return NextResponse.json(
            { scope: { kind: scope.kind, label: scopeLabel(scope) }, window, hazards },
            { headers: { 'X-RateLimit-Remaining': String(remaining) } }
        );
    } catch (error) {
        log.error('events summary route failed', { error: String(error), scope: scope.kind });
        return NextResponse.json({ error: 'Could not reach the hazard archive' }, { status: 500 });
    }
}
