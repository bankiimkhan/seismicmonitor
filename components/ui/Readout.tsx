import React from 'react';

// 'off' is the no-signal state: dim, matrix-free, unglowing. A value that
// isn't a numeral (an em dash, "n/a") turns to mush under the dot grid, and a
// glowing placeholder reads as live data besides.
type Tone = 'accent' | 'danger' | 'warning' | 'success' | 'off';

interface ReadoutProps {
    /** The displayed value. Kept as real text (the dot-matrix effect is a clipped background, not an image) so it stays selectable and screen-reader readable. */
    value: React.ReactNode;
    /** Unlit character cells behind the value, as a real display shows. Only meaningful for numeric values -- pass the raw string so the ghost can be width-matched. */
    ghostFor?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    tone?: Tone;
    /** Small fixed suffix (units) set beside the digits at a reduced size. */
    unit?: React.ReactNode;
    /** Indicator column down the right-hand side of the window, e.g. which source is driving the value. */
    leds?: React.ReactNode;
    align?: 'left' | 'center' | 'right';
    /** Stretches the window to the container. Off by default: a display sized
     * to its container rather than its digits reads as a broken empty box,
     * which is exactly how a one- or two-character value looks in a full-width
     * screen. */
    block?: boolean;
    className?: string;
}

const SIZES = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl md:text-7xl',
};

const TONE_CLASS: Record<Tone, string> = {
    accent: '',
    danger: 'vfd-danger',
    warning: 'vfd-warning',
    success: 'vfd-success',
    off: '',
};

const ALIGN = {
    left: 'justify-start text-left',
    center: 'justify-center text-center',
    right: 'justify-end text-right',
};

/**
 * A recessed display window with dot-matrix numerals.
 *
 * The matrix is a dark grid and an amber fill, both clipped to the glyphs, so
 * the type genuinely reads as illuminated cells instead of a texture laid over
 * the box. Because a background-clipped glyph has no text color left to cast a
 * `text-shadow`, the bloom comes from a `filter: drop-shadow` on the same
 * element (see `.vfd` in globals.css).
 */
export function Readout({
    value, ghostFor, size = 'md', tone = 'accent', unit, leds, align = 'left', block = false, className = '',
}: ReadoutProps) {
    // Digits swapped for full cells keeps the ghost exactly as wide as the
    // live value, which tabular-nums alone can't guarantee once the string
    // carries non-digits ("M 6.2", "12:04").
    const ghost = ghostFor ? ghostFor.replace(/\d/g, '8') : null;

    return (
        <div className={`screen scanlines relative overflow-hidden px-3 py-2 ${block ? 'block w-full' : 'inline-block max-w-full'} ${className}`}>
            <div className="flex items-center gap-3">
                <div className={`flex min-w-0 flex-1 items-baseline gap-1.5 ${ALIGN[align]}`}>
                    {/* The ghost is positioned against the digits themselves,
                        not the row -- anchoring it to the row would drift it
                        off the value as soon as a unit shares the line. */}
                    <span className={`relative inline-block min-w-0 ${SIZES[size]}`}>
                        {ghost && (
                            <span
                                aria-hidden="true"
                                className="vfd vfd-ghost pointer-events-none absolute inset-0 font-bold leading-none"
                            >
                                {ghost}
                            </span>
                        )}
                        <span
                            className={`relative block truncate font-bold leading-none ${tone === 'off' ? 'text-accent/25' : `vfd ${TONE_CLASS[tone]}`}`}
                        >
                            {value}
                        </span>
                    </span>
                    {unit && (
                        <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-accent/70">
                            {unit}
                        </span>
                    )}
                </div>

                {leds && (
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">{leds}</div>
                )}
            </div>
        </div>
    );
}

const defaultFormatTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/**
 * Segmented bar meter -- the INPUT/OUTPUT strip of the panel. `value` and
 * `max` are mapped to a whole number of lit segments, so it quantizes the way
 * real hardware does rather than sliding continuously.
 *
 * Tick labels are DERIVED from `max`/`segments`, never passed in. They used to
 * be a hand-written array, which silently drifted from what the segments
 * actually mean: the count meter carried a logarithmic silkscreen
 * (10/25/50/100/200/300) over this linear bar, so 150 events out of a 300
 * ceiling lit six segments and came to rest under the tick reading "50". A
 * label that disagrees with the bar it is printed under is worse than no
 * label, so the two now come from the same arithmetic.
 *
 * Each tick names the value at the TOP of the segment above it, so the last
 * lit segment's label is the reading -- full scale sits under the final one.
 */
export function LedMeter({
    value, max, segments = 12, label, scaleEvery = 2, formatTick = defaultFormatTick, tone = 'accent', className = '',
}: {
    value: number;
    max: number;
    segments?: number;
    label?: React.ReactNode;
    /** Print a tick under every Nth segment; `false` for an unlabelled bar. */
    scaleEvery?: number | false;
    /** Renders a derived tick value. Defaults to integers, one decimal otherwise. */
    formatTick?: (value: number) => string;
    /** Applied to the segments past the two-thirds mark, so a meter can run amber then red. */
    tone?: Tone;
    className?: string;
}) {
    const safeMax = max > 0 ? max : 1;
    const ratio = Math.min(Math.max(value / safeMax, 0), 1);
    // A real but small reading always lights at least one segment. Rounding
    // alone put anything under half a segment's worth at zero -- and on this
    // face a dark meter is the no-signal state (see ActivityMeters' `unknown`),
    // so "9 events in the last 24h" would have rendered as "the feed is down".
    // Only a genuine zero is allowed to go dark.
    const scaled = Math.round(ratio * segments);
    const lit = value > 0 ? Math.max(1, scaled) : scaled;
    const hotFrom = Math.ceil(segments * 0.72);

    return (
        <div className={className}>
            <div className="flex items-center gap-2">
                {label && (
                    <span className="w-10 flex-shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.18em] text-foreground-muted">
                        {label}
                    </span>
                )}
                <div
                    className="flex flex-1 items-center gap-1"
                    role="meter"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={safeMax}
                    aria-label={typeof label === 'string' ? label : 'level'}
                >
                    {Array.from({ length: segments }, (_, i) => {
                        const on = i < lit;
                        // Only a *lit* segment goes red. Tinting the unlit tail
                        // too made every meter look permanently in alarm, since
                        // the top third is red whatever the reading is.
                        const hot = on && i >= hotFrom;
                        const segTone = hot && tone === 'accent' ? 'danger' : tone;
                        return (
                            <span
                                key={i}
                                aria-hidden="true"
                                className={`led meter-segment h-3 flex-1 ${!on || segTone === 'accent' ? '' : `led-${segTone}`} ${on ? 'led-on' : ''}`}
                            />
                        );
                    })}
                </div>
            </div>
            {scaleEvery && (
                <div className="mt-1 flex items-center gap-2">
                    {label && <span className="w-10 flex-shrink-0" />}
                    <div className="flex flex-1 items-center gap-1">
                        {Array.from({ length: segments }, (_, i) => (
                            <span key={i} className="flex-1 text-center text-[8px] tracking-wider text-foreground-subtle">
                                {(i + 1) % scaleEvery === 0 ? formatTick(((i + 1) / segments) * safeMax) : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
