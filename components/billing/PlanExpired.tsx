import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { Button, Toggle } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';
import fetchJson from '../../lib/fetchJson';
import { getCheckoutPlan } from '../../lib/billingPlans';
import { countActionableRecommendations, type RecFilterable } from '../../lib/recommendations';

type DomainRow = { domain: string; slug?: string };
type PlanSummary = { planSlug: string; planName: string };

/**
 * Shown in place of the app once the plan or trial has run out — see
 * lib/appAccess/ApplicationShell.tsx, which renders it for every route rather
 * than redirecting to a page of its own. The point is not the paywall but the
 * three counts: what the user built is still here, and says so by name.
 */
export function PlanExpired() {
  const [annual, setAnnual] = useState(false);

  const { data: domains } = useQuery(
    ['plan-expired-domains'],
    () => fetchJson<{ domains: DomainRow[] }>('/api/domains', { domains: [] }),
    { staleTime: 60_000, retry: false },
  );
  const { data: summary } = useQuery(
    ['plan-expired-summary'],
    () => fetchJson<{ summary: PlanSummary }>('/api/billing/plan-summary', {
      summary: { planSlug: 'growth', planName: 'Growth' },
    }),
    { staleTime: 60_000, retry: false },
  );
  const { data: articles } = useQuery(
    ['plan-expired-articles'],
    () => fetchJson<{ articles: unknown[] }>('/api/articles?limit=200', { articles: [] }),
    { staleTime: 60_000, retry: false },
  );

  const sites = domains?.domains ?? [];
  const firstSlug = sites[0]?.slug;
  const { data: recs } = useQuery(
    ['plan-expired-recs', firstSlug],
    () => fetchJson<{ recommendations: RecFilterable[] }>(
      `/api/domains/${firstSlug}/recommendations`,
      { recommendations: [] },
    ),
    { enabled: Boolean(firstSlug), staleTime: 60_000, retry: false },
  );

  const plan = getCheckoutPlan(summary?.summary.planSlug ?? 'growth');
  const price = annual ? plan?.priceYearly : plan?.priceMonthly;
  // Same predicate the sidebar badge uses, so the two never disagree again.
  const recCount = countActionableRecommendations(recs?.recommendations ?? []);
  const articleCount = articles?.articles?.length ?? 0;

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
              {sites.map((s) => (
                <li key={s.domain} className="plan-expired__site">
                  <Icon name="Globe" size={20} weight="bold" />
                  <span className="plan-expired__site-name">{s.domain}</span>
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
        <Link href="/plans" passHref>
          <a className="plan-expired__cta">
            <Button type="button" variant="primary">
              {`Choose ${plan?.name ?? 'Growth'}`}
            </Button>
          </a>
        </Link>
      </div>
    </div>
  );
}

export default PlanExpired;
