import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkRateLimit, clientIpFrom } from '../rateLimit';

describe('checkRateLimit', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows requests under the limit', () => {
        const key = `test-${Math.random()}`;
        const result = checkRateLimit(key, { windowMs: 60_000, maxRequests: 3 });
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it('blocks once the limit is hit within the window', () => {
        const key = `test-${Math.random()}`;
        checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 });
        checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 });
        const third = checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 });
        expect(third.ok).toBe(false);
        expect(third.remaining).toBe(0);
    });

    it('resets after the window elapses', () => {
        vi.useFakeTimers();
        const key = `test-${Math.random()}`;
        checkRateLimit(key, { windowMs: 1000, maxRequests: 1 });
        expect(checkRateLimit(key, { windowMs: 1000, maxRequests: 1 }).ok).toBe(false);

        vi.advanceTimersByTime(1100);
        expect(checkRateLimit(key, { windowMs: 1000, maxRequests: 1 }).ok).toBe(true);
    });
});

describe('clientIpFrom', () => {
    it('reads the first entry of x-forwarded-for', () => {
        const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
        expect(clientIpFrom(headers)).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip', () => {
        const headers = new Headers({ 'x-real-ip': '9.9.9.9' });
        expect(clientIpFrom(headers)).toBe('9.9.9.9');
    });

    it('falls back to "unknown" with no headers', () => {
        expect(clientIpFrom(new Headers())).toBe('unknown');
    });
});
