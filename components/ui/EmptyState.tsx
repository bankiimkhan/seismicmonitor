import React from 'react';
import { Card } from './Card';
import { SearchIcon } from './icons';

export const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => {
    return (
        <Card padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-foreground-subtle">
                <SearchIcon size={22} strokeWidth={1.5} />
            </span>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
        </Card>
    );
};
