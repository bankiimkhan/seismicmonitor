"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/LocaleProvider';

// Ordered by widening scope: where you are, the region containing it, then the
// whole world. Regional sits between Local and Global because that is the step
// it represents -- Local is a box around a point, Regional is one of the
// predefined regions in lib/regions.ts, Global is everything including events
// that fall outside every region.
const TABS = [
    { key: 'local', labelKey: 'nav.local' },
    { key: 'regional', labelKey: 'nav.regional' },
    { key: 'global', labelKey: 'nav.global' },
    { key: 'map', labelKey: 'nav.map' },
    { key: 'trends', labelKey: 'nav.trends' },
] as const;

interface HazardSubNavProps {
    /** e.g. "/wildfire" -- tabs link to `${basePath}/local`, `/regional`, `/global`, `/map`, `/trends`. */
    basePath: string;
}

/** Local/Regional/Global/Map/Trends tab bar shown under every hazard section's PageHero -- styled as the same pill segmented control already used for Home's USGS/NCS toggle and Trends' window selector, but as real links (each sub-page is its own route) rather than client-side-only state. */
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
