import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { AlertCircleIcon } from './icons';

export const ErrorState: React.FC<{ message: string; title?: string; onRetry?: () => void }> = ({ message, title = "Couldn't load earthquake data", onRetry }) => {
    return (
        <Card padding="lg" className="flex flex-col items-center gap-3 border-danger/30 bg-danger-bg py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertCircleIcon size={22} strokeWidth={1.5} />
            </span>
            <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm text-foreground-muted">{message}</p>
            </div>
            {onRetry && (
                <Button variant="secondary" onClick={onRetry} className="mt-1">
                    Try again
                </Button>
            )}
        </Card>
    );
};
