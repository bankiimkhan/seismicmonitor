import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Latest scraper_health row per source, for the About page's "current
// source health" notice (audit 3.3/6.3/9.3) -- makes NCS-scraper breakage
// visible to users instead of only living in server logs.
export async function GET() {
    try {
        const admin = getSupabaseAdmin();
        // hazard_type is selected but not yet grouped on -- the dedupe below
        // is per source, and no source spans two hazard types.
        //
        // The window has to be wide enough to reach back past the *least*
        // frequently written source, not just one ingest run: /api/ingest
        // writes ~5 rows every 15 min, but gates FIRMS to every 2h and EONET
        // to every 1h, so the old limit of 20 covered barely an hour and
        // those two sources never appeared on /about at all.
        const { data, error } = await admin
            .from('scraper_health')
            .select('source, status, checked_at, hazard_type')
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
        log.warn('health route: supabase unavailable', { error: String(err) });
        return NextResponse.json({ sources: [] });
    }
}
