"use client";
import { HazardTrends } from '@/components/HazardTrends';

export default function VolcanoTrendsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
      <HazardTrends hazardSlug="volcano" />
    </div>
  );
}
