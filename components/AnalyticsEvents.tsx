"use client";
import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import { readLocal, writeLocal } from '@/lib/safeStorage';

const KEY = 'first_visit_recorded';

// Closest available proxy for return-visit/retention measurement (audit
// 9.4) without a real backend session store: a one-time localStorage flag
// distinguishes a visitor's first-ever pageview from every subsequent one.
// It's a coarse signal, not a substitute for real cohort retention the way a
// product-analytics tool (e.g. PostHog) would give you.
//
// Note: `track` is currently a no-op -- Cloudflare Web Analytics has no
// custom-event API, so these two events go nowhere until a sink is wired up.
// See lib/analytics.ts.
export function AnalyticsEvents() {
    useEffect(() => {
        const seen = readLocal(KEY);
        if (!seen) {
            writeLocal(KEY, '1');
            track('first_visit');
        } else {
            track('return_visit');
        }
    }, []);

    return null;
}
