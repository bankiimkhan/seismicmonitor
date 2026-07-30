"use client";
import { Card } from '@/components/ui/Card';
import { ShareButton } from '@/components/ShareButton';
import { useT } from '@/lib/i18n/LocaleProvider';

// The natural growth loop for a safety app is caretaking, not curiosity --
// people who use this want their family on it too (audit 4.2). No
// referral codes/accounts, consistent with the rest of the app staying
// login-free.
export function ShareAppCard() {
    const { t } = useT();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bd-earthquakes.vercel.app';

    return (
        <Card className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
                <p className="font-medium text-foreground">{t('share.app')}</p>
                <p className="mt-1 text-sm text-foreground-muted">{t('share.appDesc')}</p>
            </div>
            <ShareButton
                title="Seismic Monitor"
                text={t('share.appMessage')}
                url={appUrl}
                eventName="share_app"
                className="flex-shrink-0 rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-hover"
            />
        </Card>
    );
}
