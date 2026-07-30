"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, ActivityIcon, WavesIcon, InfoIcon } from '@/components/ui/icons';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';
import { useT } from '@/lib/i18n/LocaleProvider';

// Reorganized (per the navbar restructure) around hazard types instead of
// earthquake-only Local/Global/Map -- each hazard link now points at that
// hazard's section index (redirects to its own /global), and Local/Global/
// Map/Trends live one level down as HazardSubNav tabs. Icons for the 5
// non-earthquake hazards come straight from lib/hazardConfig.ts (same icon
// used on that section's own PageHero) rather than being duplicated here.
export const NAV_ICONS = {
    overview: HomeIcon,
    earthquake: ActivityIcon,
    tsunami: WavesIcon,
    cyclone: HAZARD_CONFIG.cyclone.icon,
    landslide: HAZARD_CONFIG.landslide.icon,
    volcano: HAZARD_CONFIG.volcano.icon,
    wildfire: HAZARD_CONFIG.wildfire.icon,
    about: InfoIcon,
} as const;

export function useNavLinks() {
    const { t } = useT();
    return [
        { key: 'overview' as const, href: '/', label: t('nav.overview') },
        { key: 'earthquake' as const, href: '/earthquake', label: t('nav.earthquake') },
        { key: 'tsunami' as const, href: '/tsunami', label: t('nav.tsunami') },
        { key: 'cyclone' as const, href: '/cyclone', label: t('nav.cyclone') },
        { key: 'landslide' as const, href: '/landslide', label: t('nav.landslide') },
        { key: 'volcano' as const, href: '/volcano', label: t('nav.volcano') },
        { key: 'wildfire' as const, href: '/wildfire', label: t('nav.wildfire') },
        { key: 'about' as const, href: '/about', label: t('nav.about') },
    ];
}

/** Vertical link list used inside the mobile drawer (TopNav renders links horizontally itself on desktop). */
export function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const links = useNavLinks();

    return (
        <nav className="flex flex-col gap-0.5">
            {links.map((link) => {
                const Icon = NAV_ICONS[link.key];
                const active = link.href === '/' ? pathname === '/' : !!pathname?.startsWith(link.href);
                return (
                    <Link
                        key={link.key}
                        href={link.href}
                        onClick={onNavigate}
                        className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-accent-subtle text-accent' : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground'}`}
                    >
                        {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-accent shadow-[0_0_8px_1px_var(--accent)]" aria-hidden="true" />}
                        <Icon size={18} strokeWidth={active ? 2 : 1.75} className="flex-shrink-0 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] motion-safe:group-hover:scale-110" />
                        <span className="truncate">{link.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
