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

    const addLocation = (loc: Omit<SavedLocation, 'id'>) => {
        const entry: SavedLocation = { ...loc, id: crypto.randomUUID() };
        setLocations((prev) => {
            const exists = prev.some(
                (p) => Math.abs(p.lat - loc.lat) < 0.01 && Math.abs(p.lng - loc.lng) < 0.01
            );
            return exists ? prev : [...prev, entry];
        });
        return entry;
    };

    const removeLocation = (id: string) => {
        setLocations((prev) => prev.filter((l) => l.id !== id));
    };

    return { locations, addLocation, removeLocation };
}
