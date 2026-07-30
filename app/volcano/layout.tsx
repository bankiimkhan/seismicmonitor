import { HazardSubNav } from '@/components/layout/HazardSubNav';

export default function VolcanoLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8">
                <HazardSubNav basePath="/volcano" />
            </div>
            {children}
        </>
    );
}
