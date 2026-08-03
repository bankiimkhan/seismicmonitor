"use client";
import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from '@/lib/safeStorage';

export const THEME_STORAGE_KEY = 'theme';

export function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

    useEffect(() => {
        // The inline no-flash script in layout.tsx sets data-theme before
        // hydration for the first paint, but React resets attributes on the
        // <html> root that aren't part of its own render output once it
        // hydrates, wiping it. Recompute the resolved theme here (same logic
        // as the inline script) and reapply it so it survives past hydration.
        const stored = readLocal(THEME_STORAGE_KEY);
        const resolved = stored === 'light' || stored === 'dark'
            ? stored
            : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', resolved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(resolved);
    }, []);

    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
        writeLocal(THEME_STORAGE_KEY, next);
    };

    return (
        <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="pad flex h-9 w-9 items-center justify-center text-foreground-muted hover:text-accent"
        >
            {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    );
}
