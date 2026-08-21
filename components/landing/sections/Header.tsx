import React, { useState } from 'react';
import styled from '@emotion/styled';
import { List, X, ArrowRight } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, CtaLink } from '../primitives';
import { NAV, SIGN_IN_HREF, SIGN_UP_HREF, SITE_NAME } from '../content';

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, ${semantic.background.primary} 88%, transparent);
  backdrop-filter: saturate(1.4) blur(10px);
  -webkit-backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid ${semantic.border.primary};
`;

const Inner = styled(Container)`
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const Brand = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: ${textScale.lg.fontSize};
  letter-spacing: -0.02em;
  img {
    width: 28px;
    height: 28px;
    display: block;
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
    border-radius: ${radius.sm};
  }
`;

const Nav = styled.nav`
  display: none;
  ${media.lg} {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

const NavLink = styled.a`
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  border-radius: ${radius.button.default};
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  letter-spacing: ${textScale.sm.letterSpacing};
  color: ${semantic.text.secondary};
  text-decoration: none;
  transition: background var(--motion-fast) var(--motion-ease-standard), color var(--motion-fast) var(--motion-ease-standard);
  &:hover {
    background: ${semantic.button.ghost.bgHover};
    color: ${semantic.text.primary};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Actions = styled.div`
  display: none;
  ${media.lg} {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const SmallCta = styled(CtaLink)`
  height: 36px;
  padding: 0 14px;
  border-radius: ${radius.button.default};
  font-size: ${textScale.sm.fontSize};
`;

const Burger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.button.default};
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  ${media.lg} {
    display: none;
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Sheet = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 20px 20px;
  border-top: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  ${media.lg} {
    display: none;
  }
  a {
    justify-content: flex-start;
  }
`;

const SheetCtas = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
`;

export function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Bar>
      <Inner>
        <Brand href="/" aria-label={`${SITE_NAME} — home`}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          {SITE_NAME}
        </Brand>

        <Nav aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>{item.label}</NavLink>
          ))}
        </Nav>

        <Actions>
          <NavLink href={SIGN_IN_HREF}>Sign in</NavLink>
          <SmallCta href={SIGN_UP_HREF}>
            Start for free
            <ArrowRight size={16} weight="bold" aria-hidden />
          </SmallCta>
        </Actions>

        <Burger
          type="button"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} weight="bold" aria-hidden /> : <List size={20} weight="bold" aria-hidden />}
        </Burger>
      </Inner>

      {open ? (
        <Sheet id="landing-mobile-nav">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} onClick={close}>{item.label}</NavLink>
          ))}
          <SheetCtas>
            <CtaLink href={SIGN_IN_HREF} $variant="secondary">Sign in</CtaLink>
            <CtaLink href={SIGN_UP_HREF}>Start for free</CtaLink>
          </SheetCtas>
        </Sheet>
      ) : null}
    </Bar>
  );
}

export default Header;
