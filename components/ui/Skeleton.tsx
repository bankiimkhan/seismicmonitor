import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
    return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
};

export const QuakeCardSkeleton: React.FC = () => {
    return (
        <div className="flex gap-3">
            <div className="flex flex-shrink-0 flex-col items-center pt-1">
                <Skeleton className="h-3 w-3 rounded-full" />
            </div>
            <div className="flex-1 rounded-lg border border-border bg-surface p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-5 w-64 max-w-full" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-10 w-16" />
                </div>
            </div>
        </div>
    );
};

export const StatCardSkeleton: React.FC = () => (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-16" />
    </div>
);
