"use client";
import { usePathname } from 'next/navigation';

/** Replays the fade-in when you move between top-level sections.
 *
 * Keyed on the first path segment, not the whole pathname. Keying on the full
 * path remounted this subtree on every navigation -- including moving between
 * a hazard section's own Local/Global/Map/Trends tabs, which tore down and
 * re-faded that section's hero and the tab bar you had just clicked. A tab
 * strip that flickers itself away each time you use it reads as a full page
 * load rather than a panel switch; now the section chrome holds still and only
 * the panel under it changes. */
export function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const section = pathname?.split('/')[1] ?? '';

    return (
        <main id="main-content" key={section} className="animate-page-in flex-1">
            {children}
        </main>
    );
}
