import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';
import { isBannerDismissed, markBannerDismissed } from '@/lib/bannerDismissal';
import { Button } from '../koala/core';
import { Icon } from '../koala/icons/Icon';

const HIDE_KEY = 'dashboard-get-started';

type Props = { createHref: string };

/**
 * The onboarding checklist as a numbered stepper next to the "create content" promo —
 * the reference dashboard's hero. Hidden for good once the user hides it.
 */
export default function GetStartedPanel({ createHref }: Props) {
  const router = useRouter();
  const { steps, loading } = useOnboardingChecklist();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(isBannerDismissed(HIDE_KEY)); }, []);
  if (hidden || loading) return null;

  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <section className="dash-get-started" aria-label="Get started">
      <button
        type="button"
        className="dash-get-started__hide"
        onClick={() => { markBannerDismissed(HIDE_KEY); setHidden(true); }}
      >
        Hide
      </button>

      <ol className="dash-steps">
        {steps.map((step, i) => {
          const state = step.done ? 'is-done' : (i === activeIndex ? 'is-active' : '');
          const num = step.done ? <Icon name="Check" size={11} /> : i + 1;
          const inner = (
            <>
              <span className="dash-step__num">{num}</span>
              <span className="dash-step__label">{step.label}</span>
            </>
          );
          return (
            <li key={step.key}>
              {step.href && !step.done
                ? <Link href={step.href}><a className={`dash-step ${state}`} aria-current={i === activeIndex ? 'step' : undefined}>{inner}</a></Link>
                : <div className={`dash-step ${state}`}>{inner}</div>}
            </li>
          );
        })}
      </ol>

      <div className="dash-promo">
        {/* The tour-scene anatomy, static: a brand panel with the editor's Content Score
            panel offset into it and cropped at the right and bottom edges. */}
        <div className="dash-promo__art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dash-promo__shot" src="/content-editor/content-score-panel-full.png" alt="" />
        </div>
        <div>
          <h3 className="dash-promo__title">Write a complete article in minutes, from one keyword</h3>
          <p className="dash-promo__text">
            Ranksmile plans the outline, writes every section and scores it for search and AI answers as it goes.
          </p>
          <Button type="button" variant="primary" size="sm" onClick={() => router.push(createHref)}>Create content</Button>
        </div>
      </div>
    </section>
  );
}
