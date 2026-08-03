import React from 'react';

export type Severity = 'stable' | 'warning' | 'critical';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; border: string; bg: string; led: string; icon: React.ReactNode }> = {
    critical: {
        label: 'Critical',
        color: 'text-danger',
        border: 'border-danger/70',
        bg: 'bg-[rgb(var(--danger-rgb)/0.14)]',
        led: 'led-danger',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <polygon points="5,0 10,10 0,10" />
            </svg>
        ),
    },
    warning: {
        label: 'Warning',
        color: 'text-warning',
        border: 'border-warning/70',
        bg: 'bg-[rgb(var(--warning-rgb)/0.13)]',
        led: 'led-warning',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <rect width="10" height="10" rx="1" />
            </svg>
        ),
    },
    stable: {
        label: 'Stable',
        color: 'text-success',
        border: 'border-success/70',
        bg: 'bg-[rgb(var(--success-rgb)/0.12)]',
        led: 'led-success',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="5" r="5" />
            </svg>
        ),
    },
};

export function getSeverity(mag: number): Severity {
    if (mag >= 6.0) return 'critical';
    if (mag >= 5.0) return 'warning';
    return 'stable';
}

/**
 * Lit status indicator. Hue, glyph shape and the written label all carry the
 * same state, so severity survives both a monochrome render and the amber-on-
 * amber neighbours it sits among.
 */
export const Badge: React.FC<{ severity: Severity; className?: string }> = ({ severity, className = '' }) => {
    const config = SEVERITY_CONFIG[severity];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${config.color} ${config.border} ${config.bg} ${className}`}>
            <span className={`led led-on h-2 w-2 flex-shrink-0 ${config.led}`} aria-hidden="true" />
            {config.icon}
            {config.label}
        </span>
    );
};

/** Unlit metadata chip (source tags, counts, etc) -- outlined only, so it never reads as an active signal. */
export const Tag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center gap-1 rounded-sm border border-accent/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground-muted ${className}`}>
        {children}
    </span>
);
