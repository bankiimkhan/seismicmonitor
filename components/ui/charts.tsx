"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SeriesPoint {
    label: string;
    value: number;
}

interface LineChartProps {
    data: SeriesPoint[];
    height?: number;
    color?: string;
    formatValue?: (v: number) => string;
    ariaLabel?: string;
}

const PAD = { top: 16, right: 12, bottom: 26, left: 34 };
const VIEW_W = 600;

/** Single-series trend line: hairline grid, crosshair + tooltip, sparing direct label on the last point. */
export function LineChart({ data, height = 220, color = 'var(--accent)', formatValue = (v) => String(v), ariaLabel }: LineChartProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState(0);

    const innerW = VIEW_W - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const maxY = Math.max(1, ...data.map((d) => d.value));
    const niceMax = Math.max(1, Math.ceil(maxY / 5) * 5);

    const points = useMemo(() => data.map((d, i) => ({
        x: PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
        y: PAD.top + innerH - (d.value / niceMax) * innerH,
        ...d,
    })), [data, innerW, innerH, niceMax]);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = points.length
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`
        : '';

    useEffect(() => {
        if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
    }, [linePath]);

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const xLabelIndices = data.map((_, i) => i).filter((i) => i % step === 0 || i === data.length - 1);

    const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
        let nearest = 0;
        let best = Infinity;
        points.forEach((p, i) => {
            const d = Math.abs(p.x - relX);
            if (d < best) { best = d; nearest = i; }
        });
        setHoverIndex(nearest);
    };

    if (data.length === 0) return null;

    const hovered = hoverIndex !== null ? points[hoverIndex] : null;
    const last = points[points.length - 1];

    return (
        <div className="relative w-full">
            <svg
                viewBox={`0 0 ${VIEW_W} ${height}`}
                width="100%"
                height={height}
                onPointerMove={handleMove}
                onPointerLeave={() => setHoverIndex(null)}
                role="img"
                aria-label={ariaLabel}
                className="overflow-visible"
            >
                {yTicks.map((tick, i) => {
                    const y = PAD.top + innerH - (tick / niceMax) * innerH;
                    return (
                        <g key={i}>
                            <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
                            <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--foreground-subtle)">{tick}</text>
                        </g>
                    );
                })}

                {xLabelIndices.map((i) => (
                    <text key={i} x={points[i].x} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--foreground-subtle)">
                        {data[i].label}
                    </text>
                ))}

                <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
                <path
                    ref={pathRef}
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="chart-line-path"
                    style={pathLength ? { strokeDasharray: pathLength, strokeDashoffset: pathLength, animation: 'chart-draw 900ms var(--ease-out) forwards' } : undefined}
                />

                {hovered && (
                    <>
                        <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
                        <circle cx={hovered.x} cy={hovered.y} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
                    </>
                )}

                {last && (
                    <text x={last.x} y={last.y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--foreground)">
                        {formatValue(last.value)}
                    </text>
                )}
            </svg>

            {hovered && (
                <div
                    className="animate-pop-in pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
                    style={{ left: `${(hovered.x / VIEW_W) * 100}%`, top: `${(hovered.y / height) * 100}%` }}
                >
                    <div className="font-semibold text-foreground">{formatValue(hovered.value)}</div>
                    <div className="text-foreground-subtle">{hovered.label}</div>
                </div>
            )}
        </div>
    );
}

interface BarListProps {
    data: SeriesPoint[];
    color?: string;
    formatValue?: (v: number) => string;
}

/** Horizontal magnitude-by-category ranking: single hue, value at the tip, animated width. */
export function BarList({ data, color = 'var(--accent)', formatValue = (v) => String(v) }: BarListProps) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
        <div className="space-y-3">
            {data.map((d) => (
                <div key={d.label} className="group flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 truncate text-sm text-foreground-muted sm:w-36" title={d.label}>{d.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                        <div
                            className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)] group-hover:brightness-110"
                            style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
                        />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right font-mono text-xs font-semibold text-foreground">{formatValue(d.value)}</span>
                </div>
            ))}
        </div>
    );
}
