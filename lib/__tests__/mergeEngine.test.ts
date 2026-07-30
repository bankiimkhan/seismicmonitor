import { describe, it, expect } from 'vitest';
import { matchCandidates, selectCanonical, scoreConfidence, type NormalizedEvent } from '../mergeEngine';

function event(overrides: Partial<NormalizedEvent>): NormalizedEvent {
    return {
        agency: 'usgs',
        agencyNativeId: 'a',
        time: 1_000_000,
        lat: 23,
        lng: 90,
        magnitude: 5.0,
        ...overrides,
    };
}

describe('matchCandidates', () => {
    it('clusters events within time/distance/magnitude tolerance into one group', () => {
        const a = event({ agency: 'usgs', agencyNativeId: 'a', time: 1_000_000, lat: 23, lng: 90, magnitude: 5.0 });
        const b = event({ agency: 'ncs', agencyNativeId: 'b', time: 1_050_000, lat: 23.1, lng: 90.1, magnitude: 5.2 });

        const groups = matchCandidates([a, b]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('keeps events outside tolerance in separate groups', () => {
        const a = event({ agency: 'usgs', agencyNativeId: 'a', time: 1_000_000, lat: 23, lng: 90 });
        const farInTime = event({ agency: 'ncs', agencyNativeId: 'b', time: 1_000_000 + 10 * 60_000, lat: 23, lng: 90 });
        const farInDistance = event({ agency: 'gdacs', agencyNativeId: 'c', time: 1_000_000, lat: 40, lng: 120 });
        const differentMagnitude = event({ agency: 'ncs', agencyNativeId: 'd', time: 1_000_000, lat: 23, lng: 90, magnitude: 7.5 });

        const groups = matchCandidates([a, farInTime, farInDistance, differentMagnitude]);
        expect(groups).toHaveLength(4);
    });

    it('transitively merges a chain of pairwise matches into one group', () => {
        // a<->b is ~33km apart (within the 50km tolerance), b<->c is ~33km
        // apart (within tolerance), but a<->c is ~67km apart -- outside
        // tolerance on its own. Union-find must still merge all three via
        // the shared member b, rather than only merging direct pairs.
        const a = event({ agency: 'usgs', agencyNativeId: 'a', lat: 23.0 });
        const b = event({ agency: 'ncs', agencyNativeId: 'b', lat: 23.3 });
        const c = event({ agency: 'gdacs', agencyNativeId: 'c', lat: 23.6 });

        expect(matchCandidates([a, c])).toHaveLength(2); // sanity check: a and c alone don't match

        const groups = matchCandidates([a, b, c]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(3);
    });
});

describe('selectCanonical', () => {
    it('picks the group member whose agency is earliest in the priority list', () => {
        const usgs = event({ agency: 'usgs', agencyNativeId: 'us1' });
        const ncs = event({ agency: 'ncs', agencyNativeId: 'ncs1' });

        expect(selectCanonical([usgs, ncs], ['ncs', 'usgs'])).toBe(ncs);
        expect(selectCanonical([usgs, ncs], ['usgs', 'ncs'])).toBe(usgs);
    });

    it('falls back to the first member when no agency in the group matches the priority list', () => {
        const gdacs = event({ agency: 'gdacs', agencyNativeId: 'g1' });
        expect(selectCanonical([gdacs], ['ncs', 'usgs'])).toBe(gdacs);
    });
});

describe('scoreConfidence', () => {
    it('is high when 2+ distinct agencies agree', () => {
        const a = event({ agency: 'usgs' });
        const b = event({ agency: 'ncs' });
        expect(scoreConfidence([a, b])).toBe('high');
    });

    it('is low for a single agency report', () => {
        const a = event({ agency: 'usgs' });
        expect(scoreConfidence([a])).toBe('low');
    });
});
