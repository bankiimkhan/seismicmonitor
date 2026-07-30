import { describe, it, expect } from 'vitest';
import { parseFirmsCsv } from '../firms';

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
