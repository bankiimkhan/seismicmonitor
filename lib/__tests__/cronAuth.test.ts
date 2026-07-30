import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isAuthorizedCronRequest } from '../cronAuth';

function requestWithAuth(header: string | null): NextRequest {
    const headers = new Headers();
    if (header !== null) headers.set('authorization', header);
    return new NextRequest('https://example.com/api/ingest', { headers });
}

describe('isAuthorizedCronRequest', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects when CRON_SECRET is unset, even with a matching-looking header', () => {
        vi.stubEnv('CRON_SECRET', '');
        expect(isAuthorizedCronRequest(requestWithAuth('Bearer '))).toBe(false);
        expect(isAuthorizedCronRequest(requestWithAuth('Bearer anything'))).toBe(false);
    });

    it('rejects a request with no authorization header', () => {
        vi.stubEnv('CRON_SECRET', 'topsecret');
        expect(isAuthorizedCronRequest(requestWithAuth(null))).toBe(false);
    });

    it('rejects a wrong or malformed bearer token', () => {
        vi.stubEnv('CRON_SECRET', 'topsecret');
        expect(isAuthorizedCronRequest(requestWithAuth('Bearer wrong'))).toBe(false);
        expect(isAuthorizedCronRequest(requestWithAuth('topsecret'))).toBe(false);
        expect(isAuthorizedCronRequest(requestWithAuth('bearer topsecret'))).toBe(false);
    });

    it('accepts the exact configured bearer token', () => {
        vi.stubEnv('CRON_SECRET', 'topsecret');
        expect(isAuthorizedCronRequest(requestWithAuth('Bearer topsecret'))).toBe(true);
    });
});
