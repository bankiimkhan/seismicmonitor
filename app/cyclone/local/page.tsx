"use client";
import { HazardFeed } from '@/components/HazardFeed';

export default function CycloneLocalPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8 md:pb-10">
      <HazardFeed hazardSlug="cyclone" scope="local" />
    </div>
  );
}
