"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavMenu, useNavLinks, NAV_ICONS } from './NavMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Modal } from '@/components/ui/Modal';
import { MenuIcon } from '@/components/ui/icons';
import { useScrollY } from '@/hooks/useScrollY';

/** IEC power glyph -- the panel's home key. */
function PowerIcon({ size = 22 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3v9" />
            <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
    );
}

export function TopNav() {
    const pathname = usePathname();
    const links = useNavLinks();
    const scrolled = useScrollY() > 8;
    const [drawerOpen, setDrawerOpen] = useState(false);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setDrawerOpen(false); }, [pathname]);

    const activeLink = links.find((link) =>
        link.href === '/' ? pathname === '/' : !!pathname?.startsWith(link.href)
    );

    return (
        <>
            <header
                className={`sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-3 px-3 backdrop-blur-xl transition-all duration-[var(--duration-slow)] md:gap-4 md:px-5 ${scrolled ? 'border-b-2 border-accent/50 bg-background/95' : 'border-b-2 border-accent/25 bg-background/85'}`}
            >
                {/* Power key -- doubles as the home link, the way a hardware
                    face has exactly one way back to the top. */}
                <Link
                    href="/"
                    aria-label="Overview"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-accent transition-all hover:text-accent-hover drop-shadow-[0_0_10px_rgb(var(--accent-rgb)/0.7)] hover:drop-shadow-[0_0_16px_rgb(var(--accent-rgb)/0.9)]"
                >
                    <PowerIcon />
                </Link>

                {/* Current module, shown as the panel's main legend display. */}
                <div className="bezel flex h-10 min-w-0 flex-1 items-center justify-center px-3 md:flex-none md:w-auto md:min-w-[280px]">
                    <span className="vfd truncate text-sm font-bold uppercase md:text-base">
                        {activeLink ? `${activeLink.label}` : 'Seismic Monitor'}
                    </span>
                </div>

                {/* xl, not lg: eight hazard links in a mono face need ~1150px
                    and were overflowing the bar between 1024 and 1280. */}
                <nav className="ml-auto hidden items-center gap-1 xl:flex">
                    {links.map((link) => {
                        const Icon = NAV_ICONS[link.key];
                        const active = link.key === activeLink?.key;
                        return (
                            <Link
                                key={link.key}
                                href={link.href}
                                aria-current={active ? 'page' : undefined}
                                className={`pad flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${active ? 'bg-accent text-accent-foreground shadow-[var(--glow-sm)]' : 'bg-transparent text-foreground-muted hover:text-accent'}`}
                            >
                                <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex flex-shrink-0 items-center gap-2 xl:ml-0">
                    <ThemeToggle />
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Open menu"
                        className="pad flex h-9 w-9 flex-shrink-0 items-center justify-center xl:hidden"
                    >
                        <MenuIcon size={18} />
                    </button>
                </div>
            </header>

            <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left" title="Menu">
                <div className="p-3">
                    <NavMenu onNavigate={() => setDrawerOpen(false)} />
                </div>
            </Modal>
        </>
    );
}
