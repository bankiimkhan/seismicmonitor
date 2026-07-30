// Simple in-memory sliding-window rate limiter, keyed by IP.
//
// Known limitation: this state lives in the memory of a single serverless
// instance, so it does not enforce a global limit across concurrent
// instances -- a client could get a higher effective ceiling than
// `maxRequests` if requests land on different instances. That's an
// acceptable tradeoff at current traffic; if this app needs a real
// distributed limit later, swap this for Upstash Redis (fixed-window or
// sliding-window) without changing the call site below.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const hits = new Map<string, number[]>();

// Bound memory: drop the oldest keys once we're tracking too many distinct
// IPs, rather than growing forever.
const MAX_TRACKED_KEYS = 5000;

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    resetMs: number;
}

export function checkRateLimit(
    key: string,
    { windowMs = WINDOW_MS, maxRequests = MAX_REQUESTS }: { windowMs?: number; maxRequests?: number } = {}
): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (hits.size > MAX_TRACKED_KEYS && !hits.has(key)) {
        const oldestKey = hits.keys().next().value;
        if (oldestKey !== undefined) hits.delete(oldestKey);
    }

    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    const ok = timestamps.length < maxRequests;

    if (ok) {
        timestamps.push(now);
    }
    hits.set(key, timestamps);

    const oldest = timestamps[0] ?? now;
    return {
        ok,
        remaining: Math.max(0, maxRequests - timestamps.length),
        resetMs: Math.max(0, oldest + windowMs - now),
    };
}

export function clientIpFrom(headers: Headers): string {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return headers.get('x-real-ip') || 'unknown';
}
