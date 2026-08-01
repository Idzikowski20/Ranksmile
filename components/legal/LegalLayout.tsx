import type { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styled from '@emotion/styled';
import { LEGAL_COMPANY, LEGAL_DOCS } from '../../lib/legal/company';

const FONT = 'var(--font-family-primary)';
const BRAND = '#F84416';
const INK = '#1A1A1A';
const MUTED = '#575757';
const BORDER = '#E5E5E5';
const PAGE_BG = '#FFFFFF';

/* Desktop globals lock html/body overflow (framed AppShell). Public legal
   pages are not inside .app-content — scroll on this root instead. */
const Shell = styled.div`
  min-height: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: ${PAGE_BG};
  color: ${INK};
  font-family: ${FONT};
`;

const Nav = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${PAGE_BG};
  border-bottom: 1px solid ${BORDER};
`;

const NavInner = styled.div`
  width: 100%;
  max-width: 1216px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 720px) {
    padding: 0 16px;
  }
`;

const BrandLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: ${INK};
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.25px;
`;

const NavLinks = styled.nav`
  display: flex;
  align-items: center;
  gap: 4px;

  @media (max-width: 720px) {
    display: none;
  }
`;

const NavGhost = styled.a`
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 8px;
  border-radius: 16px;
  color: ${INK};
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.25px;
  text-decoration: none;

  &:hover {
    background: #f5f5f5;
  }
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BtnPrimary = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 6px 12px;
  border-radius: 12px;
  background: ${BRAND};
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.4px;
  text-decoration: none;

  &:hover {
    filter: brightness(0.96);
  }
`;

const BtnGhost = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 6px 12px;
  border-radius: 12px;
  color: ${INK};
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.4px;
  text-decoration: none;

  &:hover {
    background: #f5f5f5;
  }
`;

const Hero = styled.section`
  background: ${BRAND};
  color: #fff;
`;

const HeroInner = styled.div`
  max-width: 1216px;
  margin: 0 auto;
  padding: 56px 32px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;

  @media (max-width: 720px) {
    padding: 40px 16px;
    flex-direction: column;
    align-items: flex-start;
  }
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1.2px;
`;

const HeroMeta = styled.p`
  margin: 12px 0 0;
  font-size: 16px;
  font-weight: 500;
  opacity: 0.92;
  letter-spacing: -0.25px;
`;

const HeroCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
`;

const HeroBtnDark = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 10px 16px;
  border-radius: 14px;
  background: ${INK};
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.25px;
  text-decoration: none;
`;

const HeroBtnOutline = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.25px;
  text-decoration: none;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const Main = styled.main`
  max-width: 704px;
  margin: 0 auto;
  padding: 56px 24px 80px;
