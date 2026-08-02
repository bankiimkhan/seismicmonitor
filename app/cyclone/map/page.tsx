"use client";
import { HazardMap } from '@/components/HazardMap';

export default function CycloneMapPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
      <HazardMap hazardSlug="cyclone" className="h-[70vh] min-h-[420px] shadow-sm" />
    </div>
  );
}
