import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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

// Aggregates cyclone_tracks (populated by /api/ingest-cyclone-history, see
// lib/ibtracs.ts) into one summary row per storm -- storm-level history,
// not raw track points. A full point-by-point track map is real GIS/map
// work and out of scope here, same "historical replay" boundary the
// architecture review drew as a future feature, not this pass.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const season = searchParams.get('season') ? Number(searchParams.get('season')) : undefined;
    const basin = searchParams.get('basin') ?? undefined;
    const limit = Math.min(200, Number(searchParams.get('limit') ?? '50'));

    try {
        const admin = getSupabaseAdmin();
        let query = admin
            .from('cyclone_tracks')
            .select('sid, name, season, basin, wind_kt, category, iso_time')
            .order('iso_time', { ascending: true });

        if (season !== undefined) query = query.eq('season', season);
        if (basin) query = query.eq('basin', basin);

        const { data, error } = await query;
        if (error) throw error;

        const bySid = new Map<string, StormSummary>();
        for (const row of data ?? []) {
            const existing = bySid.get(row.sid);
            if (!existing) {
                bySid.set(row.sid, {
                    sid: row.sid,
                    name: row.name,
                    season: row.season,
                    basin: row.basin,
                    peakWindKt: row.wind_kt,
                    peakCategory: row.category,
                    firstTime: row.iso_time,
                    lastTime: row.iso_time,
                });
            } else {
                existing.peakWindKt = Math.max(existing.peakWindKt ?? -Infinity, row.wind_kt ?? -Infinity);
                if (existing.peakWindKt === -Infinity) existing.peakWindKt = null;
                existing.peakCategory = Math.max(existing.peakCategory ?? -Infinity, row.category ?? -Infinity);
                if (existing.peakCategory === -Infinity) existing.peakCategory = null;
                existing.lastTime = row.iso_time; // rows are ordered by iso_time ascending, so the latest wins
            }
        }

        const storms = [...bySid.values()]
            .sort((a, b) => b.lastTime.localeCompare(a.lastTime))
            .slice(0, limit);

        return NextResponse.json({ storms });
    } catch (error) {
        log.error('cyclone-history route failed', { error: String(error) });
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
