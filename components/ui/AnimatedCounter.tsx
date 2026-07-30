"use client";
import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
    value: number;
    decimals?: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

/** rAF count-up tween between the previous and next value; snaps instantly under prefers-reduced-motion. */
export function AnimatedCounter({ value, decimals = 0, duration = 600, className = '', prefix = '', suffix = '' }: AnimatedCounterProps) {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            // Syncing to an external signal (the OS motion preference) that
            // can't be read at render time on the server -- same
            // hydration-safe pattern as ThemeToggle/LocaleProvider.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDisplay(value);
            fromRef.current = value;
            return;
        }

        const from = fromRef.current;
        const to = value;
        if (from === to) return;
        const start = performance.now();

        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(from + (to - from) * eased);
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                fromRef.current = to;
            }
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [value, duration]);

    return (
        <span className={className}>
            {prefix}{display.toFixed(decimals)}{suffix}
        </span>
    );
}
