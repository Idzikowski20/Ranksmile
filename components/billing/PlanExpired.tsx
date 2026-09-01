import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { Button, Toggle } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';
import fetchJson from '../../lib/fetchJson';
import { getPlanCheckoutHref } from '../../lib/billing/billingPlans';
import type { ExpiredSummary } from '../../pages/api/billing/expired-summary';

/**
 * Shown in place of the app once the plan or trial has run out — see
 * lib/appAccess/ApplicationShell.tsx, which renders it for every route rather
 * than redirecting to a page of its own. The point is not the paywall but the
 * three counts: what the user built is still here, and says so by name.
 */
export function PlanExpired() {
  const [annual, setAnnual] = useState(false);

  // One unguarded endpoint, not four gated ones: /api/domains, /api/articles and
  // /api/billing/plan-summary all sit behind withOrgPaymentAccess, so they 402 for
  // precisely the lapsed account this screen serves — the cards read "No sites yet"
  // and two zeros.
  const { data } = useQuery(
    ['plan-expired-summary'],
    () => fetchJson<ExpiredSummary>('/api/billing/expired-summary', {
      sites: [], articles: 0, recommendations: 0, plan: null,
    }),
    { staleTime: 60_000, retry: false },
  );

  const sites = data?.sites ?? [];
  const plan = data?.plan ?? null;
  const price = annual ? plan?.priceYearly : plan?.priceMonthly;
  const recCount = data?.recommendations ?? 0;
  const articleCount = data?.articles ?? 0;

  return (
    <div className="plan-expired">
      <div className="plan-expired__head">
        {/* Its own line, not an inline glyph: the mark carries the tone of the whole
            screen, and at title height it read as punctuation. */}
        <span className="plan-expired__mark" aria-hidden="true">
          <BounceSmileyAnimation mood="sad" compact size={96} animateRotate={false} />
        </span>
        <h1 className="plan-expired__title">Your plan has expired</h1>
        <p className="plan-expired__lead">
          But all your hard work is still right here, waiting for you.
          <br />
          You&apos;ve built up something great:
        </p>
      </div>

      <div className="plan-expired__cards">
        <section className="plan-expired__card">
          <h2 className="plan-expired__card-title">Sites you were monitoring</h2>
          {sites.length === 0 ? (
            <p className="plan-expired__muted">No sites yet.</p>
          ) : (
            <ul className="plan-expired__sites">
              {sites.map((site) => (
                <li key={site} className="plan-expired__site">
                  <Icon name="Globe" size={20} weight="bold" />
                  <span className="plan-expired__site-name">{site}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="plan-expired__stats">
          <section className="plan-expired__card">
            <h2 className="plan-expired__card-title">Content you wrote and optimized</h2>
            <p className="plan-expired__stat">
              <Icon name="PencilSimple" size={20} weight="bold" />
              <strong>{articleCount}</strong>
            </p>
          </section>
          <section className="plan-expired__card">
            <h2 className="plan-expired__card-title">Recommendations you left</h2>
            <p className="plan-expired__stat">
              <Icon name="Fire" size={20} weight="bold" />
              <strong>{recCount}</strong>
            </p>
          </section>
        </div>
      </div>

      <div className="plan-expired__offer">
        <div>
          <p className="plan-expired__price">
            {plan?.name ?? 'Growth'}
            {price != null ? ` — €${price}/${annual ? 'yr' : 'mo'}` : ''}
          </p>
          <label className="plan-expired__annual">
            <Toggle checked={annual} onChange={() => setAnnual((v) => !v)} />
            <span>Pay annually and save 17%</span>
          </label>
        </div>
        <div className="plan-expired__cta-row">
          {/* Renewing the plan they had goes straight to its checkout; the pricing
              page is only for the ones who want something different. The trial is
              consumed for anyone this screen renders for, so the checkout resolves
              itself to upfront — no mode pinned here. */}
          <Link href={getPlanCheckoutHref(plan?.slug ?? 'growth', annual ? 'yearly' : 'monthly')} passHref>
            <a className="plan-expired__cta">
              <Button type="button" variant="primary">
                {`Choose ${plan?.name ?? 'Growth'}`}
              </Button>
            </a>
          </Link>
          <Link href="/plans" passHref>
            <a className="plan-expired__cta">
              <Button type="button" variant="secondary">
                Change plan
              </Button>
            </a>
          </Link>
        </div>
      </div>

      <p className="plan-expired__news">
        We&apos;ve been hard at work adding new features while you were gone.
        <br />
        <a
          className="plan-expired__news-link"
          href="https://ranksmile.com/updates"
          target="_blank"
          rel="noreferrer noopener"
        >
          See what&apos;s new
          <Icon name="ArrowUpRight" size={16} weight="bold" />
        </a>
      </p>
    </div>
  );
}

export default PlanExpired;
