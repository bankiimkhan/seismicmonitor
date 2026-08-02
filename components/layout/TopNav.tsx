"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavMenu, useNavLinks, NAV_ICONS } from './NavMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Modal } from '@/components/ui/Modal';
import { MenuIcon } from '@/components/ui/icons';
import { useT } from '@/lib/i18n/LocaleProvider';
import { useScrollY } from '@/hooks/useScrollY';

export function TopNav() {
    const pathname = usePathname();
    const { t } = useT();
    const links = useNavLinks();
    const scrolled = useScrollY() > 8;
    const [drawerOpen, setDrawerOpen] = useState(false);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setDrawerOpen(false); }, [pathname]);

    return (
        <>
            <header
                className={`sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-4 px-4 backdrop-blur-2xl transition-all duration-[var(--duration-slow)] md:px-6 ${scrolled ? 'border-b border-border-strong/90 bg-background/90 shadow-[0_4px_28px_rgba(0,0,0,0.9)]' : 'border-b border-border/60 bg-background/80'
                    }`}
            >
                <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open menu"
                    className="-ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-hover hover:text-accent lg:hidden"
                >
                    <MenuIcon size={18} />
                </button>

                <Link href="/" className="flex flex-shrink-0 items-center gap-2 font-semibold tracking-tight text-foreground group">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground shadow-[0_0_12px_rgba(0,240,255,0.4)] transition-shadow group-hover:shadow-[0_0_20px_rgba(0,240,255,0.8)]">S</span>
                    <span className="hidden font-mono text-sm font-bold uppercase tracking-widest text-foreground sm:inline">Seismic</span>
                </Link>

                <nav className="hidden items-center gap-1 lg:flex">
                    {links.map((link) => {
                        const Icon = NAV_ICONS[link.key];
                        const active = link.href === '/' ? pathname === '/' : !!pathname?.startsWith(link.href);
                        return (
                            <Link
                                key={link.key}
                                href={link.href}
                                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-mono font-medium transition-all duration-200 ${active ? 'text-accent font-semibold drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]' : 'text-foreground-muted hover:text-accent hover:bg-surface-hover/60'}`}
                            >
                                <Icon size={15} strokeWidth={active ? 2 : 1.75} />
                                {link.label}
                                {active && (
                                    <span
                                        className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-accent shadow-[0_0_12px_2px_var(--accent)]"
                                        aria-hidden="true"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                    <div className="hidden items-center gap-1.5 rounded-full border border-success/40 bg-surface/90 px-3 py-1 shadow-[0_0_12px_rgba(0,255,102,0.2)] sm:flex">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_#00ff66]" />
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-success">{t('nav.live')}</span>
                    </div>

                    <ThemeToggle />
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
