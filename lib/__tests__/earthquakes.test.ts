import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildBBoxFromCenter, dedupeAndSort, fetchEarthquakeFeatures, type EarthquakeFeature } from '../earthquakes';

function feature(overrides: Partial<EarthquakeFeature['properties']> & { id?: string }): EarthquakeFeature {
    return {
        type: 'Feature',
        id: overrides.id ?? 'a',
        properties: {
            mag: 4.5,
            place: 'Test Place',
            time: 1000,
            url: 'https://example.com',
            ...overrides,
        },
        geometry: { type: 'Point', coordinates: [90, 23, 10] },
    };
}

describe('buildBBoxFromCenter', () => {
    it('builds a symmetric box around the center point', () => {
        const bbox = buildBBoxFromCenter(23, 90, 15);
        expect(bbox).toEqual({ minLat: 8, maxLat: 38, minLng: 75, maxLng: 105 });
    });

    // USGS FDSN 400s on a latitude outside [-90, 90]. The Local page uses a
    // 20-degree box, so every user above ~70N built an invalid query.
    it('clamps latitude to the poles', () => {
        expect(buildBBoxFromCenter(78, 15, 20).maxLat).toBe(90);
        expect(buildBBoxFromCenter(-78, 15, 20).minLat).toBe(-90);
    });

    // Longitude is left alone on purpose: USGS accepts [-360, 360] so a box
    // spanning the antimeridian stays contiguous instead of being split.
    it('leaves an antimeridian-spanning longitude span intact', () => {
        const bbox = buildBBoxFromCenter(0, 175, 20);
        expect(bbox.minLng).toBe(155);
        expect(bbox.maxLng).toBe(195);
    });
});

describe('dedupeAndSort', () => {
    it('removes duplicates keyed by time+place+magnitude', () => {
        const a = feature({ id: 'a', time: 1000, place: 'Dhaka', mag: 4.5 });
        const b = feature({ id: 'b', time: 1000, place: 'Dhaka', mag: 4.5 }); // same key, different id
        const c = feature({ id: 'c', time: 2000, place: 'Chittagong', mag: 5.0 });

        const result = dedupeAndSort([a, b, c], 10);
        expect(result).toHaveLength(2);
    });

    it('sorts newest first', () => {
        const older = feature({ id: 'old', time: 1000 });
        const newer = feature({ id: 'new', time: 5000 });

        const result = dedupeAndSort([older, newer], 10);
        expect(result.map((f) => f.id)).toEqual(['new', 'old']);
    });

    it('respects the limit after dedupe', () => {
        const features = Array.from({ length: 5 }, (_, i) =>
            feature({ id: String(i), time: i, place: `Place ${i}` })
        );
        const result = dedupeAndSort(features, 3);
        expect(result).toHaveLength(3);
    });
});

describe('fetchEarthquakeFeatures time window', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function stubFetch() {
        const fetchMock = vi.fn<(input: string | URL) => Promise<Response>>(
            async () => new Response(JSON.stringify({ features: [] }), { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    function requestedUrl(fetchMock: ReturnType<typeof stubFetch>) {
        return new URL(fetchMock.mock.calls[0][0]);
    }

    it('asks upstream for exactly the requested past window when endTime is given', async () => {
        const fetchMock = stubFetch();
        const dayStart = Date.parse('2026-03-04T00:00:00Z');
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;

        await fetchEarthquakeFeatures({ source: 'usgs', hours: 24, endTime: dayEnd });

        const url = requestedUrl(fetchMock);
        expect(url.searchParams.get('starttime')).toBe(new Date(dayStart).toISOString());
        expect(url.searchParams.get('endtime')).toBe(new Date(dayEnd).toISOString());
    });

    it('leaves the window open-ended for the ordinary "last N hours" case', async () => {
        const fetchMock = stubFetch();

        await fetchEarthquakeFeatures({ source: 'usgs', hours: 24 });

        const url = requestedUrl(fetchMock);
        expect(url.searchParams.get('endtime')).toBeNull();
        expect(url.searchParams.get('starttime')).not.toBeNull();
    });
});

describe('fetchEarthquakeFeatures upstream failure handling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    // An upstream 5xx is not "no earthquakes occurred". Swallowing it into an
    // empty feed rendered a USGS outage as a confident "No earthquakes found".
    it('propagates a non-ok USGS response instead of reporting an empty feed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        await expect(fetchEarthquakeFeatures({ source: 'usgs', hours: 24 })).rejects.toThrow(/503/);
    });

    // source='both' is the one path that should still degrade quietly: it has a
    // second upstream to fall back on, so one failing feed must not blank it.
    it('still degrades gracefully for source=both when one upstream fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
            if (String(input).includes('usgs.gov')) return { ok: false, status: 500 } as unknown as Response;
            return new Response('<html></html>', { status: 200 });
        }));
        const { features } = await fetchEarthquakeFeatures({ source: 'both', hours: 24 });
        expect(features).toEqual([]);
    });

    // The ingest job keys off this flag: when NCS is unreadable it must NOT
    // archive the substituted USGS rows under agency 'ncs', or the merge engine
    // counts one USGS reading as two agencies agreeing and scores it 'high'.
    it('flags sourceStatus=fallback when NCS is unreadable and USGS stands in', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
            if (String(input).includes('seismo.gov.in')) return { ok: false, status: 502 } as unknown as Response;
            return new Response(JSON.stringify({ features: [] }), { status: 200 });
        }));
        const result = await fetchEarthquakeFeatures({ source: 'ncs', hours: 1, limit: 100 });
        expect(result.sourceStatus).toBe('fallback');
    });

    it('reports sourceStatus=online when NCS itself answers', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })));
        const result = await fetchEarthquakeFeatures({ source: 'ncs', hours: 1, limit: 100 });
        expect(result.sourceStatus).toBe('online');
    });
});

