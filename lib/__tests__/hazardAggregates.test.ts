import { describe, it, expect } from 'vitest';
import { dedupe, groupBy, rankGroups, headlineEvent, countByDay } from '../hazardAggregates';
import type { NormalizedEvent } from '../hazardModel';

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
    return {
        id: 'e1',
        hazardType: 'earthquake',
        place: 'Somewhere, Nepal',
        country: 'Nepal',
        regionId: 'south-asia',
        time: Date.parse('2026-08-03T12:00:00Z'),
        lat: 28.5,
        lng: 82.3,
        depthKm: 10,
        severity: 4.2,
        alertLevel: null,
        confidence: 'medium',
        url: 'https://example.com',
        ...overrides,
    };
}

describe('dedupe', () => {
    it('collapses two agencies reporting one event at the same place and time', () => {
        const a = event({ id: 'usgs-1', confidence: 'low' });
        const b = event({ id: 'gdacs-1', confidence: 'high' });

        const result = dedupe([a, b]);

        expect(result).toHaveLength(1);
    });

    // The merged multi-agency record is the better one: it is what the ingest
    // merge engine produced after reconciling sources.
    it('keeps the higher-confidence record when collapsing', () => {
        const low = event({ id: 'single-source', confidence: 'low' });
        const high = event({ id: 'merged', confidence: 'high' });

        expect(dedupe([low, high])[0].id).toBe('merged');
        expect(dedupe([high, low])[0].id).toBe('merged');
    });

    it('keeps genuinely distinct events apart', () => {
        const here = event({ id: 'a', lat: 28.5, lng: 82.3 });
        const farAway = event({ id: 'b', lat: 35.0, lng: 82.3 });
        const later = event({ id: 'c', time: Date.parse('2026-08-03T18:00:00Z') });

        expect(dedupe([here, farAway, later])).toHaveLength(3);
    });

    // A storm reaches the archive from NHC as `cyclone` and from JTWC as
    // `severe_weather`. Those are different hazard_type values for one system,
    // and the cyclone section reads both -- but they are separate source
    // records with separate ids, so only position+time can catch them.
    it('does not merge across hazard types', () => {
        const cyclone = event({ id: 'nhc-1', hazardType: 'cyclone', severity: 80 });
        const severe = event({ id: 'jtwc-1', hazardType: 'severe_weather', severity: 80 });

        expect(dedupe([cyclone, severe])).toHaveLength(2);
    });

    it('treats unmeasured events as distinct from measured ones at the same spot', () => {
        const measured = event({ id: 'a', severity: 4.2 });
        const unmeasured = event({ id: 'b', severity: null });

        expect(dedupe([measured, unmeasured])).toHaveLength(2);
    });
});

describe('groupBy', () => {
    it('counts events per country', () => {
        const groups = groupBy(
            [
                event({ id: '1', country: 'Nepal' }),
                event({ id: '2', country: 'Nepal', lat: 29 }),
                event({ id: '3', country: 'India', lat: 26 }),
            ],
            'country',
            24
        );

        expect(groups.find((g) => g.key === 'Nepal')?.count).toBe(2);
        expect(groups.find((g) => g.key === 'India')?.count).toBe(1);
    });

    // Dropping these would make the ranking's rows fail to sum to the headline
    // count; folding them into a real country would be a fabrication.
    it('gives events with no country their own visible bucket', () => {
        const groups = groupBy(
            [event({ id: '1', country: null }), event({ id: '2', country: 'Nepal', lat: 29 })],
            'country',
            24
        );

        const unknown = groups.find((g) => g.key === '__unknown__');
        expect(unknown?.count).toBe(1);
        expect(unknown?.label).toBe('Unknown location');
        expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(2);
    });

    it('names the out-of-region bucket for the region dimension', () => {
        const groups = groupBy([event({ regionId: null })], 'region', 24);
        expect(groups[0].label).toBe('Outside tracked regions');
    });

    it('computes frequency as events per day', () => {
        const week = groupBy(
            Array.from({ length: 14 }, (_, i) => event({ id: String(i), lat: 20 + i * 0.5 })),
            'country',
            168
        );
        expect(week[0].frequency).toBeCloseTo(2, 5);
    });

    // The central rule of this whole restructure: a hazard type that publishes
    // no severity number must not be described as having severity 0.
    it('reports null severity, never zero, when nothing was measured', () => {
        const groups = groupBy(
            [event({ severity: null }), event({ id: '2', severity: null, lat: 29 })],
            'country',
            24
        );

        expect(groups[0].avgSeverity).toBeNull();
        expect(groups[0].maxSeverity).toBeNull();
    });

    it('averages only the events that carry a measurement', () => {
        const groups = groupBy(
            [
                event({ id: '1', severity: 4 }),
                event({ id: '2', severity: 6, lat: 29 }),
                event({ id: '3', severity: null, lat: 30 }),
            ],
            'country',
            24
        );

        expect(groups[0].avgSeverity).toBe(5);
        expect(groups[0].maxSeverity).toBe(6);
        expect(groups[0].count).toBe(3);
    });
});

describe('rankGroups', () => {
    it('orders by the requested metric, descending', () => {
        const groups = groupBy(
            [
                event({ id: '1', country: 'Nepal', severity: 3 }),
                event({ id: '2', country: 'India', severity: 7, lat: 26 }),
                event({ id: '3', country: 'India', severity: 5, lat: 25 }),
            ],
            'country',
            24
        );

        expect(rankGroups(groups, 'count')[0].key).toBe('India');
        expect(rankGroups(groups, 'maxSeverity')[0].key).toBe('India');
    });

    // "No measurement" is not "the smallest measurement". Sorting unmeasured
    // groups as 0 would bury real countries beneath them.
    it('sorts groups with no severity data last rather than as zero', () => {
        const groups = groupBy(
            [
                event({ id: '1', country: 'Nepal', severity: null }),
                event({ id: '2', country: 'Nepal', severity: null, lat: 29 }),
                event({ id: '3', country: 'Nepal', severity: null, lat: 30 }),
                event({ id: '4', country: 'India', severity: 2, lat: 26 }),
            ],
            'country',
            24
        );

        const ranked = rankGroups(groups, 'avgSeverity');
        expect(ranked[0].key).toBe('India');
        expect(ranked[1].key).toBe('Nepal');
    });
});

describe('headlineEvent', () => {
    it('picks the most severe event when severity exists', () => {
        const top = headlineEvent([
            event({ id: 'small', severity: 3 }),
            event({ id: 'big', severity: 6.4 }),
        ]);
        expect(top?.id).toBe('big');
    });

    // Volcano and landslide report no severity at all. "Most severe" is
    // undefined for them, so the most recent event stands in.
    it('falls back to the most recent event when nothing is measured', () => {
        const top = headlineEvent([
            event({ id: 'older', severity: null, time: 1000 }),
            event({ id: 'newer', severity: null, time: 9000 }),
        ]);
        expect(top?.id).toBe('newer');
    });

    it('returns null for an empty list rather than throwing', () => {
        expect(headlineEvent([])).toBeNull();
    });
});

describe('countByDay', () => {
    it('buckets events by UTC day in chronological order', () => {
        const days = countByDay([
            event({ time: Date.parse('2026-08-02T23:00:00Z') }),
            event({ time: Date.parse('2026-08-03T01:00:00Z') }),
            event({ time: Date.parse('2026-08-03T22:00:00Z') }),
        ]);

        expect(days).toEqual([
            { day: '2026-08-02', count: 1 },
            { day: '2026-08-03', count: 2 },
        ]);
    });
});
