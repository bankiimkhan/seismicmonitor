"use client";
import { HazardScopeView } from './HazardScopeView';
import type { HazardSlug } from '@/lib/hazardConfig';

/**
 * The whole world.
 *
 * "Global" here means genuinely unfiltered: no bounding box is applied at all,
 * so it is the union of every predefined region *plus* everything outside them
 * -- mid-ocean earthquakes, polar events, and any country that falls between
 * the region boxes. Those events have `regionId: null` in the normalized layer,
 * and this is the only view that shows them, which is why the table carries a
 * Region column here naming them "Outside regions" rather than leaving a blank.
 */
export function GlobalView({ slug }: { slug: HazardSlug }) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
            <HazardScopeView
                slug={slug}
                scope={{ kind: 'global' }}
                storageKey={`${slug}_global`}
            />
        </div>
    );
}
