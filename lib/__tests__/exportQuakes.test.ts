import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportQuakesAsCsv } from '../exportQuakes';

// exportQuakesAsCsv writes through a Blob + object URL rather than returning a
// string, so the CSV body is captured from the Blob the download path builds.
function captureCsv(place: string): string {
    let captured = '';
    class FakeBlob {
        constructor(parts: string[]) { captured = parts.join(''); }
    }
    vi.stubGlobal('Blob', FakeBlob);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });

    exportQuakesAsCsv([{
        id: 'test-1',
        properties: { mag: 5.2, place, time: 0, url: 'https://example.test/e' },
        geometry: { coordinates: [90.4, 23.8, 10] },
    }]);
    return captured;
}

describe('exportQuakesAsCsv formula injection', () => {
    afterEach(() => vi.unstubAllGlobals());

    // Spreadsheet apps execute a field starting with = + - @ tab or CR. Place
    // strings come from upstream feeds, and the NCS path is an HTML scrape --
    // a weaker trust boundary than it looks.
    it.each(['=1+1', '+1', '-1', '@SUM(A1)'])('neutralizes a leading %s', (payload) => {
        const csv = captureCsv(payload);
        const dataRow = csv.split('\n')[1];
        expect(dataRow).toContain(`'${payload}`);
        // The raw payload must never appear as the unescaped start of a field.
        expect(dataRow.split(',').some((cell) => cell === payload)).toBe(false);
    });

    it('leaves ordinary place names untouched', () => {
        const csv = captureCsv('36 km E of Nelson Lagoon');
        expect(csv.split('\n')[1]).toContain('36 km E of Nelson Lagoon');
        expect(csv).not.toContain("'36 km");
    });

    it('still quotes fields containing a comma or quote', () => {
        expect(captureCsv('Dhaka, Bangladesh')).toContain('"Dhaka, Bangladesh"');
        expect(captureCsv('He said "hi"')).toContain('"He said ""hi"""');
    });

    it('quotes a field containing a bare carriage return', () => {
        // \r was missing from the escape test, so it could break row parsing.
        expect(captureCsv('line1\rline2')).toContain('"line1\rline2"');
    });
});

describe('exportQuakesAsCsv unmeasured events', () => {
    afterEach(() => vi.unstubAllGlobals());

    // USGS reports mag: null for some events. It has to export as an empty cell:
    // String(null) would write the literal text "null", and 0 would read as a
    // real measurement of zero.
    it('writes an empty magnitude cell rather than "null" or 0', () => {
        let captured = '';
        class FakeBlob {
            constructor(parts: string[]) { captured = parts.join(''); }
        }
        vi.stubGlobal('Blob', FakeBlob);
        vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });

        exportQuakesAsCsv([{
            id: 'no-mag',
            properties: { mag: null, place: 'Somewhere', time: 0, url: 'https://example.test/e' },
            geometry: { coordinates: [90.4, 23.8, 10] },
        }]);

        const cells = captured.split('\n')[1].split(',');
        expect(cells[2]).toBe('');
        expect(captured).not.toContain('null');
    });
});
