import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGdacsFeatures } from '../gdacs';

// A real Response, not a hand-rolled `{ ok, json }` stub: the adapter reads the
// body as text and parses it itself (so it can tell an empty 204 body apart from
// a malformed one), and a stub that only implements json() would not exercise
// that path at all.
function eventListResponse(features: unknown[]) {
    return new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 });
}

const EQ_FEATURE = {
    properties: {
        eventid: 1554552,
        eventtype: 'EQ',
        fromdate: '2026-07-28T07:27:15',
        alertlevel: 'Orange',
        country: 'Japan',
        source: 'NEIC',
        severitydata: { severity: 6.8, severitytext: 'Magnitude 6.8M, Depth:10km' },
        url: { report: 'https://www.gdacs.org/report.aspx?eventid=1554552' },
    },
    geometry: { coordinates: [130.7217, 32.6817] },
};

const FLOOD_FEATURE = {
    properties: {
        eventid: 9999,
        eventtype: 'FL',
        fromdate: '2026-07-28T00:00:00',
        country: 'Bangladesh',
        severitydata: { severity: 3, severitytext: 'Flood' },
        url: {},
    },
    geometry: { coordinates: [90.4, 23.8] },
};

describe('fetchGdacsFeatures', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests GDACS with the `eventlist` param (not `eventtype`, which GDACS silently ignores)', async () => {
        const fetchMock = vi.fn().mockResolvedValue(eventListResponse([EQ_FEATURE]));
        vi.stubGlobal('fetch', fetchMock);

        await fetchGdacsFeatures(24, 50);

        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(requestedUrl.searchParams.get('eventlist')).toBe('EQ');
        expect(requestedUrl.searchParams.has('eventtype')).toBe(false);
    });

    it('filters out non-earthquake event types even if the upstream response mixes them in', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventListResponse([EQ_FEATURE, FLOOD_FEATURE])));

        const features = await fetchGdacsFeatures(24, 50) ?? [];
        expect(features).toHaveLength(1);
        expect(features[0].id).toBe('gdacs-1554552');
        expect(features[0].properties.mag).toBe(6.8);
    });

    it('parses depth out of the free-text severitytext field', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventListResponse([EQ_FEATURE])));

        const features = await fetchGdacsFeatures(24, 50) ?? [];
        expect(features[0].geometry.coordinates).toEqual([130.7217, 32.6817, 10]);
    });

    it('drops a record with an unparseable date instead of producing a NaN time', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventListResponse([
            { ...EQ_FEATURE, properties: { ...EQ_FEATURE.properties, fromdate: 'not-a-date' } },
        ])));

        expect(await fetchGdacsFeatures(24, 50)).toEqual([]);
    });

    // null, not [] -- the ingest job keys source health off this distinction, and
    // an unreadable feed reported as "read it, found nothing" showed GDACS as
    // permanently 'online' on /about no matter how long it had been down.
    it('returns null (not an empty array) when the fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        expect(await fetchGdacsFeatures(24, 50)).toBeNull();
    });

    it('returns null (not an empty array) when the upstream responds non-ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        expect(await fetchGdacsFeatures(24, 50)).toBeNull();
    });

    it('still returns [] when the feed was read and genuinely had no earthquakes', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventListResponse([])));
        expect(await fetchGdacsFeatures(24, 50)).toEqual([]);
    });

    // How GDACS actually reports an empty window (live-verified): 204 with no
    // body, not an empty FeatureCollection. 204 is `ok`, so this reached
    // response.json() and threw on the empty body -- turning the single most
    // common response into a "feed unreadable" null, which marked the source
    // degraded on /about and climbed consecutive_failures every cycle.
    it('returns [] (not null) for a 204 No Content window with no events', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        expect(await fetchGdacsFeatures(24, 50)).toEqual([]);
    });

    it('returns [] for a 200 with an empty body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
        expect(await fetchGdacsFeatures(24, 50)).toEqual([]);
    });

    // Empty is a real answer; malformed is not. Only the latter is a failed read.
    it('returns null when the body is present but not valid JSON', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 200 })));
        expect(await fetchGdacsFeatures(24, 50)).toBeNull();
    });
});
