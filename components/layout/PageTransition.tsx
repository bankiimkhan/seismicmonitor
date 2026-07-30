"use client";
import { usePathname } from 'next/navigation';

/** Keys on the pathname so React remounts + replays the fade-in on every route change. */
export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <main id="main-content" key={pathname} className="animate-page-in flex-1">
            {children}
        </main>
    );
}
