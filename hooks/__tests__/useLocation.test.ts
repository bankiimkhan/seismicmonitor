import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLocation } from '../useLocation';

const STORAGE_KEY = 'last_location';

describe('useLocation', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('restores a location saved on a previous visit', async () => {
        // useLocalStorageState only reads storage in an effect, so the hook's
        // first render always sees `null` -- the location has to survive that
        // gap rather than being captured once at mount.
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ lat: 23.8, lng: 90.4, label: 'Dhaka', source: 'manual' })
        );

        const { result } = renderHook(() => useLocation());

        await waitFor(() => {
            expect(result.current.location).toEqual({
                lat: 23.8,
                lng: 90.4,
                label: 'Dhaka',
                source: 'manual',
            });
        });
        // ...and a returning visitor isn't asked for their location again.
        expect(result.current.status).toBe('located');
    });

    it('prompts when nothing has been saved yet', async () => {
        const { result } = renderHook(() => useLocation());

        await waitFor(() => expect(result.current.status).toBe('prompting'));
        expect(result.current.location).toBeNull();
    });

    it('persists a manually entered location for the next visit', async () => {
        const { result } = renderHook(() => useLocation());
        await waitFor(() => expect(result.current.status).toBe('prompting'));

        act(() => {
            result.current.setManualLocation({ lat: 22.3, lng: 91.8, label: 'Chittagong' });
        });

        expect(result.current.status).toBe('located');
        expect(result.current.location).toMatchObject({ lat: 22.3, lng: 91.8, source: 'manual' });
        await waitFor(() => {
            expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ label: 'Chittagong' });
        });
    });
});
