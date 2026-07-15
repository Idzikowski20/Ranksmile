import React from 'react';
import Link from 'next/link';
import { Button } from '../core';
import { getPlanCheckoutHref } from '../../lib/billingPlans';

export function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M13.707 3.793a1 1 0 0 1 0 1.414l-6.996 7a1 1 0 0 1-1.414 0L2.293 9.2a1 1 0 0 1 1.414-1.414l2.297 2.3 6.289-6.292a1 1 0 0 1 1.414 0Z" />
    </svg>
  );
}

type CrawlLimitBodyProps = {
  pagesCrawled: number;
  pagesLimit: number;
  upgradePlanName: string | null;
  upgradePlanSlug: string | null;
  upgradePagesLimit: number | null;
  variant: 'popover' | 'banner';
  onClose?: () => void;
};

export function CrawlLimitBody({
  pagesCrawled,
  pagesLimit,
  upgradePlanName,
  upgradePlanSlug,
  upgradePagesLimit,
  variant,
  onClose,
}: CrawlLimitBodyProps) {
  const prefix = variant === 'popover' ? 'sentry-crawl-limit-popover' : 'sentry-crawl-limit-banner';
  const upgradeHref = upgradePlanSlug ? getPlanCheckoutHref(upgradePlanSlug, 'monthly') : '/settings/billing';
  const upgradeLimitLabel = upgradePagesLimit
    ? `${upgradePagesLimit.toLocaleString('en-US')} pages per audit`
    : 'higher crawl limits';

  return (
    <>
      <div className={`${prefix}-header`}>
        <span className={`${prefix}-title`}>
          You&apos;ve reached your page crawl limit for this audit
        </span>
        <span className={`${prefix}-badge`}>
          <WarningIcon />
          <strong>{pagesCrawled}</strong>
          {' '}
          /
          {pagesLimit}
          {' '}
          pages
        </span>
      </div>
      <div className={`${prefix}-body`}>
        {upgradePlanName ? (
          <p className={`${prefix}-lead`}>
            Upgrade your plan to
            {' '}
            {upgradePlanName}
            {' '}
            and unlock:
          </p>
        ) : (
          <p className={`${prefix}-lead`}>
            Upgrade your plan to unlock more pages per audit:
          </p>
        )}
        <ul className={`${prefix}-list`}>
          <li>
            <CheckIcon />
            <span>
              {upgradeLimitLabel}
              {' '}
              and deeper site coverage
            </span>
          </li>
          <li>
            <CheckIcon />
            <span>AI-readiness checks to ensure your content is visible to LLMs</span>
          </li>
          <li>
            <CheckIcon />
            <span>All key SEO + AI Search tools in one plan</span>
          </li>
        </ul>
        <div className={`${prefix}-actions`}>
          {upgradePlanName ? (
            <Link href={upgradeHref} onClick={onClose}>
              <Button type="button" variant="primary" size="sm">
                Upgrade to
                {' '}
                {upgradePlanName}
              </Button>
            </Link>
          ) : (
            <Link href="/settings/billing" onClick={onClose}>
              <Button type="button" variant="primary" size="sm">See plans</Button>
            </Link>
          )}
          <Link href="/settings/billing" className={`${prefix}-link`} onClick={onClose}>
            See plans and pricing
          </Link>
        </div>
      </div>
    </>
  );
}
