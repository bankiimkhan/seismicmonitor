"use client";
import { useT } from '@/lib/i18n/LocaleProvider';

interface MagnitudeControlProps {
    value: number;
    onChange: (value: number) => void;
    presets?: number[];
}

// Replaces the old fixed 2-3 option <Select> (audit 2.7): a slider for
// exact values, with the previous presets kept as quick-select chips so
// the common cases stay one click.
export function MagnitudeControl({ value, onChange, presets = [3.0, 4.0, 5.0, 6.0] }: MagnitudeControlProps) {
    const { t } = useT();

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="magnitude-range" className="text-xs font-medium text-foreground-muted">
                    {t('filters.magnitude')}
                </label>
                <span className="font-mono text-xs font-semibold text-foreground">{value.toFixed(1)}+</span>
            </div>
            <input
                id="magnitude-range"
                type="range"
                min={0}
                max={8}
                step={0.1}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)]"
            />
            <div className="mt-1.5 flex gap-1">
                {presets.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onChange(p)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${Math.abs(value - p) < 0.05
                                ? 'border-accent bg-accent text-accent-foreground'
                                : 'border-border text-foreground-muted hover:text-foreground'
                            }`}
                    >
                        {p.toFixed(1)}+
                    </button>
                ))}
            </div>
        </div>
    );
}
