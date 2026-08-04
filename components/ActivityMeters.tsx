import { Panel, Led } from '@/components/ui/Panel';
import { LedMeter } from '@/components/ui/Readout';

// Ticks are silkscreened under the segments the way a dB scale is on a real
// meter -- one slot per segment, every other one blank so the labels stay
// legible. LedMeter derives the printed values from the ceiling and segment
// count itself; they are deliberately not spelled out here, because a
// hand-written scale is free to disagree with the bar it sits under (this one
// did, by 3x at midscale).
const MAG_SEGMENTS = 12;
const MAG_CEILING = 9;

const COUNT_SEGMENTS = 12;

interface ActivityMetersProps {
    /** Events in the current window. */
    count: number;
    /** Ceiling the count meter is scaled against -- the feed's own fetch limit, so a pinned meter means "at capacity", not "the end of the world". */
    countCeiling?: number;
    /** Strongest magnitude in the window, or null when nothing measurable came back. */
    peakMag: number | null;
    /** The feed failed or hasn't landed: every segment stays dark rather than reading as a true zero. */
    unknown?: boolean;
    label?: string;
    className?: string;
}

/**
 * The face's input/output strip: two bar meters standing in for "how much is
 * happening" and "how hard". Both are quantized to whole segments, so they
 * behave like hardware rather than sliding continuously.
 *
 * A dark meter is never asserted as calm -- when `unknown` is set the values
 * are forced to zero *and* the LED reads NO SIG, matching the rule the rest of
 * the dashboard follows about never rendering a confident zero it can't back.
 */
export function ActivityMeters({
    count, countCeiling = 300, peakMag, unknown = false, label = 'Activity', className = '',
}: ActivityMetersProps) {
    const live = !unknown;

    return (
        <Panel
            title={label}
            titleAlign="left"
            badge={<Led on={live} pulse={live} label={live ? 'Live' : 'No sig'} tone={live ? 'accent' : 'danger'} />}
            className={className}
        >
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                <div>
                    <LedMeter
                        label="Count"
                        value={unknown ? 0 : count}
                        max={countCeiling}
                        segments={COUNT_SEGMENTS}
                    />
                    <p className="mt-1.5 pl-12 text-[9px] uppercase tracking-[0.18em] text-foreground-subtle">
                        {unknown ? 'Source unreadable' : `${count} events tracked`}
                    </p>
                </div>

                <div>
                    <LedMeter
                        label="Peak"
                        value={unknown || peakMag === null ? 0 : peakMag}
                        max={MAG_CEILING}
                        segments={MAG_SEGMENTS}
                    />
                    <p className="mt-1.5 pl-12 text-[9px] uppercase tracking-[0.18em] text-foreground-subtle">
                        {unknown
                            ? 'Source unreadable'
                            : peakMag === null ? 'No measured magnitude' : `Strongest M${peakMag.toFixed(1)}`}
                    </p>
                </div>
            </div>
        </Panel>
    );
}
