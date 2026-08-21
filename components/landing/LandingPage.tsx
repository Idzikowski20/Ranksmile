import React, { useRef } from 'react';
import Head from 'next/head';
import styled from '@emotion/styled';
import { semantic } from '../koala/tokens/semantic';
import { typeface } from '../koala/tokens/typography';
import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { AnswerDemo } from './sections/AnswerDemo';
import { Stats } from './sections/Stats';
import { Platform } from './sections/Platform';
import { Workflow } from './sections/Workflow';
import { Pricing } from './sections/Pricing';
import { Faq } from './sections/Faq';
import { CtaBand } from './sections/CtaBand';
import { Footer } from './sections/Footer';
import { useLandingMotion } from './useLandingMotion';
import { META, SITE_NAME, SITE_URL, buildJsonLd } from './content';

/*
 * The landing is its own scroll container. Desktop globals lock html/body (the framed
 * app shell), so a fixed, scrolling root works identically at every breakpoint and is
 * what ScrollTrigger watches.
 */
const Root = styled.div`
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

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);
  const jsonLd = buildJsonLd();

  return (
    <>
      <Head>
        <title>{META.title}</title>
        <meta name="description" content={META.description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={META.title} />
        <meta property="og:description" content={META.description} />
        <meta property="og:url" content={`${SITE_URL}/`} />
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
          <Hero />
          <AnswerDemo />
          <Stats />
          <Platform />
          <Workflow />
          <Pricing />
          <Faq />
          <CtaBand />
        </main>
        <Footer />
      </Root>
    </>
  );
}

export default LandingPage;
