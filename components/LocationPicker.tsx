"use client";
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
}

interface LocationPickerProps {
    onSelect: (loc: { lat: number; lng: number; label: string }) => void;
    onCancel?: () => void;
}

// Free-text city/place search via OpenStreetMap's Nominatim -- keyless, no
// account. Browsers don't allow overriding the User-Agent header from
// fetch(), but Nominatim's usage policy accepts the browser-supplied
// Referer as the identifying header for this kind of low-volume,
// client-side lookup: https://operations.osmfoundation.org/policies/nominatim/
export function LocationPicker({ onSelect, onCancel }: LocationPickerProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [failed, setFailed] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    const search = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        // Two quick submits could otherwise resolve out of order and leave the
        // earlier query's results showing under the later one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setSearched(true);
        setFailed(false);
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('q', query);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '5');
            const res = await fetch(url.toString(), { signal: controller.signal });
            if (!res.ok) throw new Error(`Nominatim status ${res.status}`);
            setResults(await res.json());
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            // A lookup failure is NOT "no matches" -- telling someone their
            // spelling is wrong when the geocoder is down sends them in
            // entirely the wrong direction.
            setResults([]);
            setFailed(true);
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <form onSubmit={search} className="flex gap-2">
                <Input
                    type="text"
                    placeholder="Search a city, e.g. Dhaka"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                />
                <Button type="submit" variant="secondary" disabled={loading}>
                    {loading ? 'Searching…' : 'Search'}
                </Button>
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
            </form>

            {failed && !loading && (
                <p role="alert" className="text-sm text-danger">
                    Place search is unavailable right now — this isn&apos;t about your spelling. Try again in a moment.
                </p>
            )}

            {searched && !failed && !loading && results.length === 0 && (
                <p className="text-sm text-foreground-muted">No matches. Try a different spelling or a larger nearby city.</p>
            )}

            {results.length > 0 && (
                <ul className="space-y-1">
                    {results.map((r, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                onClick={() =>
                                    onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name })
                                }
                                className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-accent/40 hover:bg-surface-hover"
                            >
                                {r.display_name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
