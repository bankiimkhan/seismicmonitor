"use client";
import { readLocal, writeLocal } from './safeStorage';

const KEY = 'device_id';

// A random, anonymous, per-browser identifier -- not tied to any account.
// Used only to (a) let felt_reports' unique(quake_id, device_id) constraint
// stop one device from submitting the same report twice, and (b) tell a
// first-time visitor from a returning one for the analytics retention proxy
// (see components/AnalyticsEvents.tsx). Never sent anywhere except our own
// Supabase project.
export function getDeviceId(): string {
    if (typeof window === 'undefined') return '';
    let id = readLocal(KEY);
    if (!id) {
        id = crypto.randomUUID();
        writeLocal(KEY, id);
    }
    return id;
}
