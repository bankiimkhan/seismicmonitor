import React from 'react';
import { Panel } from './Panel';
import { Readout } from './Readout';
import { AnimatedCounter } from './AnimatedCounter';
import { Sparkline } from './Sparkline';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

interface StatCardProps {
    label: string;
    value: number;
    /** Renders instead of the animated count when the real value isn't known
     * (e.g. the source failed). Keeps "we don't know" visually distinct from a
     * genuine zero, which a counter can't express. */
    placeholder?: React.ReactNode;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    icon?: React.ReactNode;
    /** Positive renders as an "up" trend in success color, negative as "down" in danger color. */
    trend?: { value: number; label?: string } | null;
    sparkline?: number[];
    elevated?: boolean;
    /** Adds hover bloom + pointer affordance for stat cards that are themselves a click target (wrap in Link separately). */
    interactive?: boolean;
    className?: string;
    footer?: React.ReactNode;
}

/**
 * One instrument module: silkscreened name on the bezel, the value in a lit
 * display window, supporting readings printed underneath.
 */
export function StatCard({
    label, value, placeholder, decimals = 0, prefix = '', suffix = '', icon, trend, sparkline, elevated, interactive, className = '', footer,
}: StatCardProps) {
    const trendPositive = !!trend && trend.value >= 0;
    const unknown = placeholder !== undefined;
    // The ghost cells must match the settled value's width, not the tweened
    // one, or they'd resize under the counter as it counts up.
    const settled = `${prefix}${value.toFixed(decimals)}${suffix}`;

    return (
        <Panel
            title={label}
            titleAlign="left"
            interactive={interactive}
            tone={elevated ? 'accent' : 'dim'}
            className={`flex flex-col gap-3 ${className}`}
        >
            {icon && (
                <span
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center text-accent/70"
                    aria-hidden="true"
                >
                    {icon}
                </span>
            )}

            <div className="flex items-center justify-between gap-3">
                <Readout
                    size="lg"
                    // Fixed floor so every window in a grid of tiles is the
                    // same size whatever its value -- ragged display widths
                    // were what made the row look unconsidered.
                    className="min-w-[6.5rem] text-center"
                    align="center"
                    tone={unknown ? 'off' : 'accent'}
                    value={
                        unknown
                            ? placeholder
                            : <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
                    }
                    ghostFor={unknown ? undefined : settled}
                />
                {sparkline && sparkline.length > 1 && (
                    <Sparkline data={sparkline} className="h-9 w-24 flex-shrink-0" />
                )}
            </div>

            {(trend || footer) && (
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em]">
                    {trend && (
                        <span className={`inline-flex items-center gap-1 font-bold ${trendPositive ? 'text-success' : 'text-danger'}`}>
                            {trendPositive ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
                            {Math.abs(trend.value).toFixed(1)}{trend.label ?? ''}
                        </span>
                    )}
                    {/* No empty spacer when there's no trend -- it was pushing
                        a lone footer out to the right edge for no reason. */}
                    {footer && <span className="min-w-0 truncate text-foreground-muted">{footer}</span>}
                </div>
            )}
        </Panel>
    );
}
