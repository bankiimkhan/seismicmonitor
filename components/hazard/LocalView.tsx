"use client";
import { useMemo } from 'react';
import { HazardScopeView } from './HazardScopeView';
import { LocationPrompt } from '@/components/LocationPrompt';
import { LocationSwitcher } from '@/components/LocationSwitcher';
import { useLocation } from '@/hooks/useLocation';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';
import { DEFAULT_POINT_RANGE_DEG, type EventScope } from '@/lib/hazardModel';

/**
 * "What is happening near me" -- a box around the user's own position.
 *
 * Local stays point-scoped rather than snapping to the containing region: a
 * reader in Dhaka wants events near Dhaka, not everything from Karachi to
 * Yangon. The region containing that point is one tab across, on Regional.
 */
export function LocalView({ slug }: { slug: HazardSlug }) {
    const config = HAZARD_CONFIG[slug];
    const { status, location, requestGeolocation, setManualLocation, changeLocation } = useLocation();

    const scope = useMemo<EventScope>(
        () => (location
            ? { kind: 'point', lat: location.lat, lng: location.lng, rangeDeg: DEFAULT_POINT_RANGE_DEG }
            : { kind: 'global' }),
        [location]
    );

    return (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
            <HazardScopeView
                slug={slug}
                scope={scope}
                storageKey={`${slug}_local`}
                userLoc={location}
                // Held back until a location resolves, rather than quietly
                // showing worldwide results under a heading that says "Local".
                enabled={!!location}
                pendingMessage={`See ${config.itemNounPlural} near you`}
                banner={
                    <LocationPrompt
                        status={status}
                        onAllow={requestGeolocation}
                        onManual={setManualLocation}
                        title={`See ${config.itemNounPlural} near you`}
                    />
                }
                scopeControls={location && (
                    <LocationSwitcher
                        current={location}
                        onChangeLocation={changeLocation}
                        onSelectSaved={setManualLocation}
                    />
                )}
            />
        </div>
    );
}
