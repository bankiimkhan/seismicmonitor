"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n/LocaleProvider';

export function FeltReportSummary({ quakeId, refreshKey }: { quakeId: string; refreshKey: number }) {
    const { t } = useT();
    const [stats, setStats] = useState<{ count: number; avg: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        supabase
            .from('felt_reports')
            .select('intensity')
            .eq('quake_id', quakeId)
            .then(({ data, error }) => {
                if (cancelled || error || !data) return;
                if (data.length === 0) {
                    setStats({ count: 0, avg: 0 });
                    return;
                }
                const avg = data.reduce((sum, r) => sum + r.intensity, 0) / data.length;
                setStats({ count: data.length, avg });
            });
        return () => { cancelled = true; };
    }, [quakeId, refreshKey]);

    if (!stats || stats.count === 0) return null;

    return (
        <p className="text-sm text-foreground-muted">
            {t('quake.reportsCount', { count: stats.count, plural: stats.count === 1 ? '' : 's' })}
            {' '}({t('quake.avgIntensity', { avg: stats.avg.toFixed(1) })})
        </p>
    );
}
