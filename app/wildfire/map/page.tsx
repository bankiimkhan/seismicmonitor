"use client";
import { PageHero } from '@/components/layout/PageHero';
import { HazardMap } from '@/components/HazardMap';
import { HAZARD_CONFIG } from '@/lib/hazardConfig';

const config = HAZARD_CONFIG.wildfire;

export default function WildfireMapPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <PageHero title={config.title} description={config.description} icon={<config.icon size={22} />} />
      <HazardMap hazardSlug="wildfire" className="h-[70vh] min-h-[420px] shadow-sm" />
    </div>
  );
}
