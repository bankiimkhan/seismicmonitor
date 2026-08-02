import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParam, finiteParamOr } from '@/lib/queryParams';
import { log } from '@/lib/logger';
import { regionForPoint } from '@/lib/regions';

export const dynamic = 'force-dynamic';

interface TrendRow {
    magnitude: number | null;
    place: string | null;
    canonical_time: string;
    lat: number;
    lng: number;
}

// PostgREST caps an unbounded select at max-rows (1000 on Supabase), silently.
// This route reduces its rows in JS -- it has to, because the region bucket
// comes from regionForPoint (lib/regions.ts), which is the single source of
// truth for that mapping and isn't worth duplicating in SQL -- so it has to
// page explicitly rather than assume one select returns everything. Without
// this, trends would start dropping its newest data the moment one hazard type
// crossed 1000 rows in the window, with no error anywhere.
const PAGE_SIZE = 1000;
// Bounds worst-case subrequests per invocation (Workers Free allows 50) and
// caps the reduce below. Far above the current table size.
const MAX_PAGES = 10;

async function fetchTrendRows(
    admin: SupabaseClient,
    hazardTypes: string[],
    since: string
): Promise<TrendRow[]> {
    const rows: TrendRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error } = await admin
            .from('hazard_events')
            .select('magnitude, place, canonical_time, lat, lng')
            .in('hazard_type', hazardTypes)
            .gte('canonical_time', since)
            .order('canonical_time', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;

        const batch = (data ?? []) as TrendRow[];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
    }
    return rows;
}

// Aggregated stats over the `hazard_events` archive. Runs server-side with the
// service-role key since that table has no public RLS policy -- see the
// init_schema migration for why.
//
// `hazardType` accepts a comma-separated list (e.g. `cyclone,severe_weather`),
// same convention as /api/hazards, and defaults to 'earthquake'.
//
// Optional lat/lng scopes the result to the caller's auto-detected region
// (lib/regions.ts) -- computed here from the table's existing lat/lng columns
// rather than stored, so no migration was needed. Omitting lat/lng returns the
// unfiltered worldwide aggregate.
export async function GET(req: NextRequest) {
    const ip = clientIpFrom(req.headers);
    const { ok, remaining, resetMs } = checkRateLimit(`trends:${ip}`);
    if (!ok) {
        log.warn('trends route rate limited', { ip });
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(365, Math.max(1, finiteParamOr(searchParams.get('days'), 30)));
    const hazardTypeParam = searchParams.get('hazardType') || 'earthquake';
    const hazardTypes = hazardTypeParam.split(',').map((t) => t.trim()).filter(Boolean);
    // regionForPoint falls back to the *nearest* region by centre distance, and
    // every distance to NaN compares false -- so a non-numeric `?lat=`/`?lng=`
    // wouldn't error, it would silently scope the whole response to REGIONS[0]
    // (South Asia). Only treat the point as given when it's real.
    const lat = finiteParam(searchParams.get('lat'));
    const lng = finiteParam(searchParams.get('lng'));
    const userRegion = lat !== undefined && lng !== undefined ? regionForPoint(lat, lng) : null;

    try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const allRows = await fetchTrendRows(getSupabaseAdmin(), hazardTypes, since);

        const rows = userRegion
            ? allRows.filter((r) => r.lat !== null && r.lng !== null && regionForPoint(r.lat, r.lng).id === userRegion.id)
            : allRows;
        const total = rows.length;
        // Left `null` (not coerced to 0) when a hazard type has no numeric
        // severity data at all (volcano/landslide/tsunami all report
        // magnitude: null) -- same "don't fake a measurement" convention
        // /api/hazards already uses.
        const withValue = rows.filter((r): r is TrendRow & { magnitude: number } => r.magnitude !== null);
        const avgValue = withValue.length > 0
            ? withValue.reduce((sum, r) => sum + r.magnitude, 0) / withValue.length
            : null;

        const byDay = new Map<string, number>();
        for (const r of rows) {
            const day = new Date(r.canonical_time).toISOString().slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + 1);
        }

        // Crude "region" bucket: last comma-delimited token of the place
        // string (e.g. "80km SW of Dhaka, Bangladesh" -> "Bangladesh").
        const byRegion = new Map<string, number>();
        for (const r of rows) {
            const parts = (r.place || 'Unknown').split(',');
            const region = parts[parts.length - 1]?.trim() || 'Unknown';
            byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
        }
        const topRegions = [...byRegion.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([region, count]) => ({ region, count }));

        return NextResponse.json({
            days,
            region: userRegion ? { id: userRegion.id, label: userRegion.label } : null,
            total,
            avgValue,
            byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
            topRegions,
        }, { headers: { 'X-RateLimit-Remaining': String(remaining) } });
    } catch (err) {
        log.error('trends route failed', { error: String(err), hazardType: hazardTypeParam });
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
