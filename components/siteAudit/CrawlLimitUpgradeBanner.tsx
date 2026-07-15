import React from 'react';
import { CrawlLimitBody } from './crawlLimitContent';

type Props = {
  pagesCrawled: number;
  pagesLimit: number;
  upgradePlanName: string | null;
  upgradePlanSlug: string | null;
  upgradePagesLimit: number | null;
};

export default function CrawlLimitUpgradeBanner({
  pagesCrawled,
  pagesLimit,
  upgradePlanName,
  upgradePlanSlug,
  upgradePagesLimit,
}: Props) {
  if (!upgradePlanName) return null;

  return (
    <section className="sentry-crawl-limit-banner perf-3d-card">
      <CrawlLimitBody
        pagesCrawled={pagesCrawled}
        pagesLimit={pagesLimit}
        upgradePlanName={upgradePlanName}
        upgradePlanSlug={upgradePlanSlug}
        upgradePagesLimit={upgradePagesLimit}
        variant="banner"
      />
    </section>
  );
}
