// Static, zero-JS ambient background: mesh gradient, glow blobs, grid texture,
// film grain, and floating particles. All motion is CSS keyframes (transform/
// opacity only) so this component never touches the main thread after mount.
// Particle positions are a hardcoded array (not Math.random()) to avoid any
// SSR/CSR hydration mismatch.

const NOISE_URL =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const PARTICLES = [
    { top: '8%', left: '12%', size: 3, opacity: 0.5, duration: 14, delay: 0 },
    { top: '18%', left: '82%', size: 2, opacity: 0.4, duration: 18, delay: 1.5 },
    { top: '30%', left: '45%', size: 2, opacity: 0.35, duration: 16, delay: 3 },
    { top: '42%', left: '68%', size: 3, opacity: 0.5, duration: 20, delay: 0.5 },
    { top: '55%', left: '8%', size: 2, opacity: 0.4, duration: 15, delay: 2.2 },
    { top: '62%', left: '90%', size: 2, opacity: 0.3, duration: 19, delay: 4 },
    { top: '70%', left: '30%', size: 3, opacity: 0.45, duration: 17, delay: 1 },
    { top: '78%', left: '58%', size: 2, opacity: 0.35, duration: 21, delay: 3.5 },
    { top: '85%', left: '20%', size: 2, opacity: 0.4, duration: 13, delay: 2.8 },
    { top: '15%', left: '60%', size: 2, opacity: 0.3, duration: 22, delay: 0.8 },
    { top: '48%', left: '25%', size: 3, opacity: 0.45, duration: 16, delay: 4.5 },
    { top: '92%', left: '75%', size: 2, opacity: 0.35, duration: 18, delay: 1.8 },
];

export function AmbientBackground() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/* Layer 1: mesh gradient */}
            <div
                className="animate-mesh-drift absolute -inset-[25%] opacity-[var(--ambient-mesh-opacity)]"
                style={{
                    background:
                        'radial-gradient(at 15% 25%, var(--glow-cyan), transparent 45%), radial-gradient(at 85% 15%, var(--glow-purple), transparent 45%), radial-gradient(at 50% 85%, var(--glow-blue), transparent 50%), radial-gradient(at 80% 70%, var(--glow-teal), transparent 40%)',
                }}
            />

            {/* Layer 2: floating glow blobs */}
            <div
                className="animate-float-blob-a absolute -left-20 -top-40 h-[600px] w-[600px] rounded-full opacity-[var(--ambient-blob-opacity)] blur-[120px]"
                style={{ background: 'var(--glow-cyan)' }}
            />
            <div
                className="animate-float-blob-b absolute -right-24 top-1/3 h-[650px] w-[650px] rounded-full opacity-[var(--ambient-blob-opacity)] blur-[130px]"
                style={{ background: 'var(--glow-blue)' }}
            />
            <div
                className="animate-float-blob-c absolute bottom-0 left-1/4 h-[550px] w-[550px] rounded-full opacity-[var(--ambient-blob-opacity)] blur-[110px]"
                style={{ background: 'var(--glow-purple)' }}
            />

            {/* Layer 3: cyber grid texture */}
            <div
                className="absolute inset-0 opacity-[var(--ambient-grid-opacity)]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(0, 240, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.15) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Layer 4: film grain */}
            <div
                className="absolute inset-0 mix-blend-overlay opacity-[var(--ambient-noise-opacity)]"
                style={{ backgroundImage: NOISE_URL, backgroundSize: '160px' }}
            />

            {/* Layer 5: ambient floating particles */}
            {PARTICLES.map((p, i) => (
                <span
                    key={i}
                    className="ambient-particle absolute rounded-full bg-[var(--glow-cyan)] will-change-transform"
                    style={{
                        top: p.top,
                        left: p.left,
                        width: p.size,
                        height: p.size,
                        ['--particle-opacity' as string]: p.opacity,
                        opacity: p.opacity,
                        animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}
