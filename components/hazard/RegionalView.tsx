"use client";
import { useMemo } from 'react';
import { HazardScopeView } from './HazardScopeView';
import { RegionPicker } from '@/components/RegionPicker';
import { useLocation } from '@/hooks/useLocation';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { REGIONS, REGION_BY_ID, regionForPoint } from '@/lib/regions';
import type { HazardSlug } from '@/lib/hazardConfig';
import type { EventScope } from '@/lib/hazardModel';

/**
 * Activity within one predefined region.
 *
 * The region defaults to the one containing the user's location so the view is
 * useful before anything is chosen, but it is a free choice -- this is the tab
 * for looking at somewhere you are not.
 *
 * Membership is decided by regionForPointStrict inside the data layer, not by
 * the `region_id` column, which holds a nearest-region fallback and files
 * mid-Pacific earthquakes under North America.
 */
export function RegionalView({ slug }: { slug: HazardSlug }) {
    const { location } = useLocation();

    // regionForPoint (the nearest-region variant) is the right one here: this
    // is labelling the user's own position to preselect a sensible tab, not
    // classifying an event, and a reader just off the edge of a box should
    // still land somewhere sensible.
    const detectedRegionId = useMemo(
        () => (location ? regionForPoint(location.lat, location.lng).id : null),
        [location]
    );

    const [selected, setSelected] = useLocalStorageState(`${slug}_regional_region`, '');
    const activeRegionId = REGION_BY_ID[selected]
        ? selected
        : detectedRegionId ?? REGIONS[0].id;

    const scope = useMemo<EventScope>(
        () => ({ kind: 'region', regionId: activeRegionId }),
        [activeRegionId]
    );

    return (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
            <HazardScopeView
                slug={slug}
                scope={scope}
                storageKey={`${slug}_regional`}
                scopeControls={
                    <div className="max-w-sm">
                        <RegionPicker
                            value={activeRegionId}
                            onChange={setSelected}
                            detectedRegionId={detectedRegionId}
                        />
                    </div>
                }
            />
        </div>
    );
}
