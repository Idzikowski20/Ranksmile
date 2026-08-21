import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container } from '../primitives';
import { ENGINES, FOOTER_COLUMNS, SITE_NAME } from '../content';

const Root = styled.footer`
  border-top: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  padding: 56px 0 32px;
  font-family: ${typeface.body};
`;

const Top = styled.div`
  display: grid;
  gap: 40px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: 1.4fr repeat(4, 1fr);
    gap: 32px;
  }
`;

const Brand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 300px;
`;

const Logo = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: ${textScale.xl.fontSize};
  letter-spacing: -0.02em;
  img {
    width: 28px;
    height: 28px;
  }
`;

const Tagline = styled.p`
  margin: 0;
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  color: ${semantic.text.secondary};
`;

const ColTitle = styled.h3`
  margin: 0 0 14px;
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const Links = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FooterLink = styled.a`
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.secondary};
  text-decoration: none;
  &:hover {
    color: ${semantic.text.primary};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: ${radius.sm};
  }
`;

const Bottom = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid ${semantic.border.primary};
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.tertiary};
`;

export function Footer() {
  return (
    <Root>
      <Container>
        <Top>
          <Brand>
            <Logo href="/">
              <img src="/favicon.svg" alt="" width={28} height={28} />
              {SITE_NAME}
            </Logo>
            <Tagline>
              SEO and AI visibility workspace. Rank in Google and get cited by
              {' '}
              {ENGINES.slice(1).join(', ')}
              .
            </Tagline>
          </Brand>
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <ColTitle>{col.title}</ColTitle>
              <Links>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </Links>
            </nav>
          ))}
        </Top>
        <Bottom>
          <span>
            ©
            {' '}
            {new Date().getFullYear()}
            {' '}
            {SITE_NAME}
            . All rights reserved.
          </span>
          <span>Made for content teams who want to be the answer.</span>
        </Bottom>
      </Container>
    </Root>
  );
}

export default Footer;
