"use client";
import { Label } from '@/components/ui/Input';
import { REGIONS } from '@/lib/regions';

/**
 * Picks one of the predefined regions for the Regional view.
 *
 * Only these ten exist as regions -- they are this app's own coarse buckets
 * (lib/regions.ts), not geopolitical borders -- so the control is a closed list
 * rather than free text. The note below says so, because "Regional" invites
 * the assumption that any region can be typed in.
 */
export function RegionPicker({
    value, onChange, detectedRegionId,
}: {
    value: string;
    onChange: (regionId: string) => void;
    /** The region the user's own location falls in, flagged in the list so the
     * relationship between Local and Regional is visible. */
    detectedRegionId?: string | null;
}) {
    return (
        <div>
            <Label htmlFor="region-picker">Region</Label>
            <select
                id="region-picker"
                className="w-full cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {REGIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                        {region.label}{region.id === detectedRegionId ? ' (your region)' : ''}
                    </option>
                ))}
            </select>
            <p className="mt-1.5 text-xs text-foreground-subtle">
                Coarse continent-scale boxes, not exact borders. Events outside all of
                them appear only on Global.
            </p>
        </div>
    );
}
