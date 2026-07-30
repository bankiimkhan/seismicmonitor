"use client";

const PREFIX = 'quake_cache_';

export interface CachedQuake {
    id: string;
    source?: string;
    /** Nullable for the same reason /api/quake/[id] can return a null one -- see QuakeDetail. */
    mag: number | null;
    place: string;
    time: number;
    lat: number;
    lng: number;
    depth?: number;
    url?: string;
}

// The detail page (/quake/[id]) is reached two ways: clicked from a list
// that already has the full quake object in memory, or loaded cold (a
// shared link, a bookmark, a page refresh). The server-side lookup in
// /api/quake/[id] only knows about USGS's own per-event API and our own
// `earthquakes` history table -- which is empty for NCS events until the
// ingest cron has actually run (every 15 min in production; never locally
// unless triggered by hand). Stashing the object here at click time makes
// the common "clicked from a list I was just looking at" case work
// immediately, with the server lookup as a fallback for cold loads.
export function stashQuake(quake: CachedQuake) {
    try {
        sessionStorage.setItem(PREFIX + quake.id, JSON.stringify(quake));
    } catch {
        // sessionStorage unavailable/full -- the server-side lookup still
        // covers this case for USGS events, so failing silently is fine.
    }
}

export function getStashedQuake(id: string): CachedQuake | null {
    try {
        const raw = sessionStorage.getItem(PREFIX + id);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
