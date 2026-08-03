import { Panel, Led } from '@/components/ui/Panel';
import { LedMeter } from '@/components/ui/Readout';

const MAG_SEGMENTS = 12;
const MAG_CEILING = 9;
// Ticks are printed under the segments the way a dB scale is silkscreened on a
// meter: one slot per segment, most of them blank so the labels stay legible.
const MAG_SCALE = ['', '1', '', '3', '', '4', '', '5', '', '6', '', '8'];

const COUNT_SEGMENTS = 12;
const COUNT_SCALE = ['', '10', '', '25', '', '50', '', '100', '', '200', '', '300'];

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
                        scale={COUNT_SCALE}
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
                        scale={MAG_SCALE}
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
