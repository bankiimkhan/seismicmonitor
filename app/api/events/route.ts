import { NextRequest, NextResponse } from 'next/server';
import { queryEvents } from '@/lib/hazardEvents';
import { parseScope } from '@/lib/hazardModel';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParam, finiteParamOr } from '@/lib/queryParams';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * The single event-list endpoint, serving every scope the UI offers: Regional
 * (`scope=region`), Global (`scope=global`), the map, and the per-card event
 * lists reached from Home. Retired `scope=point` links resolve to global --
 * see parseScope.
 *
 * It replaces the split where earthquakes came from a live upstream and every
 * other hazard came from the archive, which is what allowed the same window to
 * be counted two different ways. Everything here reads lib/hazardEvents.ts, so
 * region classification, deduplication and the time window are applied once.
 *
 * On failure it returns a 5xx with no `events` key at all. That is deliberate:
 * a client must not be able to mistake an outage for an empty result, so there
 * is nothing shaped like a count to read on the error path.
 */
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, remaining, resetMs } = checkRateLimit(`events:${ip}`);
    if (!ok) {
        log.warn('events route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    const { searchParams } = new URL(req.url);

    const typesParam = searchParams.get('types');
    const hazardTypes = typesParam
        ? typesParam.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;

    const scope = parseScope(searchParams);

    // An absent `hours` means every record, not a default window. Regional and
    // Global rely on this: they are the complete history of a place, and a
    // silent 24h default would have them quietly omit almost all of it.
    const rawHours = finiteParam(searchParams.get('hours'));
    const hours = rawHours === undefined ? undefined : Math.min(87600, Math.max(1, rawHours));

    const limit = Math.min(2000, Math.max(1, finiteParamOr(searchParams.get('limit'), 300)));
    const minSeverity = finiteParam(searchParams.get('minSeverity'));
    const country = searchParams.get('country') || undefined;
    const until = finiteParam(searchParams.get('until'));

    try {
        const result = await queryEvents({ hazardTypes, scope, hours, limit, minSeverity, country, until });
        return NextResponse.json(result, {
            headers: { 'X-RateLimit-Remaining': String(remaining) },
        });
    } catch (error) {
        log.error('events route failed', { error: String(error), types: typesParam, scope: scope.kind });
        return NextResponse.json({ error: 'Could not reach the hazard archive' }, { status: 500 });
    }
}
