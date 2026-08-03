"use client";
import { usePathname } from 'next/navigation';
import { TopNav } from './TopNav';
import { PageTransition } from './PageTransition';
import { AmbientBackground } from '@/components/effects/AmbientBackground';

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // The embed page (audit 4.3) is meant to be iframed chromeless -- no app shell inside someone else's page.
    if (pathname?.startsWith('/embed')) return <>{children}</>;

    return (
        <>
            {/* SpotlightCursor is deliberately not mounted: a soft light blob
                trailing the pointer washed the middle of the page brown and
                pulled the amber down with it. The component is still in
                components/effects if the effect is ever wanted back. */}
            <AmbientBackground />

            <div className="flex min-h-screen flex-col">
                <TopNav />
                <PageTransition>{children}</PageTransition>
            </div>
        </>
    );
}
