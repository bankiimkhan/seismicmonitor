"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/LocaleProvider';

const TABS = [
    { key: 'local', labelKey: 'nav.local' },
    { key: 'global', labelKey: 'nav.global' },
    { key: 'map', labelKey: 'nav.map' },
    { key: 'trends', labelKey: 'nav.trends' },
] as const;

interface HazardSubNavProps {
    /** e.g. "/wildfire" -- tabs link to `${basePath}/local`, `/global`, `/map`, `/trends`. */
    basePath: string;
}

/** Local/Global/Map/Trends tab bar shown under every hazard section's PageHero -- styled as the same pill segmented control already used for Home's USGS/NCS toggle and Trends' window selector, but as real links (each sub-page is its own route) rather than client-side-only state. */
export function HazardSubNav({ basePath }: HazardSubNavProps) {
    const pathname = usePathname();
    const { t } = useT();

    return (
        <div className="flex items-center gap-1 self-start overflow-x-auto rounded-full border border-border bg-surface p-1 md:self-auto">
            {TABS.map((tab) => {
                const href = `${basePath}/${tab.key}`;
                const active = pathname === href;
                return (
                    <Link
                        key={tab.key}
                        href={href}
                        className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-accent text-accent-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}
                    >
                        {t(tab.labelKey)}
                    </Link>
                );
            })}
        </div>
    );
}
