import React, { useRef, useState } from 'react';
import Head from 'next/head';
import styled from '@emotion/styled';
import { semantic } from '../koala/tokens/semantic';
import { typeface } from '../koala/tokens/typography';
import { palette } from '../koala/tokens/colors';
import { Header } from '../landing/sections/Header';
import { Footer } from '../landing/sections/Footer';
import { useLandingMotion } from '../landing/useLandingMotion';
import { PrHead } from './sections/PrHead';
import { PrPlans } from './sections/PrPlans';
import { PrSmaller } from './sections/PrSmaller';
import { PrCompare } from './sections/PrCompare';
import { PrAnalytics } from './sections/PrAnalytics';
import { PrFaq } from './sections/PrFaq';
import { PrCta } from './sections/PrCta';
import { META, PATH, SITE_URL, buildJsonLd } from './content';

const Root = styled.div`
  --landing-green: ${palette.green[500]};
  --landing-green-ink: ${palette.green[950]};
  --landing-blue: ${palette.blue[600]};
  position: fixed;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-behavior: smooth;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  font-family: ${typeface.body};
  -webkit-font-smoothing: antialiased;
  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const SkipLink = styled.a`
  position: absolute;
  top: -100px;
  left: 16px;
  z-index: 100;
  padding: 8px 12px;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  border: 1px solid ${semantic.border.primary};
  border-radius: 12px;
  &:focus {
    top: 12px;
  }
`;

export function PricingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);
  const jsonLd = buildJsonLd();
  const [tab, setTab] = useState(0);

  return (
    <>
      <Head>
        <title>{META.title}</title>
        <meta name="description" content={META.description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href={`${SITE_URL}${PATH}`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={META.title} />
        <meta property="og:description" content={META.description} />
        <meta property="og:url" content={`${SITE_URL}${PATH}`} />
        <meta property="og:image" content={META.ogImage} />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={META.title} />
        <meta name="twitter:description" content={META.description} />
        <meta name="twitter:image" content={META.ogImage} />
        <script
          type="application/ld+json"
          // JSON-LD is static, built from content.ts — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>
      <Root ref={rootRef} data-landing-root>
        <SkipLink href="#main">Skip to main content</SkipLink>
        <Header />
        <main id="main">
          <PrHead tab={tab} onTab={setTab} />
          {tab === 0 ? (
            <>
              <PrPlans />
              <PrSmaller />
              <PrCompare />
            </>
          ) : (
            <PrAnalytics />
          )}
          <PrFaq />
          <PrCta />
        </main>
        <Footer />
      </Root>
    </>
  );
}

export default PricingPage;
