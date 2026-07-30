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
