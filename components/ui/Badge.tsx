import React from 'react';

export type Severity = 'stable' | 'warning' | 'critical';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; ring: string; shadow: string; icon: React.ReactNode }> = {
    critical: {
        label: 'Critical',
        color: 'text-danger font-mono font-semibold',
        bg: 'bg-danger-bg/80',
        ring: 'ring-danger/50',
        shadow: 'shadow-[0_0_12px_rgba(255,42,109,0.35)]',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <polygon points="5,0 10,10 0,10" />
            </svg>
        ),
    },
    warning: {
        label: 'Warning',
        color: 'text-warning font-mono font-semibold',
        bg: 'bg-warning-bg/80',
        ring: 'ring-warning/50',
        shadow: 'shadow-[0_0_12px_rgba(255,183,0,0.35)]',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <rect width="10" height="10" rx="2" />
            </svg>
        ),
    },
    stable: {
        label: 'Stable',
        color: 'text-success font-mono font-semibold',
        bg: 'bg-success-bg/80',
        ring: 'ring-success/50',
        shadow: 'shadow-[0_0_12px_rgba(0,255,102,0.35)]',
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

export const Badge: React.FC<{ severity: Severity; className?: string }> = ({ severity, className = '' }) => {
    const config = SEVERITY_CONFIG[severity];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs tracking-wider uppercase ring-1 ${config.color} ${config.bg} ${config.ring} ${config.shadow} ${className}`}>
            {config.icon}
            {config.label}
        </span>
    );
};

/** Neutral small pill for non-severity metadata (source tags, counts, etc). */
export const Tag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center gap-1 rounded-md border border-border/80 bg-surface/90 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-muted shadow-xs ${className}`}>
        {children}
    </span>
);
