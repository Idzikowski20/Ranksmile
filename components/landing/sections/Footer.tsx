import React from 'react';
import styled from '@emotion/styled';
import { ArrowUpRight, FacebookLogo, Globe, InstagramLogo, LinkedinLogo, XLogo } from '@phosphor-icons/react';
import { LEGAL_COMPANY } from '@/src/core/domain/legal/company';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, fontWeight } from '../../koala/tokens/typography';
import { shadow } from '../../koala/tokens/effects';
import { BP, Container } from '../primitives';
import { FOOTER_COLUMNS, FOOTER_LEGAL, SITE_NAME } from '../content';

/*
 * Koala UI footer (Figma 8984:146288) with Ranksmile content: logo + social icons left,
 * four link columns right; bottom row = language pill + copyright | payment icons.
 */

const Root = styled.footer`
  border-top: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  font-family: ${typeface.body};
  color: ${semantic.text.primary};
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 64px;
  padding: 96px 0 32px;
  ${BP.md} {
    gap: 45px;
    padding: 64px 0 24px;
  }
`;

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 45px;
  ${BP.lg} {
    flex-direction: column;
  }
`;

const Branding = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Logo = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-size: 28px;
  line-height: 40px;
  letter-spacing: -0.04em;
  font-weight: ${fontWeight.bold};
  img {
    width: 40px;
    height: 40px;
  }
  em {
    font-style: normal;
    color: ${semantic.text.brand};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: 8px;
  }
`;

const Social = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  a {
    display: inline-flex;
    color: ${semantic.text.primary};
    &:hover {
      color: ${semantic.text.brand};
    }
    &:focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: 4px;
    }
  }
`;

/* Four equal columns, Figma: header 14 medium primary, links 14 regular secondary, gap 8. */

const Columns = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 628px;
  max-width: 100%;
  ${BP.sm} {
    width: 100%;
  }
`;

const Col = styled.nav`
  flex: 1 0 0;
  min-width: 130px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  h3 {
    margin: 0 0 0;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: -0.4px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  ${BP.sm} {
    flex: 1 0 40%;
  }
`;

const FLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  color: ${semantic.text.secondary};
  text-decoration: none;
  &:hover {
    color: ${semantic.text.primary};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: 6px;
  }
`;

/* Bottom row — Figma: language pill + copyright left, payment icons right. */

const Bottom = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
`;

const BottomLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
`;

const LangPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${semantic.button.brand.radius};
  background: ${semantic.background.primary};
  box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.04);
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.secondary};
  }
`;

const LegalRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
`;

const Copyright = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
  small {
    display: block;
    font-size: 12.5px;
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.tertiary};
  }
`;

const Payments = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
`;

const PayIcon = styled.span<{ $boxed?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 24px;
  box-sizing: border-box;
  border: ${(p) => (p.$boxed ? `0.5px solid ${semantic.border.primary}` : 'none')};
  border-radius: 3px;
  background: ${(p) => (p.$boxed ? semantic.background.primary : 'transparent')};
  img {
    display: block;
  }
  > img {
    width: 100%;
    height: 100%;
  }
`;

const GpayInner = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 1.5px;
  img {
    height: 8.6px;
    width: auto;
  }
`;

const SOCIAL = [
  { label: 'LinkedIn', icon: LinkedinLogo, href: '#' },
  { label: 'X (Twitter)', icon: XLogo, href: '#' },
  { label: 'Facebook', icon: FacebookLogo, href: '#' },
  { label: 'Instagram', icon: InstagramLogo, href: '#' },
] as const;

const P = '/landing/pay';

export function Footer() {
  return (
    <Root>
      <Container>
        <Wrap>
          <Top>
            <Branding>
              <Logo href="/">
                <img loading="lazy" decoding="async" src="/favicon.svg" alt="" width={40} height={40} />
                <span>
                  Rank
                  <em>smile</em>
                </span>
              </Logo>
              <Social aria-label="Ranksmile on social media">
                {SOCIAL.map(({ label, icon: IconComp, href }) => (
                  <a key={label} href={href} aria-label={label}>
                    <IconComp size={20} weight="fill" aria-hidden />
                  </a>
                ))}
              </Social>
            </Branding>

            <Columns>
              {FOOTER_COLUMNS.map((col) => (
                <Col key={col.title} aria-label={col.title}>
                  <h3>{col.title}</h3>
                  <ul>
                    {col.links.map((link) => (
                      <li key={`${col.title}-${link.label}`}>
                        <FLink href={link.href}>
                          {link.label}
                          {'external' in link && link.external ? <ArrowUpRight size={12} weight="bold" aria-hidden /> : null}
                        </FLink>
                      </li>
                    ))}
                  </ul>
                </Col>
              ))}
            </Columns>
          </Top>

          <Bottom>
            <BottomLeft>
              <LangPill>
                <Globe size={20} weight="bold" aria-hidden />
                English
              </LangPill>
              <LegalRow>
                {FOOTER_LEGAL.map((l) => <FLink key={l.href} href={l.href}>{l.label}</FLink>)}
              </LegalRow>
              <Copyright>
                {`Copyright © ${new Date().getFullYear()} ${SITE_NAME}`}
                <small>
                  {`${LEGAL_COMPANY.legalName} · ${LEGAL_COMPANY.registeredAddress}, `}
                  {`${LEGAL_COMPANY.country} · NIP: ${LEGAL_COMPANY.nip}`}
                </small>
              </Copyright>
            </BottomLeft>

            <Payments aria-label="Accepted payment methods">
              <PayIcon><img src={`${P}/visa.svg`} alt="Visa" width={36} height={24} loading="lazy" /></PayIcon>
              <PayIcon><img src={`${P}/stripe.svg`} alt="Stripe" width={36} height={24} loading="lazy" /></PayIcon>
              <PayIcon $boxed>
                <img src={`${P}/mastercard-mark.svg`} alt="Mastercard" width={23} height={14} loading="lazy" />
              </PayIcon>
              <PayIcon $boxed>
                <GpayInner aria-label="Google Pay" role="img">
                  <img src={`${P}/gpay-g.svg`} alt="" loading="lazy" />
                  <img src={`${P}/gpay-pay.svg`} alt="" loading="lazy" />
                </GpayInner>
              </PayIcon>
              <PayIcon><img src={`${P}/applepay.svg`} alt="Apple Pay" width={36} height={24} loading="lazy" /></PayIcon>
              <PayIcon><img src={`${P}/klarna.svg`} alt="Klarna" width={36} height={24} loading="lazy" /></PayIcon>
              <PayIcon $boxed>
                <img src={`${P}/paypal-mark.svg`} alt="PayPal" width={21} height={17} loading="lazy" />
              </PayIcon>
            </Payments>
          </Bottom>
        </Wrap>
      </Container>
    </Root>
  );
}

export default Footer;
