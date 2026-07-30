import { NextRequest, NextResponse } from 'next/server';
import { fetchIbtracsPoints } from '@/lib/ibtracs';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
// Confirmed live: downloading the real ~9.5MB IBTrACS file alone took ~20s
// in this environment, before parsing ~20K rows or upserting ~41 batches --
// the whole run needs more than Vercel's 10s default. This raises the
// function's own execution-time budget, but it's still capped by the
// account's plan: Hobby caps every function at 10s regardless of this
// setting; Pro allows up to 300s (default 60s unless raised in project
// settings); Enterprise up to 900s. If this route times out in production,
// that's almost certainly a Hobby-plan ceiling, not a bug here.
export const maxDuration = 60;

// Batch size for cyclone_tracks upserts -- ~20K rows across ~41 batches,
// same reasoning as HAZARD_INGEST_BATCH_SIZE in app/api/ingest/route.ts.
const BATCH_SIZE = 500;

// Separate route + its own daily cron entry (see vercel.json), deliberately
// NOT folded into /api/ingest's 15-min cycle: a 9.5MB download + parsing
// ~20K rows + ~41 batched upserts is real work that shouldn't share a
// request with the earthquake-merge/wildfire/EONET/cyclone-live steps that
// need to stay fast on that cadence. Best-track revisions also trickle in
// over days/weeks after a storm, not minutes -- a daily cron is generous.
// No merge engine, no hazard_events involvement -- this is a bulk
// historical archive (up to 3 years back), not a live occurrence feed; see
// lib/ibtracs.ts's module comment for why it gets its own table/shape.
export async function GET(req: NextRequest) {
    if (!isAuthorizedCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const points = await fetchIbtracsPoints();

    let upserted = 0;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        const rows = batch.map((p) => ({
            id: p.id,
            sid: p.sid,
            season: p.season,
            basin: p.basin,
            subbasin: p.subbasin,
            name: p.name,
            iso_time: p.isoTime,
            nature: p.nature,
            lat: p.lat,
            lng: p.lng,
            wind_kt: p.windKt,
            pressure_mb: p.pressureMb,
            category: p.category,
        }));
        const { error } = await admin.from('cyclone_tracks').upsert(rows, { onConflict: 'id' });
        if (error) {
            log.error('ingest-cyclone-history: upsert failed', { error: error.message });
            continue;
        }
        upserted += rows.length;
    }

    log.info('ingest-cyclone-history run complete', { fetched: points.length, upserted });
    return NextResponse.json({ status: 'OK', fetched: points.length, upserted });
}
