import { describe, it, expect } from 'vitest';
import { parseScope, scopeToParams, hoursForWindow, scopeLabel } from '../hazardModel';
import { regionForPointStrict, regionForPoint } from '../regions';

describe('regionForPointStrict', () => {
    it('resolves a point to the region containing it', () => {
        expect(regionForPointStrict(23.8, 90.4)?.id).toBe('south-asia');
        expect(regionForPointStrict(35.7, 139.7)?.id).toBe('east-asia');
    });

    // The whole reason this function exists. `region_id` on hazard_events was
    // populated with regionForPoint's nearest-region fallback, which is why 794
    // earthquakes are stored as 'north-america' out to lng -179.6 -- well
    // outside that region's box. Classification must be able to say "nowhere".
    it('returns null for points outside every region', () => {
        // Mid-Pacific, far from any region box.
        expect(regionForPointStrict(-20, -140)).toBeNull();
        // Antarctic.
        expect(regionForPointStrict(-75, 0)).toBeNull();
    });

    it('differs from regionForPoint exactly where no region contains the point', () => {
        const outside = { lat: -20, lng: -140 };
        expect(regionForPointStrict(outside.lat, outside.lng)).toBeNull();
        // The labelling variant still answers, which is correct for naming a
        // user's own location but wrong for bucketing an event.
        expect(regionForPoint(outside.lat, outside.lng)).not.toBeNull();
    });

    // REGIONS overlap deliberately and priority order breaks the tie, so a
    // bbox prefilter alone cannot decide membership.
    it('honours priority order where regions overlap', () => {
        // Inside both south-asia (5..40, 60..100) and central-asia (35..56, 46..88);
        // south-asia is listed first.
        expect(regionForPointStrict(37, 70)?.id).toBe('south-asia');
    });

    it('treats non-finite coordinates as unclassifiable', () => {
        expect(regionForPointStrict(NaN, 90)).toBeNull();
        expect(regionForPointStrict(23, Infinity)).toBeNull();
    });
});

describe('scope round-trip', () => {
    it('survives serialization for every scope kind', () => {
        for (const scope of [
            { kind: 'global' } as const,
            { kind: 'region', regionId: 'east-asia' } as const,
            { kind: 'point', lat: 23.8, lng: 90.4, rangeDeg: 15 } as const,
        ]) {
            expect(parseScope(scopeToParams(scope))).toEqual(scope);
        }
    });

    // Falling back wide over-reports; falling back narrow would hide events the
    // caller asked to see. Only the first is acceptable.
    it('falls back to global rather than a narrower scope on bad input', () => {
        expect(parseScope(new URLSearchParams('scope=region&regionId=atlantis'))).toEqual({ kind: 'global' });
        expect(parseScope(new URLSearchParams('scope=point&lat=abc&lng=90'))).toEqual({ kind: 'global' });
        expect(parseScope(new URLSearchParams('scope=point&lat=23'))).toEqual({ kind: 'global' });
        expect(parseScope(new URLSearchParams(''))).toEqual({ kind: 'global' });
    });
});

describe('window presets', () => {
    // Home's 24H/7D toggle and every other surface must agree to the hour.
    it('maps the two presets to exact hour counts', () => {
        expect(hoursForWindow('24h')).toBe(24);
        expect(hoursForWindow('7d')).toBe(168);
    });
});

describe('scopeLabel', () => {
    it('names each scope for display', () => {
        expect(scopeLabel({ kind: 'global' })).toBe('Worldwide');
        expect(scopeLabel({ kind: 'region', regionId: 'south-asia' })).toBe('South Asia');
        expect(scopeLabel({ kind: 'point', lat: 0, lng: 0, rangeDeg: 15 })).toBe('Near you');
    });
});
