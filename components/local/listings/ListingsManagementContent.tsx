import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  INITIAL_SETUP_STATE,
  isLocalSetupComplete,
  loadLocalSetup,
} from '../../../lib/local/localSetupStorage';
import type { LocalSetupState } from '../../../lib/local/types';
import ListingsManagementDashboard from './ListingsManagementDashboard';

type ListingsManagementContentProps = {
  slug: string;
};

export default function ListingsManagementContent({ slug }: ListingsManagementContentProps) {
  const [state, setState] = useState<LocalSetupState>(INITIAL_SETUP_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setState(loadLocalSetup(slug));
    setHydrated(true);
  }, [slug]);

  if (!hydrated) {
    return <div className="local-listings-loading">Loading…</div>;
  }

  if (!isLocalSetupComplete(state) || !state.businessDetails) {
    return (
      <div className="local-listings-gate">
        <h2>Complete Local setup first</h2>
        <p>
          Listing Management publishes your business profile to directories.
          Finish setup on the Local overview to unlock this tool.
        </p>
        <Link href={`/sites/${slug}/local/overview`} className="local-listings-gate-link">
          Go to Local Overview
        </Link>
      </div>
    );
  }

  return <ListingsManagementDashboard business={state.businessDetails} />;
}
