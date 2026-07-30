"use client";
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/Button';
import { CopyIcon, CheckCircleIcon } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { useT } from '@/lib/i18n/LocaleProvider';
import { useToast } from '@/components/ui/Toast';

interface HealthSource { source: string; status: string; checked_at: string }

export default function AboutPage() {
    const { t } = useT();
    const toast = useToast();
    const [health, setHealth] = useState<HealthSource[]>([]);
    const [copied, setCopied] = useState(false);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bd-earthquakes.vercel.app';
    const embedSnippet = `<iframe src="${appUrl}/embed" style="width:100%;height:520px;border:0;border-radius:8px" loading="lazy"></iframe>`;

    useEffect(() => {
        fetch('/api/health').then((r) => r.json()).then((d) => setHealth(d.sources ?? [])).catch(() => {});
    }, []);

    const ncs = health.find((h) => h.source === 'ncs');

    const copySnippet = async () => {
        try {
            await navigator.clipboard.writeText(embedSnippet);
            setCopied(true);
            toast('Embed snippet copied to clipboard', 'success');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast("Couldn't copy -- select the snippet manually", 'error');
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
            <PageHero title={t('about.title')} />

            <div className="space-y-4">
                <Card>
                    <p className="mb-3 text-sm font-semibold text-foreground">{t('about.dataTitle')}</p>
                    <ul className="space-y-3 text-sm text-foreground-muted">
                        <li>{t('about.usgs')}</li>
                        <li>{t('about.ncs')}</li>
                    </ul>
                    <p className="mt-3 border-t border-border pt-3 text-sm text-foreground-muted">{t('about.fallback')}</p>
                    <p className="mt-3 text-sm text-foreground-muted">{t('about.refresh')}</p>
                </Card>

                <Card>
                    <p className="mb-3 text-sm font-semibold text-foreground">{t('about.health')}</p>
                    <div className="space-y-2">
                        {health.length === 0 && <p className="text-sm text-foreground-subtle">…</p>}
                        {health.map((h) => (
                            <div key={h.source} className="flex items-center justify-between text-sm">
                                <span className="uppercase text-foreground-muted">{h.source}</span>
                                <span className={`inline-flex items-center gap-1.5 ${h.status === 'online' ? 'text-success' : 'text-warning'}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${h.status === 'online' ? 'bg-success' : 'bg-warning'}`} />
                                    {h.status === 'online'
                                        ? t('about.healthOnline')
                                        : t('about.healthFallback', { time: formatRelativeTime(new Date(h.checked_at).getTime()) })}
                                </span>
                            </div>
                        ))}
                    </div>
                    {ncs?.status === 'fallback' && (
                        <p className="mt-3 border-t border-border pt-3 text-xs text-foreground-subtle">{t('quake.fallbackNotice')}</p>
                    )}
                </Card>

                <Card>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{t('about.embed')}</p>
                        <Button variant="secondary" size="sm" onClick={copySnippet}>
                            {copied ? <CheckCircleIcon size={14} className="text-success" /> : <CopyIcon size={14} />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                    <p className="mb-3 text-sm text-foreground-muted">{t('about.embedDesc')}</p>
                    <pre className="overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-foreground-muted">
                        <code>{embedSnippet}</code>
                    </pre>
                </Card>

                <Card>
                    <p className="mb-1 text-sm font-semibold text-foreground">{t('about.who')}</p>
                    <p className="text-sm text-foreground-muted">{t('about.whoDesc')}</p>
                </Card>
            </div>
        </div>
    );
}
