"use client";
import { useEffect, useRef, useState } from 'react';

// Soft radial glow that trails the cursor with an eased lag (exponential
// smoothing, not 1:1 tracking). Bails out completely -- no listeners, no rAF
// loop -- on touch/hybrid pointers and under prefers-reduced-motion.
export function SpotlightCursor() {
    const [enabled, setEnabled] = useState(false);
    const dotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const coarse = window.matchMedia('(pointer: coarse), (hover: none)').matches;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (coarse || reduced) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEnabled(true);

        const raw = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const eased = { ...raw };
        let raf: number;

        const onMove = (e: PointerEvent) => {
            raw.x = e.clientX;
            raw.y = e.clientY;
        };
        window.addEventListener('pointermove', onMove, { passive: true });

        const LERP = 0.12;
        const tick = () => {
            eased.x += (raw.x - eased.x) * LERP;
            eased.y += (raw.y - eased.y) * LERP;
            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0)`;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener('pointermove', onMove);
            cancelAnimationFrame(raf);
        };
    }, []);

    if (!enabled) return null;

    return (
        <div
            ref={dotRef}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[5] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] mix-blend-screen will-change-transform"
            style={{ background: 'radial-gradient(circle, var(--glow-teal) 0%, transparent 70%)' }}
        />
    );
}
