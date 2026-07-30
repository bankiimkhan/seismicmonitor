import { describe, it, expect } from 'vitest';
import { resolvePreferredSource } from '../sourcePriority';

describe('resolvePreferredSource', () => {
    it('prefers NCS first for South Asia coordinates', () => {
        expect(resolvePreferredSource(23.8, 90.4)).toEqual(['ncs', 'usgs', 'gdacs']); // Dhaka
    });

    it('falls back to the default list outside any region override', () => {
        expect(resolvePreferredSource(37.77, -122.42)).toEqual(['usgs', 'gdacs']); // San Francisco
    });

    it('returns the default list when no coordinates are given', () => {
        expect(resolvePreferredSource()).toEqual(['usgs', 'gdacs']);
    });
});
