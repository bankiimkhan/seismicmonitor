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

/** The face's masthead: a lit bezel with the section name in display type. */
export function PageHero({ title, description, icon, actions, children, className = '' }: PageHeroProps) {
    return (
        <header className={`bezel relative mb-8 px-5 py-7 shadow-[var(--glow-sm),inset_0_0_40px_rgb(var(--accent-rgb)/0.06)] md:px-7 md:py-8 ${className}`}>
            <span className="legend absolute -top-[9px] left-5 px-2 text-[10px] font-bold leading-[18px]">
                Module
            </span>

            <Reveal variant="fade-up" className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="flex items-start gap-4">
                    {icon && (
                        <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center border-2 border-accent/50 text-accent shadow-[var(--glow-xs)] md:flex" style={{ borderRadius: 'var(--radius-md)' }}>
                            {icon}
                        </span>
                    )}
                    <div className="min-w-0">
                        {/* Plain glowing amber, not `.vfd`: the dot matrix is
                            for numerals. Across a heading's thin strokes the
                            grid eats the letterforms. */}
                        <h1 className="glow-text text-2xl font-bold text-accent md:text-3xl">{title}</h1>
                        {description && (
                            <p className="mt-3 max-w-2xl text-xs leading-relaxed tracking-wider text-foreground-muted">{description}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex-shrink-0">{actions}</div>}
            </Reveal>

            {children && <div className="relative mt-6">{children}</div>}
        </header>
    );
}
