import React from 'react';
import { Card } from './Card';
import { AnimatedCounter } from './AnimatedCounter';
import { Sparkline } from './Sparkline';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

interface StatCardProps {
    label: string;
    value: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    icon?: React.ReactNode;
    /** Positive renders as an "up" trend in success color, negative as "down" in danger color. */
    trend?: { value: number; label?: string } | null;
    sparkline?: number[];
    elevated?: boolean;
    /** Adds hover-lift + pointer affordance for stat cards that are themselves a click target (wrap in Link separately). */
    interactive?: boolean;
    className?: string;
    footer?: React.ReactNode;
}

export function StatCard({
    label, value, decimals = 0, prefix = '', suffix = '', icon, trend, sparkline, elevated, interactive, className = '', footer,
}: StatCardProps) {
    const trendPositive = !!trend && trend.value >= 0;

    return (
        <Card elevated={elevated} interactive={interactive} className={`flex flex-col gap-3 ${className}`}>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{label}</p>
                {icon && (
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
                        {icon}
                    </span>
                )}
            </div>
            <div className="flex items-end justify-between gap-3">
                <p className="font-mono text-3xl font-bold tracking-tight text-foreground">
                    <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
                </p>
                {sparkline && sparkline.length > 1 && (
                    <Sparkline data={sparkline} className="h-8 w-20 flex-shrink-0" />
                )}
            </div>
            {(trend || footer) && (
                <div className="flex items-center justify-between text-xs">
                    {trend ? (
                        <span className={`inline-flex items-center gap-1 font-medium ${trendPositive ? 'text-success' : 'text-danger'}`}>
                            {trendPositive ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
                            {Math.abs(trend.value).toFixed(1)}{trend.label ?? ''}
                        </span>
                    ) : <span />}
                    {footer && <span className="text-foreground-subtle">{footer}</span>}
                </div>
            )}
        </Card>
    );
}
