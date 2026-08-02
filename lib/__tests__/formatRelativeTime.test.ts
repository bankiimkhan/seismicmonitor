import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
    const now = 1_700_000_000_000;

    it('returns "just now" for very recent timestamps', () => {
        expect(formatRelativeTime(now - 2000, now)).toBe('just now');
    });

    it('formats seconds', () => {
        expect(formatRelativeTime(now - 30_000, now)).toBe('30s ago');
    });

    it('formats minutes', () => {
        expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    });

    it('formats hours', () => {
        expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    });

    it('formats days', () => {
        expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
    });

    it('falls back to a locale date beyond 30 days', () => {
        const timestamp = now - 40 * 86_400_000;
        expect(formatRelativeTime(timestamp, now)).toBe(new Date(timestamp).toLocaleDateString());
    });

    // /quake/[id] renders USGS's `nextForecastTime` through this, and that is
    // always in the future -- every such instant used to hit the `< 5s` branch
    // on a negative diff and render "next update just now".
    describe('future timestamps', () => {
        it('formats minutes ahead', () => {
            expect(formatRelativeTime(now + 5 * 60_000, now)).toBe('in 5m');
        });

        it('formats hours ahead', () => {
            expect(formatRelativeTime(now + 6 * 3_600_000, now)).toBe('in 6h');
        });

        it('formats days ahead', () => {
            expect(formatRelativeTime(now + 2 * 86_400_000, now)).toBe('in 2d');
        });

        it('still says "just now" within the 5s dead zone either side', () => {
            expect(formatRelativeTime(now + 2000, now)).toBe('just now');
            expect(formatRelativeTime(now - 2000, now)).toBe('just now');
        });
    });
});
