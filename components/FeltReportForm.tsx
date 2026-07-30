"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { useT } from '@/lib/i18n/LocaleProvider';
import { track } from '@/lib/analytics';

export function FeltReportForm({ quakeId, onSubmitted }: { quakeId: string; onSubmitted?: () => void }) {
    const { t } = useT();
    const [intensity, setIntensity] = useState(3);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [failed, setFailed] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        setFailed(false);
        const { error } = await supabase.from('felt_reports').insert({
            quake_id: quakeId,
            device_id: getDeviceId(),
            intensity,
            comment: comment.trim() || null,
        });
        setSubmitting(false);
        // A unique(quake_id, device_id) violation just means this device
        // already reported -- treat that as success too, not an error.
        if (!error || error.code === '23505') {
            setSubmitted(true);
            track('felt_report_submitted', { quakeId, intensity });
            onSubmitted?.();
        } else {
            // Anything else (RLS rejection, network, Supabase down) used to
            // leave the form looking untouched, so a failed submission was
            // indistinguishable from one that never happened.
            setFailed(true);
        }
    };

    if (submitted) {
        return <p className="text-sm text-success">{t('quake.reportSubmitted')}</p>;
    }

    return (
        <div className="space-y-3">
            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="felt-intensity" className="text-xs font-medium text-foreground-muted">
                        {t('quake.intensity')}
                    </label>
                    <span className="font-mono text-xs font-semibold text-foreground">{intensity}</span>
                </div>
                <input
                    id="felt-intensity"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={intensity}
                    onChange={(e) => setIntensity(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--accent)]"
                />
            </div>
            <div>
                <label htmlFor="felt-comment" className="mb-1.5 block text-xs font-medium text-foreground-muted">
                    {t('quake.comment')}
                </label>
                <textarea
                    id="felt-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 500))}
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-foreground-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
            </div>
            <Button onClick={submit} disabled={submitting}>
                {t('quake.submitReport')}
            </Button>
            {failed && (
                <p role="alert" className="text-sm text-danger">
                    Couldn&apos;t submit that report -- please try again.
                </p>
            )}
        </div>
    );
}
