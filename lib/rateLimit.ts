// Simple in-memory sliding-window rate limiter, keyed by IP.
//
// Known limitation: this state lives in the memory of a single Worker
// isolate, so it does not enforce a global limit across concurrent
// isolates -- a client could get a higher effective ceiling than
// `maxRequests` if requests land on different ones. (Same caveat as the
// serverless instances this ran on before; if anything it's looser here,
// since Cloudflare runs isolates in many colos.) That's an acceptable
// tradeoff at current traffic; for a real distributed limit, move the
// counter into a Durable Object keyed by IP -- that's the primitive built
// for exactly this -- without changing the call site below.
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
