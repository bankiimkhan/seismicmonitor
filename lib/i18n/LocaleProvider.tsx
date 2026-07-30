"use client";
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dictionaries, locales, type Locale } from './dictionaries';
import { readLocal, writeLocal } from '@/lib/safeStorage';

const STORAGE_KEY = 'locale';

interface LocaleContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    // Starts 'en' so SSR and first client paint match; reconciled from
    // localStorage in an effect (same hydration-safe pattern as ThemeToggle).
    const [locale, setLocaleState] = useState<Locale>('en');

    useEffect(() => {
        const stored = readLocal(STORAGE_KEY);
        if (stored && locales.includes(stored as Locale)) {
            // One-time reconciliation from the SSR-safe 'en' default to the
            // stored preference -- can't be known at server-render time.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocaleState(stored as Locale);
        }
    }, []);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        writeLocal(STORAGE_KEY, l);
    }, []);

    const t = useCallback(
        (key: string, vars?: Record<string, string | number>) => {
            const raw = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
            return interpolate(raw, vars);
        },
        [locale]
    );

    return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useT() {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error('useT must be used within LocaleProvider');
    return ctx;
}
