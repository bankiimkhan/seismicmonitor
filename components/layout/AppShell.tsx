"use client";
import { usePathname } from 'next/navigation';
import { TopNav } from './TopNav';
import { PageTransition } from './PageTransition';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { SpotlightCursor } from '@/components/effects/SpotlightCursor';

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // The embed page (audit 4.3) is meant to be iframed chromeless -- no app shell inside someone else's page.
    if (pathname?.startsWith('/embed')) return <>{children}</>;

    return (
        <>
            <AmbientBackground />
            <SpotlightCursor />

            <div className="flex min-h-screen flex-col">
                <TopNav />
                <PageTransition>{children}</PageTransition>
            </div>
        </>
    );
}
