import { REGION_BY_ID } from './regions';
import type { NormalizedEvent } from './hazardModel';

/**
 * Pure reductions over normalized events -- the only place counts, rankings
 * and headline picks are computed.
 *
 * Split out from lib/hazardEvents.ts (which is `server-only` because it holds
 * the service-role read) so the same functions can run on either side and be
 * unit-tested without a database. That matters more than it sounds: these
 * reductions are what every displayed number ultimately is, and before this
 * they were re-derived inline in each card, table and route.
 */

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Collapses events describing the same real-world occurrence.
 *
 * Keyed on hazard-agnostic facts -- position, time, severity -- rather than
 * id, because the whole point is that one event can carry two ids. The ingest
 * merge engine already unifies multi-agency earthquake reports, but it does not
 * span hazard adapters: a storm reaches the archive from both NHC (`cyclone`)
 * and JTWC (`severe_weather`), and a volcano from both EONET and Smithsonian.
 *
 * Position rounds to 2dp (~1.1km) and time to the minute: tight enough that two
 * genuinely separate events survive as two, loose enough to catch two agencies'
 * slightly different fixes on one. The higher-confidence row wins, so a merged
 * multi-source record is preferred over a single-source duplicate of it.
 */
export function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
    const best = new Map<string, NormalizedEvent>();

    for (const event of events) {
        const key = [
            event.hazardType,
            event.lat.toFixed(2),
            event.lng.toFixed(2),
            Math.round(event.time / 60_000),
            event.severity === null ? 'x' : event.severity.toFixed(1),
        ].join('|');

        const existing = best.get(key);
        if (!existing) {
            best.set(key, event);
            continue;
        }
        const existingRank = CONFIDENCE_RANK[existing.confidence ?? ''] ?? 0;
        const candidateRank = CONFIDENCE_RANK[event.confidence ?? ''] ?? 0;
        if (candidateRank > existingRank) best.set(key, event);
    }

    return [...best.values()];
}

export interface GroupStats {
    key: string;
    label: string;
    count: number;
    /** Events per day across the window. */
    frequency: number;
    /** Null when no event in the group carried a severity number -- not 0.
     * A volcano ranking must not report "average severity 0". */
    avgSeverity: number | null;
    maxSeverity: number | null;
}

export function groupBy(
    events: NormalizedEvent[],
    dimension: 'country' | 'region',
    windowHours: number
): GroupStats[] {
    const buckets = new Map<string, { label: string; events: NormalizedEvent[] }>();

    for (const event of events) {
        const raw = dimension === 'country' ? event.country : event.regionId;
        // Unattributable events get their own visible bucket. Dropping them
        // would make the ranking's rows fail to sum to the headline count;
        // folding them into a real country would be a fabrication.
        const key = raw ?? '__unknown__';
        const label = raw
            ? (dimension === 'region' ? REGION_BY_ID[raw]?.label ?? raw : raw)
            : (dimension === 'region' ? 'Outside tracked regions' : 'Unknown location');

        const bucket = buckets.get(key) ?? { label, events: [] };
        bucket.events.push(event);
        buckets.set(key, bucket);
    }

    const days = Math.max(windowHours / 24, 1 / 24);

    return [...buckets.entries()].map(([key, { label, events: group }]) => {
        const measured = group.filter(
            (e): e is NormalizedEvent & { severity: number } => e.severity !== null
        );
        return {
            key,
            label,
            count: group.length,
            frequency: group.length / days,
            avgSeverity: measured.length > 0
                ? measured.reduce((sum, e) => sum + e.severity, 0) / measured.length
                : null,
            maxSeverity: measured.length > 0
                ? measured.reduce((max, e) => Math.max(max, e.severity), -Infinity)
                : null,
        };
    });
}

export type RankBy = 'count' | 'frequency' | 'avgSeverity' | 'maxSeverity';

/** Sorts groups by a ranking method, descending.
 *
 * Groups with no severity data sort last on a severity ranking rather than
 * being treated as zero -- "we have no measurement" is not "the smallest
 * measurement", and sorting them as 0 would bury a real country under
 * unmeasured ones. */
export function rankGroups(groups: GroupStats[], by: RankBy): GroupStats[] {
    return [...groups].sort((a, b) => {
        const av = a[by];
        const bv = b[by];
        if (av === null && bv === null) return b.count - a.count;
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av;
    });
}

/** Per-day counts across the window, for sparklines and bar charts. */
export function countByDay(events: NormalizedEvent[]): { day: string; count: number }[] {
    const byDay = new Map<string, number>();
    for (const event of events) {
        const day = new Date(event.time).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, count]) => ({ day, count }));
}

/** The most severe event, or the most recent one when this hazard type reports
 * no severity at all. Used for the "notable event" line on cards. */
export function headlineEvent(events: NormalizedEvent[]): NormalizedEvent | null {
    if (events.length === 0) return null;
    const measured = events.filter(
        (e): e is NormalizedEvent & { severity: number } => e.severity !== null
    );
    if (measured.length > 0) {
        return measured.reduce((max, e) => (e.severity > max.severity ? e : max));
    }
    return events.reduce((latest, e) => (e.time > latest.time ? e : latest));
}
