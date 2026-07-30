"use client";
import { useT } from '@/lib/i18n/LocaleProvider';

// Honest trust signal (audit 4.4): factual coverage, not a fabricated
// subscriber count -- there's no longer a push-notification system to
// source a real number from.
export function CoverageStrip() {
    const { t } = useT();
    return (
        <p className="text-center text-xs text-foreground-subtle">{t('coverage.strip')}</p>
    );
}
