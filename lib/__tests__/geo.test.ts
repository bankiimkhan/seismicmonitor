import { describe, it, expect } from 'vitest';
import { distanceKm, formatDistanceKm, formatDepthKm } from '../geo';

describe('distanceKm', () => {
    it('returns 0 for the same point', () => {
        expect(distanceKm({ lat: 23.8, lng: 90.4 }, { lat: 23.8, lng: 90.4 })).toBeCloseTo(0, 5);
    });

    it('matches a known distance (Dhaka to Chittagong, ~245km)', () => {
        const dhaka = { lat: 23.8103, lng: 90.4125 };
        const chittagong = { lat: 22.3569, lng: 91.7832 };
        const km = distanceKm(dhaka, chittagong);
        expect(km).toBeGreaterThan(200);
        expect(km).toBeLessThan(280);
    });
});

describe('formatDistanceKm', () => {
    it('formats sub-1km distances', () => {
        expect(formatDistanceKm(0.4)).toBe('<1 km away');
    });
    it('formats close distances with one decimal', () => {
        expect(formatDistanceKm(4.2)).toBe('4.2 km away');
    });
    it('rounds larger distances', () => {
        expect(formatDistanceKm(123.6)).toBe('124 km away');
    });
});

describe('formatDepthKm', () => {
    it('labels near-zero depth as surface', () => {
        expect(formatDepthKm(0.2)).toBe('surface');
    });
    it('rounds deeper values', () => {
        expect(formatDepthKm(12.4)).toBe('12 km deep');
    });
});
