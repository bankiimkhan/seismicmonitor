import { HazardSectionHero } from '@/components/layout/HazardSectionHero';

// One hero + tab bar for the whole section, rendered here rather than in each
// of the four sub-pages (Next.js layouts don't remount on sibling route
// changes, so it stays put while you move between Local/Global/Map/Trends).
// Sub-pages render only their own content, in a sibling container.
export default function TsunamiLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="mx-auto w-full max-w-7xl px-4 pt-8 md:px-8 md:pt-10">
                <HazardSectionHero slug="tsunami" />
            </div>
            {children}
        </>
    );
}
