import { log } from './logger';

// Scoped to the last-3-years file, not the full multi-decade IBTrACS
// archive -- a full historical backfill is a heavier future increment if
// ever wanted. Confirmed live: ~20,202 data rows, 343 storms, no quoted/
// embedded-comma fields anywhere (safe for a naive comma-split, same
// discipline as lib/firms.ts).
const IBTRACS_CSV_URL = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv';

export interface CycloneTrackPoint {
    id: string;
    sid: string;
    season: number;
    basin: string;
    subbasin: string | null;
    name: string;
    isoTime: string; // ISO 8601
    nature: string | null;
    lat: number;
    lng: number;
    windKt: number | null;
    pressureMb: number | null;
    category: number | null; // Saffir-Simpson-style scale, -5..5
}

function toNumberOrNull(raw: string | undefined): number | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    const n = parseFloat(trimmed);
    return Number.isNaN(n) ? null : n;
}

// Column lookups are by header NAME, not hardcoded position -- this file
// has 170+ columns, and a hand-counted index is exactly the kind of thing
// that's easy to get wrong (caught a real off-by-one for USA_SSHS while
// verifying this against the live file before writing this parser).
export function parseIbtracsCsv(csv: string): CycloneTrackPoint[] {
    const lines = csv.split('\n');
    if (lines.length < 3) return []; // header + units row + at least one data row

    const header = lines[0].split(',').map((h) => h.trim());
    const col = (name: string) => header.indexOf(name);
    const idx = {
        sid: col('SID'),
        season: col('SEASON'),
        basin: col('BASIN'),
        subbasin: col('SUBBASIN'),
        name: col('NAME'),
        isoTime: col('ISO_TIME'),
        nature: col('NATURE'),
        lat: col('LAT'),
        lon: col('LON'),
        wmoWind: col('WMO_WIND'),
        wmoPres: col('WMO_PRES'),
        usaWind: col('USA_WIND'),
        usaPres: col('USA_PRES'),
        usaSshs: col('USA_SSHS'),
    };

    const points: CycloneTrackPoint[] = [];
    // Row 0 is the header, row 1 is a units row (e.g. "degrees_north") --
    // both skipped.
    for (const line of lines.slice(2)) {
        if (!line.trim()) continue;
        const cells = line.split(',');

        const lat = toNumberOrNull(cells[idx.lat]);
        const lng = toNumberOrNull(cells[idx.lon]);
        const isoTimeRaw = cells[idx.isoTime]?.trim();
        if (lat === null || lng === null || !isoTimeRaw) continue;

        const isoTime = new Date(`${isoTimeRaw.replace(' ', 'T')}Z`);
        if (Number.isNaN(isoTime.getTime())) continue;

        const sid = cells[idx.sid]?.trim();
        if (!sid) continue;

        points.push({
            id: `${sid}-${isoTimeRaw}`,
            sid,
            season: parseInt(cells[idx.season]?.trim(), 10) || 0,
            basin: cells[idx.basin]?.trim() ?? '',
            subbasin: cells[idx.subbasin]?.trim() || null,
            name: cells[idx.name]?.trim() || 'NOT_NAMED',
            isoTime: isoTime.toISOString(),
            nature: cells[idx.nature]?.trim() || null,
            lat,
            lng,
            // USA_* has real, verified better coverage on this file (~84%)
            // than WMO_* (~38%) -- prefer it, fall back to WMO_* when blank.
            windKt: toNumberOrNull(cells[idx.usaWind]) ?? toNumberOrNull(cells[idx.wmoWind]),
            pressureMb: toNumberOrNull(cells[idx.usaPres]) ?? toNumberOrNull(cells[idx.wmoPres]),
            category: toNumberOrNull(cells[idx.usaSshs]),
        });
    }
    return points;
}

export async function fetchIbtracsPoints(): Promise<CycloneTrackPoint[]> {
    const controller = new AbortController();
    // Confirmed live: the real file took ~20s to download in this
    // environment alone (before parsing) -- 20s was too tight (timed out
    // in practice) for a once-daily bulk fetch. Generous on purpose: this
    // isn't a hot path like the other adapters' 6s timeouts.
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(IBTRACS_CSV_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`IBTrACS upstream status: ${response.status}`);
        const csv = await response.text();
        return parseIbtracsCsv(csv);
    } catch (err) {
        log.warn('IBTrACS fetch failed', { error: String(err) });
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
}