`;

const Article = styled.article`
  font-size: 18px;
  line-height: 26px;
  letter-spacing: -0.5px;
  color: ${MUTED};

  h2 {
    margin: 40px 0 0;
    padding: 16px 0;
    font-size: 30px;
    font-weight: 700;
    line-height: 36px;
    letter-spacing: -0.07px;
    color: ${INK};
  }

  h3 {
    margin: 28px 0 12px;
    font-size: 20px;
    font-weight: 700;
    line-height: 28px;
    letter-spacing: -0.3px;
    color: ${INK};
  }

  p {
    margin: 0 0 24px;
  }

  ul,
  ol {
    margin: 0 0 24px;
    padding-left: 24px;
  }

  li {
    margin-bottom: 8px;
  }

  a {
    color: ${BRAND};
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  code {
    font-size: 0.9em;
    background: #f5f5f5;
    border: 1px solid ${BORDER};
    border-radius: 6px;
    padding: 1px 6px;
  }

  strong {
    color: ${INK};
    font-weight: 700;
  }

  .legal-note {
    margin: 32px 0 0;
    padding: 16px 18px;
    border: 1px solid ${BORDER};
    border-radius: 16px;
    background: #fafafa;
    font-size: 15px;
    line-height: 22px;
    color: ${MUTED};
  }

  .legal-note strong {
    display: block;
    margin-bottom: 6px;
  }
`;

const Footer = styled.footer`
  border-top: 1px solid ${BORDER};
  background: ${PAGE_BG};
`;

const FooterInner = styled.div`
  max-width: 1216px;
  margin: 0 auto;
  padding: 48px 32px 24px;
  display: grid;
  grid-template-columns: minmax(200px, 1.2fr) repeat(2, minmax(140px, 1fr));
  gap: 40px;

  @media (max-width: 720px) {
    padding: 40px 16px 20px;
    grid-template-columns: 1fr;
    gap: 28px;
  }
`;

const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FooterTag = styled.p`
  margin: 0;
  max-width: 280px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  color: ${MUTED};
`;

const FooterColTitle = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: ${INK};
`;

const FooterLink = styled.a`
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: -0.4px;
  color: ${INK};
  text-decoration: none;

  &:hover {
    color: ${BRAND};
  }
`;

const FooterBottom = styled.div`
  max-width: 1216px;
  margin: 0 auto;
  padding: 16px 32px 32px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid ${BORDER};
  font-size: 13px;
  color: ${MUTED};

  @media (max-width: 720px) {
    padding: 16px;
  }
`;

const FooterBottomLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;

  a {
    margin-bottom: 0;
    color: ${MUTED};
    font-size: 13px;
  }
`;

export default function LegalLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const agreements = LEGAL_DOCS.filter((d) => d.group === 'agreements');
  const policies = LEGAL_DOCS.filter((d) => d.group === 'policies');
  const metaDescription =
    description
    || `${title} for Ranksmile — SEO content workspace.`;

  return (
    <>
      <Head>
        <title>{title} · Ranksmile</title>
        <meta name="description" content={metaDescription} />
        <meta name="robots" content="index,follow" />
      </Head>
      <Shell>
        <Nav>
          <NavInner>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Link href="/" passHref>
                <BrandLink>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/favicon.svg" alt="" width={28} height={28} />
                  Ranksmile
                </BrandLink>
              </Link>
              <NavLinks aria-label="Legal navigation">
                <Link href="/" passHref>
                  <NavGhost>Home</NavGhost>
                </Link>
                <Link href="/legal" passHref>
                  <NavGhost>Legal</NavGhost>
                </Link>
              </NavLinks>
            </div>
            <NavActions>
              <Link href="/auth/sign-in" passHref>
                <BtnGhost>Sign in</BtnGhost>
              </Link>
              <Link href="/auth/sign-up" passHref>
                <BtnPrimary>Sign up</BtnPrimary>
              </Link>
            </NavActions>
          </NavInner>
        </Nav>

        <Hero>
          <HeroInner>
            <div>
              <HeroTitle>{title}</HeroTitle>
              <HeroMeta>
                Last updated:
                {' '}
                {LEGAL_COMPANY.lastUpdated}
              </HeroMeta>
            </div>
            <HeroCtas>
              <Link href="/auth/sign-up" passHref>
                <HeroBtnDark>Get started</HeroBtnDark>
              </Link>
              <Link href="/legal" passHref>
                <HeroBtnOutline>All legal docs</HeroBtnOutline>
              </Link>
            </HeroCtas>
          </HeroInner>
        </Hero>

        <Main>
          <Article>{children}</Article>
        </Main>

        <Footer>
          <FooterInner>
            <FooterBrand>
              <Link href="/" passHref>
                <BrandLink>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/favicon.svg" alt="" width={28} height={28} />
                  Ranksmile
                </BrandLink>
              </Link>
              <FooterTag>
                SEO content workspace — research, score, and ship pages that rank.
              </FooterTag>
            </FooterBrand>
            <div>
              <FooterColTitle>Agreements</FooterColTitle>
              {agreements.map((d) => (
                <Link key={d.id} href={d.href} passHref>
                  <FooterLink>{d.title}</FooterLink>
                </Link>
              ))}
            </div>
            <div>
              <FooterColTitle>Policies</FooterColTitle>
              {policies.map((d) => (
                <Link key={d.id} href={d.href} passHref>
                  <FooterLink>{d.title}</FooterLink>
                </Link>
              ))}
              <Link href="/legal" passHref>
                <FooterLink>Legal hub</FooterLink>
              </Link>
            </div>
          </FooterInner>
          <FooterBottom>
            <span>
              ©
              {' '}
              {new Date().getFullYear()}
              {' '}
              Ranksmile ·
              {' '}
              {LEGAL_COMPANY.legalName}
            </span>
            <FooterBottomLinks>
              {LEGAL_DOCS.map((d) => (
                <Link key={d.id} href={d.href} passHref>
                  <FooterLink>{d.title}</FooterLink>
                </Link>
              ))}
            </FooterBottomLinks>
          </FooterBottom>
        </Footer>
      </Shell>
    </>
  );
}
