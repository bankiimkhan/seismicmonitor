import React from 'react';

export type Severity = 'stable' | 'warning' | 'critical';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; ring: string; icon: React.ReactNode }> = {
    critical: {
        label: 'Critical',
        color: 'text-danger',
        bg: 'bg-danger-bg',
        ring: 'ring-danger/20',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <polygon points="5,0 10,10 0,10" />
            </svg>
        ),
    },
    warning: {
        label: 'Warning',
        color: 'text-warning',
        bg: 'bg-warning-bg',
        ring: 'ring-warning/20',
        icon: (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <rect width="10" height="10" rx="2" />
            </svg>
        ),
    },
    stable: {
        label: 'Stable',
        color: 'text-success',
        bg: 'bg-success-bg',
        ring: 'ring-success/20',
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
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${config.color} ${config.bg} ${config.ring} ${className}`}>
            {config.icon}
            {config.label}
        </span>
    );
};

/** Neutral small pill for non-severity metadata (source tags, counts, etc). */
export const Tag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle ${className}`}>
        {children}
    </span>
);
