"use client";

// Web Storage doesn't merely return null when it's unavailable -- *touching
// the property at all* throws a SecurityError when the browser denies storage
// to the document. The case that actually matters here is a cross-origin
// <iframe>, which is exactly how app/embed/page.tsx is meant to be used (see
// the snippet on /about), plus Safari private mode and "block third-party
// cookies" setups generally.
//
// An unguarded `localStorage.getItem(...)` inside an effect throws during
// commit and takes the whole React subtree down with it, so every call site
// goes through these helpers. hooks/useLocalStorageState.ts already had its
// own try/catch for the same reason; this is that guard, factored out so the
// non-hook call sites (theme, locale, device id, analytics) get it too.

function localStore(): Storage | null {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

export function readLocal(key: string): string | null {
    try {
        return localStore()?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

export function writeLocal(key: string, value: string): void {
    try {
        localStore()?.setItem(key, value);
    } catch {
        // storage blocked, or over quota -- callers all treat persistence as
        // best-effort, never as a precondition for rendering.
    }
}
