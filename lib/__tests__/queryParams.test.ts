import { describe, it, expect } from 'vitest';
import { finiteParam, finiteParamOr } from '../queryParams';

// These guards are the whole reason a malformed query string produces a
// default instead of a 500: an unguarded `Number('abc')` reaches
// `new Date(NaN).toISOString()` (uncaught RangeError) or lands `NaN` in a
// PostgREST filter, which fails the request rather than ignoring the filter.
describe('finiteParam', () => {
    it('parses ordinary numeric params', () => {
        expect(finiteParam('30')).toBe(30);
        expect(finiteParam('-12.5')).toBe(-12.5);
    });

    it('treats 0 as a real value, not as absent', () => {
        // The equator / prime meridian case -- a truthiness check here would
        // silently drop the coordinate and widen the query to worldwide.
        expect(finiteParam('0')).toBe(0);
    });

    it('returns undefined for absent, blank, or whitespace-only params', () => {
        expect(finiteParam(null)).toBeUndefined();
        expect(finiteParam('')).toBeUndefined();
        expect(finiteParam('   ')).toBeUndefined();
    });

    it('returns undefined for non-numeric and non-finite input rather than NaN/Infinity', () => {
        expect(finiteParam('abc')).toBeUndefined();
        expect(finiteParam('notanumber')).toBeUndefined();
        expect(finiteParam('Infinity')).toBeUndefined();
        expect(finiteParam('-Infinity')).toBeUndefined();
        expect(finiteParam('NaN')).toBeUndefined();
    });
});

describe('finiteParamOr', () => {
    it('falls back for unusable input', () => {
        expect(finiteParamOr('abc', 30)).toBe(30);
        expect(finiteParamOr(null, 200)).toBe(200);
        expect(finiteParamOr('', 50)).toBe(50);
    });

    it('keeps a valid value, including 0', () => {
        expect(finiteParamOr('7', 30)).toBe(7);
        expect(finiteParamOr('0', 30)).toBe(0);
    });

    it('never yields NaN, which is what reached the query builders before', () => {
        for (const raw of ['abc', '', null, 'NaN', 'Infinity']) {
            expect(Number.isFinite(finiteParamOr(raw, 42))).toBe(true);
        }
    });
});
