import { HazardSubNav } from '@/components/layout/HazardSubNav';

// Persists across Local/Global/Map/Trends navigation (Next.js layouts don't
// remount on sibling route changes) -- each sub-page keeps rendering its own
// PageHero/content wrapper unchanged, this just adds the tab bar above it in
// a sibling container (not nested inside each page's own max-w-7xl wrapper,
// to avoid doubling up horizontal padding).
export default function EarthquakeLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8">
                <HazardSubNav basePath="/earthquake" />
            </div>
            {children}
        </>
    );
}
