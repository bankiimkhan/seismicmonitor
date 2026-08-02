import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTsunamiAlerts } from '../nwsTsunami';

function alertsResponse(features: unknown[]) {
    return { ok: true, json: async () => ({ type: 'FeatureCollection', features }) };
}

const ALERT_WITH_GEOMETRY = {
    properties: {
        id: 'urn:oid:2.49.0.1.840.0.abc123.001.1',
        event: 'Tsunami Warning',
        effective: '2026-07-28T15:31:00-10:00',
        areaDesc: 'Big Island Southeast, Hawaii',
    },
    geometry: {
        type: 'Polygon',
        coordinates: [[[-155.0, 19.0], [-155.2, 19.0], [-155.2, 19.2], [-155.0, 19.2], [-155.0, 19.0]]],
    },
};

const ALERT_NEEDING_ZONE_LOOKUP = {
    properties: {
        id: 'urn:oid:2.49.0.1.840.0.def456.001.1',
        event: 'Tsunami Watch',
        sent: '2026-07-28T15:00:00-10:00',
        areaDesc: 'Olomana HI',
        geocode: { UGC: ['HIZ009'] },
    },
    geometry: null,
};

function zoneResponse(polygon: number[][]) {
    return { ok: true, json: async () => ({ geometry: { type: 'Polygon', coordinates: [polygon] } }) };
}

describe('fetchTsunamiAlerts', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('centroids a directly-provided Polygon geometry', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(alertsResponse([ALERT_WITH_GEOMETRY])));

        const alerts = (await fetchTsunamiAlerts())!;
        expect(alerts).toHaveLength(1);
        expect(alerts[0].alertLevel).toBe('Tsunami Warning');
        expect(alerts[0].place).toBe('Big Island Southeast, Hawaii');
        // Simple mean-of-ring-vertices centroid, including the closing
        // duplicate point -- 19.08/-155.08, not the exact 19.1/-155.1
        // geometric center (see nwsTsunami.ts's centroid comment: adequate
        // for "which general area", not precision navigation).
        expect(alerts[0].lat).toBeCloseTo(19.08, 5);
        expect(alerts[0].lng).toBeCloseTo(-155.08, 5);
        expect(alerts[0].agencyNativeId).toContain('nws-tsunami-');
    });

    it('falls back to centroiding the first UGC zone when geometry is null', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(alertsResponse([ALERT_NEEDING_ZONE_LOOKUP]))
            .mockResolvedValueOnce(zoneResponse([[-157.8, 21.4], [-157.6, 21.4], [-157.6, 21.6], [-157.8, 21.6]]));
        vi.stubGlobal('fetch', fetchMock);

        const alerts = (await fetchTsunamiAlerts())!;
        expect(alerts).toHaveLength(1);
        expect(alerts[0].lat).toBeCloseTo(21.5, 5);
        expect(alerts[0].lng).toBeCloseTo(-157.7, 5);
        // second call should hit the zones endpoint for the alert's first UGC code
        expect(fetchMock.mock.calls[1][0]).toContain('/zones/forecast/HIZ009');
    });

    it('skips an alert when geometry is null and the zone lookup fails', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(alertsResponse([ALERT_NEEDING_ZONE_LOOKUP]))
            .mockResolvedValueOnce({ ok: false, status: 404 });
        vi.stubGlobal('fetch', fetchMock);

        expect(await fetchTsunamiAlerts()).toEqual([]);
    });

    it('skips an alert with no geometry and no UGC zone to fall back to', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(alertsResponse([
            { ...ALERT_NEEDING_ZONE_LOOKUP, properties: { ...ALERT_NEEDING_ZONE_LOOKUP.properties, geocode: undefined } },
        ])));

        expect(await fetchTsunamiAlerts()).toEqual([]);
    });

    it('skips an alert with an unparseable effective/sent timestamp instead of producing a NaN time', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(alertsResponse([
            { ...ALERT_WITH_GEOMETRY, properties: { ...ALERT_WITH_GEOMETRY.properties, effective: 'not-a-date' } },
        ])));

        expect(await fetchTsunamiAlerts()).toEqual([]);
    });

    it('returns an empty array gracefully when there are no active alerts', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(alertsResponse([])));
        expect(await fetchTsunamiAlerts()).toEqual([]);
    });

    // null, not [] -- the ingest job records source health on a successful
    // fetch, so "read the feed, no alerts" and "could not read the feed" have
    // to be distinguishable. Tsunami alerts are rare enough that conflating
    // them meant this source never appeared on /about at all.
    it('returns null (not an empty array) when the fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        expect(await fetchTsunamiAlerts()).toBeNull();
    });

    it('returns null (not an empty array) when the upstream responds non-ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        expect(await fetchTsunamiAlerts()).toBeNull();
    });
});
