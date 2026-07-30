import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { log } from '@/lib/logger';
import { regionForPoint } from '@/lib/regions';

export const dynamic = 'force-dynamic';

// Aggregated stats over the `hazard_events` archive (populated by
// /api/ingest). Runs server-side with the service-role key since that table
// has no public RLS policy -- see the init_schema migration for why.
//
// Generalized from an earlier earthquake-only version -- `hazardType`
// accepts a comma-separated list (e.g. `cyclone,severe_weather`), same
// convention already used by /api/hazards, and defaults to 'earthquake' so
// the original caller (no `hazardType` param at all) is unaffected.
//
// Optional lat/lng scopes the result to the caller's auto-detected region
// (lib/regions.ts) -- region is computed here from the table's existing
// lat/lng columns rather than stored, so no migration was needed. Omitting
// lat/lng returns the unfiltered worldwide aggregate (used by every trends
// page before location is resolved/granted).
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    // Number.isFinite guard -- a non-numeric `?days=` would otherwise
    // propagate NaN through Math.max/Math.min, and
    // `new Date(NaN).toISOString()` throws an uncaught RangeError (this
    // used to run before the try block even started).
    const daysParam = Number(searchParams.get('days') || '30');
    const days = Math.min(365, Math.max(1, Number.isFinite(daysParam) ? daysParam : 30));
    const hazardTypeParam = searchParams.get('hazardType') || 'earthquake';
    const hazardTypes = hazardTypeParam.split(',').map((t) => t.trim()).filter(Boolean);
    // regionForPoint falls back to the *nearest* region by centre distance,
    // and every distance to NaN compares false -- so a non-numeric
    // `?lat=`/`?lng=` doesn't error, it silently scopes the whole response to
    // REGIONS[0] (South Asia). Only treat the point as given when it's real.
    const finiteParam = (raw: string | null): number | undefined => {
        if (raw === null || raw.trim() === '') return undefined;
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
    };
    const lat = finiteParam(searchParams.get('lat'));
    const lng = finiteParam(searchParams.get('lng'));
    const userRegion = lat !== undefined && lng !== undefined ? regionForPoint(lat, lng) : null;

    try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const admin = getSupabaseAdmin();
        const { data, error } = await admin
            .from('hazard_events')
            .select('magnitude, place, canonical_time, lat, lng')
            .in('hazard_type', hazardTypes)
            .gte('canonical_time', since)
            .order('canonical_time', { ascending: true });

        if (error) throw error;

        const allRows = data ?? [];
        const rows = userRegion
            ? allRows.filter((r) => r.lat !== null && r.lng !== null && regionForPoint(r.lat, r.lng).id === userRegion.id)
            : allRows;
        const total = rows.length;
        // Left `null` (not coerced to 0) when a hazard type has no numeric
        // severity data at all (volcano/landslide/tsunami all report
        // magnitude: null) -- same "don't fake a measurement" convention
        // /api/hazards already uses.
        const withValue = rows.filter((r): r is typeof r & { magnitude: number } => r.magnitude !== null);
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
        });
    } catch (err) {
        log.error('trends route failed', { error: String(err), hazardType: hazardTypeParam });
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
