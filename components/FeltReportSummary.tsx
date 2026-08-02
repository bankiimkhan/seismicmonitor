"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n/LocaleProvider';

export function FeltReportSummary({ quakeId, refreshKey }: { quakeId: string; refreshKey: number }) {
    const { t } = useT();
    const [stats, setStats] = useState<{ count: number; avg: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        // `count: 'exact'` rather than `data.length`: PostgREST caps an
        // unbounded select at max-rows (1000 on Supabase) *without erroring*,
        // so a quake that ever passed 1000 reports would have silently
        // reported exactly "1000 reports" forever. The count comes from the
        // server; the mean is still over the returned page, which is the
        // honest limit of one request and plenty for a rough intensity read.
        supabase
            .from('felt_reports')
            .select('intensity', { count: 'exact' })
            .eq('quake_id', quakeId)
            .then(({ data, count, error }) => {
                if (cancelled || error || !data) return;
                const total = count ?? data.length;
                if (total === 0 || data.length === 0) {
                    setStats({ count: 0, avg: 0 });
                    return;
                }
                const avg = data.reduce((sum, r) => sum + r.intensity, 0) / data.length;
                setStats({ count: total, avg });
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
