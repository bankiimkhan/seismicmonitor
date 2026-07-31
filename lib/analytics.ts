"use client";

// Custom-event sink. Currently a no-op.
//
// This used to forward to @vercel/analytics, which went away with the move to
// Cloudflare Workers. Cloudflare Web Analytics (wired up in app/layout.tsx)
// covers pageviews and Core Web Vitals -- the two things @vercel/analytics and
// @vercel/speed-insights were actually providing here -- but it has no custom
// event API, so the `first_visit` / `return_visit` signals from
// components/AnalyticsEvents.tsx have nowhere to go right now.
//
// The wrapper is kept (rather than deleting the call sites) so that adding a
// provider later -- Cloudflare Analytics Engine behind a small route handler,
// or a third-party product-analytics SDK -- stays a one-file change, which was
// the point of this indirection to begin with.
export function track(event: string, props?: Record<string, string | number | boolean>) {
    // Intentionally empty: no custom-event backend configured.
    void event;
    void props;
}
