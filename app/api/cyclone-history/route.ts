import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParam, finiteParamOr } from '@/lib/queryParams';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

// Storm-level history from cyclone_tracks (populated daily by the
// ingest-cyclone-history Edge Function, see lib/ibtracs.ts) -- one summary row
// per storm, not raw track points. A full point-by-point track map is real
// GIS/map work and stays out of scope here.
//
// The fold happens in Postgres (cyclone_storm_summaries, see
// supabase/migrations/*_add_cyclone_storm_summaries_fn.sql), not here. Doing it
// in this handler meant selecting every track point, and PostgREST caps an
// unbounded select at max-rows (1000) -- so the aggregation silently saw only
// the oldest 1000 of 20k+ points and returned 13 of 344 storms, none newer than
// 2023, under a heading that says "Recent Seasons".
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, remaining, resetMs } = checkRateLimit(`cyclone-history:${ip}`);
    if (!ok) {
        log.warn('cyclone-history route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    const { searchParams } = new URL(req.url);
    // Guarded like every sibling route: an unguarded `?season=abc` used to send
    // NaN into the PostgREST filter (500), and `?limit=abc` produced
    // `slice(0, NaN)` -- an empty list returned as a successful 200.
    const season = finiteParam(searchParams.get('season'));
    const basin = searchParams.get('basin') ?? undefined;
    const limit = Math.min(200, Math.max(1, finiteParamOr(searchParams.get('limit'), 50)));

    try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.rpc('cyclone_storm_summaries', {
            p_season: season ?? null,
            p_basin: basin ?? null,
            p_limit: limit,
        });
        if (error) throw error;

        // Row shape is snake_case out of Postgres; the client contract
        // (app/cyclone/trends/page.tsx's StormSummary) is camelCase.
        const storms: StormSummary[] = (data ?? []).map((row: {
            sid: string; name: string; season: number; basin: string;
            peak_wind_kt: number | null; peak_category: number | null;
            first_time: string; last_time: string;
        }) => ({
            sid: row.sid,
            name: row.name,
            season: row.season,
            basin: row.basin,
            peakWindKt: row.peak_wind_kt,
            peakCategory: row.peak_category,
            firstTime: row.first_time,
            lastTime: row.last_time,
        }));

        return NextResponse.json({ storms }, {
            headers: {
                'X-RateLimit-Remaining': String(remaining),
                // Refreshed once a day by the 06:00 UTC cron; recomputing it per
                // page load was pure waste.
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
            },
        });
    } catch (error) {
        log.error('cyclone-history route failed', { error: String(error) });
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
