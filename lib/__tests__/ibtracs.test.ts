import { describe, it, expect } from 'vitest';
import { parseIbtracsCsv } from '../ibtracs';

// Minimal fixture using the real header names (order deliberately shuffled
// from the live file to prove column lookup is by name, not hardcoded
// position -- the whole point of this parser given IBTrACS' 170+ columns).
const HEADER = 'NAME,SID,SEASON,BASIN,SUBBASIN,ISO_TIME,NATURE,LAT,LON,USA_SSHS,USA_WIND,USA_PRES,WMO_WIND,WMO_PRES';
const UNITS_ROW = ' , ,Year, , , , ,degrees_north,degrees_east,1,kts,mb,kts,mb';

function csvWith(rows: string[]): string {
    return [HEADER, UNITS_ROW, ...rows].join('\n');
}

describe('parseIbtracsCsv', () => {
    it('parses a well-formed row and prefers USA_WIND/USA_PRES over WMO_*', () => {
        const csv = csvWith(['HALE,2023005S18142,2023,SP,EA,2023-01-04 18:00:00,DS,-18.2,142.0,-3,20,1007,15,1010']);
        const points = parseIbtracsCsv(csv);

        expect(points).toHaveLength(1);
        const p = points[0];
        expect(p.sid).toBe('2023005S18142');
        expect(p.name).toBe('HALE');
        expect(p.season).toBe(2023);
        expect(p.basin).toBe('SP');
        expect(p.lat).toBeCloseTo(-18.2);
        expect(p.lng).toBeCloseTo(142.0);
        expect(p.windKt).toBe(20); // USA_WIND, not WMO_WIND(15)
        expect(p.pressureMb).toBe(1007); // USA_PRES, not WMO_PRES(1010)
        expect(p.category).toBe(-3);
        expect(p.isoTime).toBe(new Date('2023-01-04T18:00:00Z').toISOString());
    });

    it('falls back to WMO_WIND/WMO_PRES when USA_* is blank', () => {
        const csv = csvWith(['HALE,2023005S18142,2023,SP,EA,2023-01-04 18:00:00,DS,-18.2,142.0, , , ,15,1010']);
        const points = parseIbtracsCsv(csv);
        expect(points[0].windKt).toBe(15);
        expect(points[0].pressureMb).toBe(1010);
        expect(points[0].category).toBeNull();
    });

    it('skips rows with blank LAT/LON', () => {
        const csv = csvWith([
            'HALE,2023005S18142,2023,SP,EA,2023-01-04 18:00:00,DS, ,142.0,-3,20,1007,15,1010',
            'HALE,2023005S18142,2023,SP,EA,2023-01-04 18:00:00,DS,-18.2,142.0,-3,20,1007,15,1010',
        ]);
        expect(parseIbtracsCsv(csv)).toHaveLength(1);
    });

    it('builds a stable id from sid + raw ISO_TIME', () => {
        const csv = csvWith(['HALE,2023005S18142,2023,SP,EA,2023-01-04 18:00:00,DS,-18.2,142.0,-3,20,1007,15,1010']);
        expect(parseIbtracsCsv(csv)[0].id).toBe('2023005S18142-2023-01-04 18:00:00');
    });

    it('returns an empty array for a header-only CSV (no data rows)', () => {
        expect(parseIbtracsCsv(`${HEADER}\n${UNITS_ROW}`)).toEqual([]);
        expect(parseIbtracsCsv('')).toEqual([]);
    });
});
