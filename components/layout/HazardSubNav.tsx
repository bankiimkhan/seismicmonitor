"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/LocaleProvider';

// Ordered by widening scope: one region, then the whole world.
//
// There is no Local tab. It was a +/-15-degree box around the user's own point,
// which is a different shape from a region rather than a smaller one -- from
// Dhaka it reached east past South Asia's edge into Thailand while excluding
// Afghanistan and Pakistan, so its count agreed with neither Regional nor
// Global. Region membership (lib/regions.ts) is now the only geographic
// bucketing in the app, which is what lets one count mean one thing.
const TABS = [
    { key: 'regional', labelKey: 'nav.regional' },
    { key: 'global', labelKey: 'nav.global' },
    { key: 'map', labelKey: 'nav.map' },
    { key: 'trends', labelKey: 'nav.trends' },
] as const;

interface HazardSubNavProps {
    /** e.g. "/wildfire" -- tabs link to `${basePath}/regional`, `/global`, `/map`, `/trends`. */
    basePath: string;
}

/** Regional/Global/Map/Trends tab bar shown under every hazard section's PageHero -- styled as the same pill segmented control used elsewhere, but as real links (each sub-page is its own route) rather than client-side-only state. */
export function HazardSubNav({ basePath }: HazardSubNavProps) {
    const pathname = usePathname();
    const { t } = useT();

    return (
        <div className="bezel flex items-center gap-1 self-start overflow-x-auto p-1 md:self-auto">
            {TABS.map((tab) => {
                const href = `${basePath}/${tab.key}`;
                const active = pathname === href;
                return (
                    <Link
                        key={tab.key}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={`pad flex-shrink-0 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${active ? 'bg-accent text-accent-foreground shadow-[var(--glow-sm)]' : 'bg-transparent text-foreground-muted hover:text-accent'}`}
                    >
                        {t(tab.labelKey)}
                    </Link>
                );
            })}
        </div>
    );
}
