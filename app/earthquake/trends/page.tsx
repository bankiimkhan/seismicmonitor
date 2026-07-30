"use client";
import { PageHero } from '@/components/layout/PageHero';
import { HazardTrends } from '@/components/HazardTrends';
import { useT } from '@/lib/i18n/LocaleProvider';

export default function EarthquakeTrendsPage() {
  const { t } = useT();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <PageHero title={t('trends.title')} description={t('trends.desc')} />
      <HazardTrends hazardSlug="earthquake" />
    </div>
  );
}
