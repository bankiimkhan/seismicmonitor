import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEonetRecords } from '../eonet';

function eventsResponse(events: unknown[]) {
    return { ok: true, json: async () => ({ events }) };
}

function mockFetchByCategory(byCategory: Record<string, unknown[]>) {
    return vi.fn(async (url: string) => {
        const match = url.match(/categories\/([a-zA-Z]+)\?/);
        const category = match?.[1] ?? '';
        return eventsResponse(byCategory[category] ?? []);
    });
}

describe('fetchEonetRecords', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('maps each category to the correct hazard_type', async () => {
        vi.stubGlobal('fetch', mockFetchByCategory({
            wildfires: [{
                id: 'EONET_1', title: 'Wildfire Example', link: 'https://eonet/1', closed: null,
                categories: [{ id: 'wildfires' }], sources: [{ id: 'IRWIN', url: 'https://irwin/1' }],
                geometry: [{ type: 'Point', date: '2026-07-27T11:21:00Z', coordinates: [-102.84, 44.76], magnitudeValue: 510 }],
            }],
            volcanoes: [{
                id: 'EONET_2', title: 'Some Volcano', link: 'https://eonet/2', closed: null,
                categories: [{ id: 'volcanoes' }], sources: [{ id: 'SIVolcano', url: 'https://si/2' }],
                geometry: [{ type: 'Point', date: '2026-06-15T00:00:00Z', coordinates: [-71.378, -36.868], magnitudeValue: null }],
            }],
        }));

        const records = await fetchEonetRecords() ?? [];
        const wildfire = records.find((r) => r.agencyNativeId.includes('EONET_1'));
        const volcano = records.find((r) => r.agencyNativeId.includes('EONET_2'));

        expect(wildfire?.hazardType).toBe('wildfire');
        expect(wildfire?.magnitude).toBe(510);
        expect(wildfire?.place).toBe('Wildfire Example');
        expect(volcano?.hazardType).toBe('volcano');
        expect(volcano?.magnitude).toBeNull();
    });

    it('skips non-Point geometry (e.g. flood-style Polygon) instead of guessing a centroid', async () => {
        vi.stubGlobal('fetch', mockFetchByCategory({
            wildfires: [{
                id: 'EONET_POLY', title: 'Should be skipped', link: 'https://eonet/poly', closed: null,
                categories: [{ id: 'wildfires' }], sources: [],
                geometry: [{ type: 'Polygon', date: '2026-07-25T20:00:00Z', coordinates: [[[34.88, 104.05]]] }],
            }],
        }));

        const records = await fetchEonetRecords() ?? [];
        expect(records.find((r) => r.agencyNativeId.includes('EONET_POLY'))).toBeUndefined();
    });

    it('emits one record per track point, not one per event', async () => {
        vi.stubGlobal('fetch', mockFetchByCategory({
            severeStorms: [{
                id: 'EONET_STORM', title: 'Typhoon Example', link: 'https://eonet/storm', closed: null,
                categories: [{ id: 'severeStorms' }], sources: [{ id: 'JTWC', url: 'https://jtwc/storm' }],
                geometry: [
                    { type: 'Point', date: '2026-07-27T06:00:00Z', coordinates: [176.7, 13.4], magnitudeValue: 35 },
                    { type: 'Point', date: '2026-07-27T12:00:00Z', coordinates: [175.2, 13.6], magnitudeValue: 45 },
                ],
            }],
        }));

        const records = await fetchEonetRecords() ?? [];
        const stormRecords = records.filter((r) => r.agencyNativeId.startsWith('eonet-EONET_STORM'));
        expect(stormRecords).toHaveLength(2);
        expect(new Set(stormRecords.map((r) => r.agencyNativeId)).size).toBe(2); // distinct ids per point
        expect(stormRecords.map((r) => r.magnitude).sort()).toEqual([35, 45]);
    });

    it('degrades gracefully (empty for that category) if one category fetch fails, without affecting others', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.includes('wildfires')) throw new Error('network error');
            return eventsResponse([{
                id: 'EONET_OK', title: 'Ok Volcano', link: 'https://eonet/ok', closed: null,
                categories: [{ id: 'volcanoes' }], sources: [],
                geometry: [{ type: 'Point', date: '2026-06-01T00:00:00Z', coordinates: [10, 20], magnitudeValue: null }],
            }]);
        }));

        const records = await fetchEonetRecords();
        // A partial failure still returns the categories that DID come back --
        // discarding real volcano/storm data because one category broke would be
        // worse than the gap it papers over.
        expect(records).not.toBeNull();
        expect(records!.some((r) => r.agencyNativeId.includes('EONET_OK'))).toBe(true);
        expect(records!.some((r) => r.hazardType === 'wildfire')).toBe(false);
    });

    // null, not [] -- the ingest job stamps scraper_health.last_success_at on a
    // non-null result, and that column is what EONET_POLL_INTERVAL_MS gates on.
    // Reporting a total outage as "read it, found nothing" suppressed the retry
    // for an hour and left /about showing the source as healthy.
    it('returns null when every category fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network error'); }));
        expect(await fetchEonetRecords()).toBeNull();
    });

    it('returns [] (not null) when every category was read and reported nothing', async () => {
        vi.stubGlobal('fetch', mockFetchByCategory({}));
        expect(await fetchEonetRecords()).toEqual([]);
    });
});
