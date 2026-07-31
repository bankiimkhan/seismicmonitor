// Daily IBTrACS best-track backfill. Runs at 06:00 UTC via pg_cron.
//
// Was /api/ingest-cyclone-history in the Next app. Kept separate from the
// 15-minute `ingest` function on purpose: a ~9MB download plus ~20K parsed rows
// plus ~41 batched upserts is real work that shouldn't share an invocation with
// the live poll. Best-track revisions also trickle in over days after a storm,
// not minutes, so daily is generous.
//
// Measured against the Edge Function limits before porting: the parse costs
// ~0.16s CPU (cap is 2s) and ~25MB heap (cap is 256MB). The ~10s download is
// I/O and does not count toward CPU. Total wall clock lands around 20s against
// a 150s ceiling.
//
// No merge engine and no hazard_events involvement -- this is a bulk historical
// archive, not a live occurrence feed.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { fetchIbtracsPoints } from '../_shared/ibtracs.ts';
import { log } from '../_shared/logger.ts';

const BATCH_SIZE = 500;

function getAdmin(): SupabaseClient {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (!url || !key) throw new Error('SUPABASE_URL / service role key are not available');
    return createClient(url, key, { auth: { persistSession: false } });
}

Deno.serve(async () => {
    try {
        const started = Date.now();
        const admin = getAdmin();
        const points = await fetchIbtracsPoints();

        let upserted = 0;
        for (let i = 0; i < points.length; i += BATCH_SIZE) {
            const rows = points.slice(i, i + BATCH_SIZE).map((p) => ({
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

        const result = { status: 'OK', fetched: points.length, upserted };
        log.info('ingest-cyclone-history run complete', { ...result, durationMs: Date.now() - started });
        return Response.json(result);
    } catch (err) {
        log.error('ingest-cyclone-history run failed', { error: String(err) });
        return Response.json({ status: 'ERROR', error: String(err) }, { status: 500 });
    }
});
