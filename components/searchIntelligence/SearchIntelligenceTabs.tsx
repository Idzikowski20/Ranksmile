import React from 'react';
import { useRouter } from 'next/router';
import { SegmentedControl } from '../core';
import { RANK_TRACKING_PATH, sitePath } from '../../lib/navigation';

type SiTab = 'organic' | 'rank-tracking';

type SearchIntelligenceTabsProps = {
  slug: string;
  active: SiTab;
};

/**
 * Shared SI chrome: Organic Research (DFS) vs Rank Tracking (tracked keywords).
 */
export default function SearchIntelligenceTabs({ slug, active }: SearchIntelligenceTabsProps) {
  const router = useRouter();

  return (
    <div style={{ marginBottom: 16 }}>
      <SegmentedControl
        name="search-intelligence-tabs"
        size="sm"
        value={active}
        options={[
          { value: 'organic', label: 'Organic Research' },
          { value: 'rank-tracking', label: 'Rank Tracking' },
        ]}
        onChange={(value) => {
          const path = value === 'organic'
            ? sitePath(slug, 'search-intelligence')
            : sitePath(slug, RANK_TRACKING_PATH);
          void router.push(path);
        }}
      />
    </div>
  );
}
