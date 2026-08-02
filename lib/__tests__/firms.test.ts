import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFirmsHotspots, parseFirmsCsv } from '../firms';

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight';

function csvWith(rows: string[]): string {
    return [HEADER, ...rows].join('\n');
}

describe('parseFirmsCsv', () => {
    it('parses a well-formed VIIRS row into a WildfireHotspot', () => {
        const csv = csvWith(['23.777,90.399,320.5,0.4,0.4,2026-07-28,0113,N,n,2.0NRT,290.1,45.6,D']);
        const hotspots = parseFirmsCsv(csv);

        expect(hotspots).toHaveLength(1);
        const h = hotspots[0];
        expect(h.lat).toBeCloseTo(23.777);
        expect(h.lng).toBeCloseTo(90.399);
        expect(h.frp).toBeCloseTo(45.6);
        expect(h.confidence).toBe('medium'); // 'n' -> medium
        expect(h.satellite).toBe('N');
        expect(h.daynight).toBe('D');
        expect(h.time).toBe(Date.parse('2026-07-28T01:13:00Z'));
    });

    it('maps confidence letters to low/medium/high', () => {
        const csv = csvWith([
            '10,10,300,0.4,0.4,2026-07-28,0000,N,l,2.0NRT,290,5,D',
            '10,10,300,0.4,0.4,2026-07-28,0001,N,n,2.0NRT,290,5,D',
            '10,10,300,0.4,0.4,2026-07-28,0002,N,h,2.0NRT,290,5,D',
        ]);
        const hotspots = parseFirmsCsv(csv);
        expect(hotspots.map((h) => h.confidence)).toEqual(['low', 'medium', 'high']);
    });

    it('builds a stable synthetic id so the same detection parsed twice matches', () => {
        const csv = csvWith(['23.777,90.399,320.5,0.4,0.4,2026-07-28,0113,N,n,2.0NRT,290.1,45.6,D']);
        const first = parseFirmsCsv(csv)[0].agencyNativeId;
        const second = parseFirmsCsv(csv)[0].agencyNativeId;
        expect(first).toBe(second);
    });

    it('skips malformed rows (missing coordinates) without throwing', () => {
        const csv = csvWith([
            ',90.399,320.5,0.4,0.4,2026-07-28,0113,N,n,2.0NRT,290.1,45.6,D', // missing latitude
            '23.777,90.399,320.5,0.4,0.4,2026-07-28,0113,N,n,2.0NRT,290.1,45.6,D',
        ]);
        expect(parseFirmsCsv(csv)).toHaveLength(1);
    });

    it('returns an empty array for a header-only or empty CSV', () => {
        expect(parseFirmsCsv(HEADER)).toEqual([]);
        expect(parseFirmsCsv('')).toEqual([]);
    });
});

// The ingest job stamps scraper_health.last_success_at whenever this returns
// non-null, and FIRMS_POLL_INTERVAL_MS gates the next poll on that column. So
// reporting a failed fetch as "read it, found no fires" didn't just mislabel
// source health -- it suppressed wildfire ingest for the following 2 hours.
describe('fetchFirmsHotspots null-vs-empty contract', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('returns null when the key is not configured', async () => {
        vi.stubEnv('NASA_FIRMS_MAP_KEY', '');
        expect(await fetchFirmsHotspots(1)).toBeNull();
    });

    it('returns null when the fetch rejects', async () => {
        vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-key');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
        expect(await fetchFirmsHotspots(1)).toBeNull();
    });

    it('returns null when the upstream responds non-ok', async () => {
        vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-key');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
        expect(await fetchFirmsHotspots(1)).toBeNull();
    });

    it('returns [] when the feed was read and genuinely reported no hotspots', async () => {
        vi.stubEnv('NASA_FIRMS_MAP_KEY', 'test-key');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => HEADER }));
        expect(await fetchFirmsHotspots(1)).toEqual([]);
    });
});
