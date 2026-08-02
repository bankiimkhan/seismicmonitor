import { NextRequest, NextResponse } from 'next/server';
import { fetchEarthquakeFeatures } from '@/lib/earthquakes';
import { checkRateLimit, clientIpFrom } from '@/lib/rateLimit';
import { finiteParam } from '@/lib/queryParams';
import { resolvePreferredSource } from '@/lib/sourcePriority';
import { log } from '@/lib/logger';

// The route itself must stay dynamic (it reads query params on every
// request), but the upstream USGS/NCS fetches inside fetchEarthquakeFeatures
// are cached for 30s via Next's Data Cache, so concurrent pollers within
// that window share one upstream request instead of hammering USGS/NCS.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const { ok, remaining, resetMs } = checkRateLimit(`earthquakes:${ip}`);
  if (!ok) {
    log.warn('earthquakes route rate limited', { ip });
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(resetMs / 1000)) } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);

    const lat = finiteParam(searchParams.get('lat'));
    const lng = finiteParam(searchParams.get('lng'));
    const range = finiteParam(searchParams.get('range'));
    const limit = finiteParam(searchParams.get('limit'));
    const hours = finiteParam(searchParams.get('hours'));
    const minMag = finiteParam(searchParams.get('minMag'));
    const endTime = finiteParam(searchParams.get('endTime'));

    // Default (no explicit ?source=) now resolves via the region-based
    // priority router instead of always hardcoding 'usgs' -- e.g. South Asia
    // coordinates resolve to NCS first. The router's list can also include
    // 'gdacs' (used by the ingest/merge pipeline), but that's never first in
    // any region's list, so this always lands on 'usgs' or 'ncs' -- both of
    // which fetchEarthquakeFeatures already knows how to fetch live.
    const source = searchParams.get('source') || resolvePreferredSource(lat, lng)[0];

    const { features, sourceStatus } = await fetchEarthquakeFeatures({
      source, lat, lng, range, limit, hours, minMag, endTime,
    });

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        metadata: { source, status: sourceStatus },
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  } catch (error) {
    log.error('earthquakes route failed', { error: String(error) });
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
