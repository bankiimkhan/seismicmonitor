"use client";
import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions {
    threshold?: number;
    rootMargin?: string;
}

// Reveal-once: disconnects after the first intersection, doesn't re-trigger
// on scroll back up. Skips the observer entirely under prefers-reduced-motion
// so reduced-motion users get content visible immediately, no CSS transition.
export function useInView<T extends HTMLElement>(opts?: UseInViewOptions) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    const threshold = opts?.threshold ?? 0.15;
    const rootMargin = opts?.rootMargin ?? '0px 0px -40px 0px';

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold, rootMargin }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold, rootMargin]);

    return { ref, inView };
}
