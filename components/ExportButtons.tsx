"use client";
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { exportQuakesAsCsv, exportQuakesAsJson } from '@/lib/exportQuakes';
import { useT } from '@/lib/i18n/LocaleProvider';
import { track } from '@/lib/analytics';

interface QuakeLike {
    id: string;
    properties: { mag: number; place: string; time: number; url: string };
    geometry: { coordinates: [number, number, number] };
}

export function ExportButtons({ quakes }: { quakes: QuakeLike[] }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary" onClick={() => setOpen((o) => !o)} disabled={quakes.length === 0}>
                {t('filters.export')}
            </Button>
            {open && (
                <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-md border border-border bg-surface shadow-md">
                    <button
                        type="button"
                        onClick={() => {
                            exportQuakesAsCsv(quakes);
                            track('export_csv', { count: quakes.length });
                            setOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    >
                        {t('filters.exportCsv')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            exportQuakesAsJson(quakes);
                            track('export_json', { count: quakes.length });
                            setOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                    >
                        {t('filters.exportJson')}
                    </button>
                </div>
            )}
        </div>
    );
}
