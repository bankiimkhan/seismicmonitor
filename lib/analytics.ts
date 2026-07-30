"use client";
import { track as vercelTrack } from '@vercel/analytics';

// Thin wrapper so call sites don't import the vendor package directly --
// swapping analytics providers later touches this one file.
export function track(event: string, props?: Record<string, string | number | boolean>) {
    try {
        vercelTrack(event, props);
    } catch {
        // analytics must never break the app
    }
}