// NCS is a scrape of one static HTML page -- it takes no bbox, no time window
// and no limit. Every caller passes those anyway (they mean something for
// USGS), and the ncs branch used to discard them silently: Home asked for the
// last 24 hours inside the South Asia box and was handed the whole page, ~150
// events spanning ~17 days, which it then displayed as a live regional count.
describe('fetchEarthquakeFeatures narrows NCS to the requested query', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    /** One NCS page entry, timestamped in IST the way that page publishes. */
    function ncsRow(at: Date, mag: number, lat: number, lng: number, place: string) {
        const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
        const p = (n: number) => String(n).padStart(2, '0');
        const stamp = `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} `
            + `${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}:${p(ist.getUTCSeconds())} IST`;
        const json = JSON.stringify({
            event_name: `M: ${mag} - ${place}`,
            origin_time: stamp,
            lat_long: `${lat}, ${lng}`,
            magnitude_depth: `M: ${mag} , D: 10km`,
        });
        return `<div data-json='${json}'></div>`;
    }

    function stubNcsPage(rows: string[]) {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(`<html>${rows.join('')}</html>`, { status: 200 })));
    }

    const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    it('drops entries older than the requested window', async () => {
        stubNcsPage([
            ncsRow(minutesAgo(30), 4.1, 23, 90, 'Dhaka'),
            ncsRow(daysAgo(10), 5.2, 23, 90, 'Dhaka'),
        ]);

        const { features } = await fetchEarthquakeFeatures({ source: 'ncs', hours: 24, limit: 100 });

        expect(features).toHaveLength(1);
        expect(features[0].properties.mag).toBe(4.1);
    });

    it('drops entries outside the requested bounding box', async () => {
        stubNcsPage([
            ncsRow(minutesAgo(30), 4.1, 23, 90, 'Dhaka'),
            ncsRow(minutesAgo(30), 4.8, 35, 139, 'Tokyo'),
        ]);

        const { features } = await fetchEarthquakeFeatures({
            source: 'ncs', hours: 24, limit: 100, lat: 23, lng: 90, range: 15,
        });

        expect(features.map((f) => f.properties.place)).toEqual(['Dhaka']);
    });

    // buildBBoxFromCenter leaves longitude unclamped so an antimeridian box
    // stays contiguous (155 -> 195). A naive `lng <= maxLng` would then reject
    // everything west of the dateline that the box explicitly covers.
    it('keeps entries inside a box that spans the antimeridian', async () => {
        stubNcsPage([ncsRow(minutesAgo(30), 6.0, 0, -178, 'Fiji')]);

        const { features } = await fetchEarthquakeFeatures({
            source: 'ncs', hours: 24, limit: 100, lat: 0, lng: 175, range: 20,
        });

        expect(features).toHaveLength(1);
    });

    // The scrape is parsed in full and narrowed afterwards. Truncating to
    // `limit` during parsing would drop matching events sitting further down
    // the page behind ones the window excludes.
    it('does not let out-of-window entries consume the limit', async () => {
        stubNcsPage([
            ...Array.from({ length: 5 }, (_, i) => ncsRow(daysAgo(5 + i), 5.0, 23, 90, `Old ${i}`)),
            ncsRow(minutesAgo(30), 4.1, 23, 90, 'Recent'),
        ]);

        const { features } = await fetchEarthquakeFeatures({ source: 'ncs', hours: 24, limit: 3 });

        expect(features.map((f) => f.properties.place)).toEqual(['Recent']);
    });
});
