import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from '../components/koala/core';
import { Icon } from '../components/koala/icons/Icon';
import { FeedbackPopover } from '../components/koala/product/FeedbackPopover';

/**
 * 404 — Koala Status Section (Figma `3056:23842`).
 * Plain variant: icon + copy + actions (no newsletter).
 */
const NotFoundPage: NextPage = () => {
  const router = useRouter();

  return (
    <div className="koala-404">
      <Head>
        <title>Page not found — Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="koala-404__main" role="main">
        <div className="koala-404__stack">
          <div className="koala-404__copy">
            <div className="koala-404__icon-frame" aria-hidden="true">
              <Icon name="Alien" size={40} weight="bold" color="var(--koala-text-primary)" />
            </div>
            <div className="koala-404__text">
              <h1 className="koala-404__title">
                Oops, the page you were looking for doesn&apos;t exist!
              </h1>
              <p className="koala-404__subtitle">
                Lost in the digital woods? Don&apos;t worry, we&apos;ll help you back. Explore more or contact us for help.
              </p>
            </div>
          </div>

          <div className="koala-404__actions">
            <Button type="button" variant="primary" size="md" onClick={() => { void router.push('/'); }}>
              Go home
            </Button>
            <FeedbackPopover context="404">
              {({ open, anchorRef }) => (
                <span ref={anchorRef as React.RefObject<HTMLSpanElement>}>
                  <Button type="button" variant="secondary" size="md" onClick={open}>
                    Open ticket
                  </Button>
                </span>
              )}
            </FeedbackPopover>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
