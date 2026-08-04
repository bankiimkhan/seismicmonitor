import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { AlertCircleIcon, SearchIcon } from './icons';

/**
 * The failure state for hazard data, kept deliberately distinct from
 * EmptyState.
 *
 * These two look similar and mean opposite things, and the app used to blur
 * them: a failed fetch rendered "COUNT UNKNOWN" beside an em dash, which reads
 * as a very small number rather than as no number. The rule this component
 * exists to enforce is that a surface which could not reach a source shows no
 * count at all, says the source is unavailable, and offers a retry -- while an
 * empty result from a source that *did* answer is allowed to say zero.
 */
export const UnavailableState: React.FC<{
    /** What could not be loaded, e.g. "earthquake data". */
    subject?: string;
    message?: string;
    /** True when the browser is offline -- actionable by the reader, unlike a
     * source outage, so it is worth naming separately. */
    offline?: boolean;
    onRetry?: () => void;
}> = ({ subject = 'hazard data', message, offline = false, onRetry }) => {
    const title = offline ? 'You appear to be offline' : `${subject} is unavailable`;
    const body = message ?? (offline
        ? 'Reconnect and this will reload automatically.'
        : 'The source could not be reached, so there is no count to show. This is not the same as "no events" — check back shortly.');

    return (
        <Card padding="lg" className="flex flex-col items-center gap-3 border-danger/30 bg-danger-bg py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertCircleIcon size={22} strokeWidth={1.5} />
            </span>
            <div>
                <p className="font-semibold capitalize text-foreground">{title}</p>
                <p className="mt-1 max-w-md text-sm text-foreground-muted">{body}</p>
            </div>
            {onRetry && (
                <Button variant="secondary" onClick={onRetry} className="mt-1">
                    Try again
                </Button>
            )}
        </Card>
    );
};

/**
 * The zero state -- a source answered and there was nothing in the window.
 *
 * `scopeNote` carries what the zero actually covers ("Last 24 hours · South
 * Asia"), because "No events found" alone invites the reader to generalise it
 * to the whole world and all time.
 */
export const NoEventsState: React.FC<{
    title: string;
    description: string;
    scopeNote?: string;
    /** Standing caveat about source coverage, for hazards where an empty list
     * is expected regardless of real-world activity (landslide, tsunami). */
    coverageNotice?: string;
}> = ({ title, description, scopeNote, coverageNotice }) => (
    <Card padding="lg" className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-foreground-subtle">
            <SearchIcon size={22} strokeWidth={1.5} />
        </span>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
        {scopeNote && (
            <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">{scopeNote}</p>
        )}
        {coverageNotice && (
            <p className="mt-1 max-w-md rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                {coverageNotice}
            </p>
        )}
    </Card>
);
