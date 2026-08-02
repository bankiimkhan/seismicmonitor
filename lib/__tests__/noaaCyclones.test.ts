import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchNoaaCyclones } from '../noaaCyclones';

function stormsResponse(activeStorms: unknown[]) {
    return { ok: true, json: async () => ({ activeStorms }) };
}

const SAMPLE_STORM = {
    id: 'ep072026',
    name: 'Genevieve',
    classification: 'HU',
    intensity: '110',
    pressure: '950',
    latitude: '17.9N',
    longitude: '116.1W',
    latitudeNumeric: 17.9,
    longitudeNumeric: -116.1,
    lastUpdate: '2026-07-28T15:00:00.000Z',
    publicAdvisory: { url: 'https://www.nhc.noaa.gov/text/MIATCPEP2.shtml' },
};

describe('fetchNoaaCyclones', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('maps classification codes to readable labels and uses already-parsed numeric coordinates', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stormsResponse([SAMPLE_STORM])));

        const records = (await fetchNoaaCyclones())!;
        expect(records).toHaveLength(1);
        expect(records[0].place).toBe('Hurricane Genevieve');
        expect(records[0].lat).toBe(17.9);
        expect(records[0].lng).toBe(-116.1);
        expect(records[0].windSpeedKt).toBe(110);
        expect(records[0].classification).toBe('HU');
        expect(records[0].url).toBe('https://www.nhc.noaa.gov/text/MIATCPEP2.shtml');
    });

    it('falls back to the raw code for an unrecognized classification', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stormsResponse([
            { ...SAMPLE_STORM, classification: 'WV' },
        ])));

        const records = (await fetchNoaaCyclones())!;
        expect(records[0].place).toBe('WV Genevieve');
    });

    it('builds an id from storm id + lastUpdate, so a new advisory produces a new id', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(stormsResponse([SAMPLE_STORM]))
            .mockResolvedValueOnce(stormsResponse([{ ...SAMPLE_STORM, lastUpdate: '2026-07-28T21:00:00.000Z' }])));

        const first = (await fetchNoaaCyclones())![0].agencyNativeId;
        const second = (await fetchNoaaCyclones())![0].agencyNativeId;
        expect(first).not.toBe(second);
        expect(first).toContain('ep072026');
    });

    it('is idempotent for repeated fetches of the same advisory (same id both times)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stormsResponse([SAMPLE_STORM])));

        const first = (await fetchNoaaCyclones())![0].agencyNativeId;
        const second = (await fetchNoaaCyclones())![0].agencyNativeId;
        expect(first).toBe(second);
    });

    // null, not [] -- see the matching note in nwsTsunami.test.ts. The ingest
    // job records source health on a successful fetch, so a quiet season and a
    // broken adapter must not look identical.
    it('returns null (not an empty array) when the fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        expect(await fetchNoaaCyclones()).toBeNull();
    });

    it('returns null (not an empty array) when the upstream responds non-ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        expect(await fetchNoaaCyclones()).toBeNull();
    });

    it('still returns an empty array when the feed is readable but has no active storms', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ activeStorms: [] }) }));
        expect(await fetchNoaaCyclones()).toEqual([]);
    });
});
