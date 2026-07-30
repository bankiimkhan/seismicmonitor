"use client";
import { useEffect, useState } from 'react';

// rAF-throttled so scroll doesn't fire a React render per native scroll event.
export function useScrollY(): number {
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScrollY(window.scrollY);

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                setScrollY(window.scrollY);
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return scrollY;
}
