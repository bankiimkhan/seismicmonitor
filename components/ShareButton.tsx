"use client";
import { useState } from 'react';
import { useT } from '@/lib/i18n/LocaleProvider';
import { track } from '@/lib/analytics';
import { ShareIcon } from '@/components/ui/icons';

interface ShareButtonProps {
    title: string;
    text?: string;
    url: string;
    eventName: string;
    className?: string;
}

// Web Share API where available (mobile browsers, most desktop browsers as
// of 2026), clipboard-copy fallback otherwise. Used both per-event (4.1)
// and app-wide via the "share this app" prompt (4.2) -- same primitive,
// different url/text.
export function ShareButton({ title, text, url, eventName, className = '' }: ShareButtonProps) {
    const { t } = useT();
    const [copied, setCopied] = useState(false);

    const share = async () => {
        track(eventName);
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return;
            } catch {
                // user cancelled or share failed -- fall through to copy
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard blocked; nothing more we can do silently
        }
    };

    return (
        <button
            type="button"
            onClick={share}
            className={`inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-accent ${className}`}
        >
            <ShareIcon size={13} strokeWidth={2} />
            {copied ? t('quake.copied') : t('quake.share')}
        </button>
    );
}
