// Cross-agency deduplication/merge for the ingest (archive) pipeline only.
// The live feed keeps using lib/earthquakes.ts's dedupeAndSort (a cheap,
// request-scoped string-key dedupe) -- this is the real geospatial version,
// affordable here because ingest runs on a schedule against a bounded batch,
// not on every live request.

export interface NormalizedEvent {
    agency: string;
    agencyNativeId: string;
    time: number; // epoch ms
    lat: number;
    lng: number;
    depthKm?: number;
    magnitude?: number;
    place?: string;
    url?: string;
    alertLevel?: string;
}

export type ConfidenceTier = 'low' | 'medium' | 'high';

const TIME_TOLERANCE_MS = 120_000; // agencies' automatic origin-time picks commonly differ by seconds, not minutes
const DISTANCE_TOLERANCE_KM = 50;
const MAGNITUDE_TOLERANCE = 0.5;

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

function isMatch(a: NormalizedEvent, b: NormalizedEvent): boolean {
    if (Math.abs(a.time - b.time) > TIME_TOLERANCE_MS) return false;
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) > DISTANCE_TOLERANCE_KM) return false;
    if (a.magnitude !== undefined && b.magnitude !== undefined) {
        if (Math.abs(a.magnitude - b.magnitude) > MAGNITUDE_TOLERANCE) return false;
    }
    return true;
}

/** Union-find clustering: groups events that are pairwise-transitively
 * matched (A~B, B~C => one group of 3, even though A and C were never
 * compared directly) into merge groups. */
export function matchCandidates(events: NormalizedEvent[]): NormalizedEvent[][] {
    const parent = events.map((_, i) => i);
    function find(i: number): number {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    }
    function union(i: number, j: number) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[ri] = rj;
    }

    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            if (isMatch(events[i], events[j])) union(i, j);
        }
    }

    const groups = new Map<number, NormalizedEvent[]>();
    for (let i = 0; i < events.length; i++) {
        const root = find(i);
        const group = groups.get(root) ?? [];
        group.push(events[i]);
        groups.set(root, group);
    }
    return [...groups.values()];
}

/** Picks the canonical event within a merge group: the first member whose
 * agency appears earliest in the region's priority list. Falls back to the
 * group's first member if none of its agencies are in the priority list
 * (e.g. gdacs-only in a region whose priority list doesn't mention it). */
export function selectCanonical(group: NormalizedEvent[], priorityOrder: string[]): NormalizedEvent {
    for (const agency of priorityOrder) {
        const match = group.find((e) => e.agency === agency);
        if (match) return match;
    }
    return group[0];
}

/** Honest 3-tier confidence, not a fabricated precise score: `high` means
 * 2+ independent agencies actually agreed within tolerance; a single
 * automatic report is `low`. There's no agency-exposed "reviewed" status
 * plumbed through yet, so `medium` is currently unused -- reserved for that
 * once an adapter can report it. */
export function scoreConfidence(group: NormalizedEvent[]): ConfidenceTier {
    const distinctAgencies = new Set(group.map((e) => e.agency)).size;
    return distinctAgencies >= 2 ? 'high' : 'low';
}
