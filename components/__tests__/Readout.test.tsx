import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LedMeter } from '../ui/Readout';

/** Tick labels in printed order, blanks included, so a tick can be matched to
 * the segment it sits under by index. */
function ticks(container: HTMLElement): string[] {
    const rows = container.querySelectorAll('.mt-1 > .flex-1 > span');
    return Array.from(rows).map((el) => el.textContent ?? '');
}

function litCount(container: HTMLElement): number {
    return container.querySelectorAll('.meter-segment.led-on').length;
}

describe('LedMeter', () => {
    // The regression this exists for: the count meter carried a hand-written
    // logarithmic silkscreen (10/25/50/100/200/300) over a linear bar, so 150
    // events against a 300 ceiling lit six of twelve segments and came to rest
    // under the tick reading "50" -- the panel understating its own count by 3x.
    it('labels each segment with the value at the top of it', () => {
        const { container } = render(<LedMeter value={150} max={300} segments={12} />);
        expect(ticks(container).filter(Boolean)).toEqual(['50', '100', '150', '200', '250', '300']);
    });

    it('puts the reading under the last lit segment', () => {
        const { container } = render(<LedMeter value={150} max={300} segments={12} />);
        const lit = litCount(container);

        expect(lit).toBe(6);
        expect(ticks(container)[lit - 1]).toBe('150');
    });

    // Same defect on the magnitude meter, where full scale is 9 but the last
    // tick was silkscreened "8" -- an M9 pinned the bar under a label that said
    // it was smaller than it was.
    it('runs the magnitude scale to its actual ceiling', () => {
        const { container } = render(<LedMeter value={9} max={9} segments={12} />);
        const printed = ticks(container).filter(Boolean);

        expect(printed.at(-1)).toBe('9');
        expect(litCount(container)).toBe(12);
    });

    it('renders fractional ticks to one decimal', () => {
        const { container } = render(<LedMeter value={0} max={9} segments={12} />);
        expect(ticks(container).filter(Boolean)).toEqual(['1.5', '3', '4.5', '6', '7.5', '9']);
    });

    // Dark is the no-signal state on this face, so it is reserved for a true
    // zero: a count of 9 against a 300 ceiling rounds to no segments, and would
    // otherwise have rendered a live feed as a dead one.
    it('lights one segment for a real reading too small to round to one', () => {
        const { container } = render(<LedMeter value={9} max={300} segments={12} />);
        expect(litCount(container)).toBe(1);
    });

    it('lights nothing at zero and everything at full scale', () => {
        const { container: empty } = render(<LedMeter value={0} max={300} segments={12} />);
        const { container: full } = render(<LedMeter value={300} max={300} segments={12} />);

        expect(litCount(empty)).toBe(0);
        expect(litCount(full)).toBe(12);
    });

    // A meter reading past its ceiling is pinned, not wrapped: the count
    // ceiling is the feed's own fetch limit, so "at capacity" must not render
    // as a partial bar.
    it('pins rather than overflowing when the value exceeds max', () => {
        const { container } = render(<LedMeter value={900} max={300} segments={12} />);
        expect(litCount(container)).toBe(12);
    });
});
