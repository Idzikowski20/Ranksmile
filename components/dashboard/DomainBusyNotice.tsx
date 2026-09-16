import React from 'react';
import Link from 'next/link';
import { Button } from '../koala/core';
import { Icon } from '../koala/icons/Icon';

/**
 * What a page shows instead of its content while the domain analysis holds the domain.
 * The pinned progress pill says how far along it is; this says why the page is waiting.
 */
export default function DomainBusyNotice({ dashboardHref }: { dashboardHref: string }) {
  return (
    <div className="domain-busy" role="status" data-testid="domain-busy-notice">
      <span className="domain-busy__icon"><Icon name="HourglassMedium" size={22} /></span>
      <h2 className="domain-busy__title">Domain analysis is running</h2>
      <p className="domain-busy__text">
        Creating content and AI Visibility are paused until it finishes — usually a couple of minutes.
        You can follow the progress in the pill at the bottom of the page.
      </p>
      <Link href={dashboardHref} passHref>
        <Button type="button" variant="secondary" size="sm">Back to dashboard</Button>
      </Link>
    </div>
  );
}
