"use client";
import { use } from 'react';
import { notFound } from 'next/navigation';
import { RecentEventsView } from '@/components/hazard/RecentEventsView';
import { HAZARD_SLUGS, type HazardSlug } from '@/lib/hazardConfig';
import { parseScope } from '@/lib/hazardModel';

/**
 * The events behind one Home card.
 *
 * Scope and window arrive as query params rather than being re-derived here,
 * because re-deriving them is exactly how the count on the card and the list on
 * this page used to disagree. parseScope is the same function the API route
 * uses, so the page and the request it makes read the parameters identically.
 */
export default function WatchPage({
    params, searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { slug } = use(params);
    const query = use(searchParams);

    if (!HAZARD_SLUGS.includes(slug as HazardSlug)) notFound();

    const flat = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (typeof value === 'string') flat.set(key, value);
    }

    const scope = parseScope(flat);
    const parsedHours = Number(flat.get('hours'));
    const hours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;

    return <RecentEventsView slug={slug as HazardSlug} scope={scope} hours={hours} />;
}
