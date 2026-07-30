"use client";
import { PageHero } from '@/components/layout/PageHero';
import { HazardTrends } from '@/components/HazardTrends';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';

const config = HAZARD_CONFIG.volcano;

export default function VolcanoTrendsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <PageHero title={config.title} description={config.description} icon={<config.icon size={22} />} />
      <HazardTrends hazardSlug="volcano" />
    </div>
  );
}
