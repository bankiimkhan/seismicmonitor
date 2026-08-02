import { AlertCircleIcon } from './ui/icons';

/** Standing caveat about a hazard feed's coverage (see HazardConfig's
 * `coverageNotice`). Rendered above results on both Local/Global and Trends, so
 * a reader never sees an empty list without the reason it might be empty.
 * Renders nothing when the hazard type has no caveat to make. */
export function CoverageNotice({ notice }: { notice?: string }) {
    if (!notice) return null;

    return (
        <div
            role="note"
            className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning"
        >
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <p className="leading-snug">{notice}</p>
        </div>
    );
}
