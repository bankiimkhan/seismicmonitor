"use client";
import { useLocalStorageState } from './useLocalStorageState';

export interface SavedLocation {
    id: string;
    label: string;
    lat: number;
    lng: number;
}

const STORAGE_KEY = 'saved_locations';

export function useSavedLocations() {
    const [locations, setLocations] = useLocalStorageState<SavedLocation[]>(STORAGE_KEY, []);

    /** Adds `loc` unless a near-identical point is already saved. Returns the
     * stored entry either way -- previously it always returned a freshly
     * id'd object, so a duplicate handed back an id that was never in the list
     * and could never be removed with it. */
    const addLocation = (loc: Omit<SavedLocation, 'id'>) => {
        const isSamePlace = (p: SavedLocation) =>
            Math.abs(p.lat - loc.lat) < 0.01 && Math.abs(p.lng - loc.lng) < 0.01;

        const existing = locations.find(isSamePlace);
        if (existing) return existing;

        const entry: SavedLocation = { ...loc, id: crypto.randomUUID() };
        setLocations((prev) => (prev.some(isSamePlace) ? prev : [...prev, entry]));
        return entry;
    };

    const removeLocation = (id: string) => {
        setLocations((prev) => prev.filter((l) => l.id !== id));
    };

    return { locations, addLocation, removeLocation };
}
