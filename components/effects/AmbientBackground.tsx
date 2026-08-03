// The chassis behind the panel: warm oxblood wash, perforated-metal dot grid,
// CRT scanlines, film grain, and a vignette. All static -- no keyframes and no
// particles, because a hardware faceplate doesn't drift. Zero JS after mount.

const NOISE_URL =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AmbientBackground() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/* Layer 1: a narrow lamp wash at the very top edge only. Anything
                broader greys the amber out across the middle of the plate. */}
            <div
                className="absolute inset-x-0 top-0 h-[45vh] opacity-[var(--ambient-mesh-opacity)]"
                style={{
                    background: 'radial-gradient(100% 100% at 50% 0%, var(--glow-cyan), transparent 70%)',
                }}
            />

            {/* Layer 2: perforated metal -- a dot grid, not a line grid */}
            <div
                className="absolute inset-0 opacity-[var(--ambient-blob-opacity)]"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at center, rgba(255, 171, 31, 0.5) 0.5px, transparent 0.6px)',
                    backgroundSize: '7px 7px',
                }}
            />

            {/* Layer 3: faint alignment grid, as silkscreened onto the plate */}
            <div
                className="absolute inset-0 opacity-[var(--ambient-grid-opacity)]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255, 171, 31, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 171, 31, 0.4) 1px, transparent 1px)',
                    backgroundSize: '56px 56px',
                }}
            />

            {/* Layer 4: CRT scanlines across the whole face */}
            <div
                className="absolute inset-0 opacity-[0.18]"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0 1px, transparent 1px 3px)',
                }}
            />

            {/* Layer 5: film grain */}
            <div
                className="absolute inset-0 mix-blend-overlay opacity-[var(--ambient-noise-opacity)]"
                style={{ backgroundImage: NOISE_URL, backgroundSize: '160px' }}
            />

            {/* Layer 6: vignette, so the plate falls off at its edges */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(115% 85% at 50% 45%, transparent 45%, rgba(0, 0, 0, 0.55) 100%)',
                }}
            />
        </div>
    );
}
