"use client";
import { Button } from '@/components/ui/Button';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import type { ResolvedLocation } from '@/hooks/useLocation';
import { useT } from '@/lib/i18n/LocaleProvider';

interface LocationSwitcherProps {
    current: ResolvedLocation | null;
    onChangeLocation: () => void;
    onSelectSaved: (loc: { lat: number; lng: number; label: string }) => void;
}

export function LocationSwitcher({ current, onChangeLocation, onSelectSaved }: LocationSwitcherProps) {
    const { t } = useT();
    const { locations, addLocation, removeLocation } = useSavedLocations();

    const currentLabel = current?.label || (current ? `${current.lat.toFixed(2)}, ${current.lng.toFixed(2)}` : '…');
    const alreadySaved = current && locations.some(
        (l) => Math.abs(l.lat - current.lat) < 0.01 && Math.abs(l.lng - current.lng) < 0.01
    );

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-foreground-muted">{currentLabel}</span>
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={onChangeLocation}>
                {t('location.change')}
            </Button>
            {current && !alreadySaved && (
                <Button
                    variant="ghost"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => addLocation({ lat: current.lat, lng: current.lng, label: currentLabel })}
                >
                    {t('location.addCurrent')}
                </Button>
            )}

            {locations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-foreground-subtle">{t('location.saved')}:</span>
                    {locations.map((loc) => (
                        <span
                            key={loc.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-2.5 pr-1 text-xs"
                        >
                            <button
                                type="button"
                                onClick={() => onSelectSaved(loc)}
                                className="text-foreground-muted hover:text-accent"
                            >
                                {loc.label.split(',')[0]}
                            </button>
                            <button
                                type="button"
                                aria-label={`Remove ${loc.label}`}
                                onClick={() => removeLocation(loc.id)}
                                className="rounded-full px-1 text-foreground-subtle hover:text-danger"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
