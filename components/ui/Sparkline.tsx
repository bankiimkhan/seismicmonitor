interface SparklineProps {
    data: number[];
    className?: string;
    color?: string;
}

/** Minimal axis-less trend line for stat cards -- see charts.tsx for full labeled/tooltip charts. */
export function Sparkline({ data, className = '', color = 'var(--accent)' }: SparklineProps) {
    if (data.length < 2) return null;
    const w = 100;
    const h = 32;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data
        .map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / range) * h}`)
        .join(' ');
    const areaPoints = `0,${h} ${points} ${w},${h}`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={areaPoints} fill={color} fillOpacity={0.12} stroke="none" />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
