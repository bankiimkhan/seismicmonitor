"use client";
import { Reveal } from '@/components/effects/Reveal';

interface PageHeroProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    /** Existing toolbar controls (source toggle, filters, etc.) -- rendered verbatim. */
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export function PageHero({ title, description, icon, actions, children, className = '' }: PageHeroProps) {
    return (
        <header className={`relative mb-8 overflow-hidden rounded-2xl border border-border/80 bg-surface/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(0,240,255,0.1)] px-5 py-8 md:px-8 md:py-10 ${className}`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
                <div
                    className="absolute -top-24 left-1/4 h-64 w-64 rounded-full opacity-[var(--hero-glow-opacity)] blur-3xl"
                    style={{ background: 'var(--glow-cyan)' }}
                />
                <div
                    className="absolute -top-16 right-1/5 h-56 w-56 rounded-full opacity-[var(--hero-glow-opacity)] blur-3xl"
                    style={{ background: 'var(--glow-purple)' }}
                />
            </div>

            <Reveal variant="fade-up" className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="flex items-start gap-4">
                    {icon && (
                        <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-[0_0_15px_rgba(0,240,255,0.2)] md:flex">
                            {icon}
                        </span>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
                        {description && (
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">{description}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex-shrink-0">{actions}</div>}
            </Reveal>

            {children && <div className="relative mt-6">{children}</div>}
        </header>
    );
}
