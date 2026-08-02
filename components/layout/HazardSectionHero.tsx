"use client";
import { PageHero } from './PageHero';
import { HazardSubNav } from './HazardSubNav';
import { HAZARD_CONFIG, type HazardSlug } from '@/lib/hazardConfig';

/** The one hero a hazard section gets, rendered from that section's layout.tsx
 * rather than from each of its four sub-pages. Previously Local/Global/Map/
 * Trends each declared an identical PageHero (same title, same description,
 * same icon) and the tab bar floated above it, unattached to the heading it
 * belongs to -- so the section identity was restated four times and re-animated
 * on every tab switch. Living in the layout, it renders once and persists
 * across sibling navigation; the active tab is what tells you which view you're
 * on, so the sub-pages no longer need a heading of their own. */
export function HazardSectionHero({ slug }: { slug: HazardSlug }) {
    const config = HAZARD_CONFIG[slug];
    const Icon = config.icon;

    return (
        <PageHero title={config.title} description={config.description} icon={<Icon size={22} />}>
            {/* Flex wrapper so the pill bar hugs its four tabs. HazardSubNav's
                own `self-start` needs a flex parent to mean anything; in the
                plain block it used to sit in, the bar stretched the full page
                width with the tabs marooned at the left end. */}
            <div className="flex">
                <HazardSubNav basePath={`/${slug}`} />
            </div>
        </PageHero>
    );
}
