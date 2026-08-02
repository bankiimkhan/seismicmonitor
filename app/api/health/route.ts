import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Latest scraper_health row per source, for the About page's "current source
// health" notice -- makes scraper breakage visible to users instead of only
// living in server logs.
//
// The window has to reach back past the *least* frequently written source, not
// just one ingest run: the ingest job writes ~5 rows every 15 min but gates
// FIRMS to every 2h and EONET to every 1h, so a small limit covered barely an
// hour and those two never appeared on /about at all.
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, resetMs } = checkRateLimit(`health:${ip}`);
    if (!ok) {
        log.warn('health route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin
            .from('scraper_health')
            .select('source, status, checked_at')
            .order('checked_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        const latestBySource = new Map<string, { status: string; checked_at: string }>();
        for (const row of data ?? []) {
            if (!latestBySource.has(row.source)) {
                latestBySource.set(row.source, { status: row.status, checked_at: row.checked_at });
            }
        }

        return NextResponse.json({
            sources: [...latestBySource.entries()].map(([source, v]) => ({ source, ...v })),
        });
    } catch (err) {
        // Returns 503, not a 200 with `sources: []`. Masking the failure as a
        // successful empty response left /about rendering its loading ellipsis
        // forever, with no way for a reader (or a developer) to tell "no health
        // data recorded" apart from "the health store is unreachable".
        log.error('health route failed', { error: String(err) });
        return NextResponse.json({ error: 'Health data unavailable' }, { status: 503 });
    }
}
