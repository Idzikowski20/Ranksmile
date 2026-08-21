import React, { useState } from 'react';
import styled from '@emotion/styled';
import { ArrowUpRight, CaretDown, List, X, YoutubeLogo } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, fontWeight } from '../../koala/tokens/typography';
import { shadow } from '../../koala/tokens/effects';
import { BP } from '../primitives';
import { ANNOUNCEMENT, NAV, SIGN_IN_HREF, SIGN_UP_HREF, SITE_NAME, SUPPORT_EMAIL } from '../content';

/* ── Announcement bar (Figma 1:4061 · 60px, centred, 15.8/23.63) ─────────────── */

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  padding: 18px 27px;
  background: ${semantic.background.secondary};
  font-family: ${typeface.body};
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.primary};
  text-align: center;
  ${BP.sm} {
    padding: 12px 18px;
    font-size: 14px;
    line-height: 20px;
  }
`;

const BarInner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 15.75px;
  max-width: 1674px;
`;

const BarText = styled.p`
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 4.72px;
  padding-left: 4.72px;
  svg {
    flex-shrink: 0;
    color: var(--koala-status-danger);
  }
  b {
    font-weight: ${fontWeight.bold};
  }
  ${BP.md} {
    span {
      display: none;
    }
  }
`;

const BarLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 7.87px;
  color: ${semantic.text.primary};
  text-decoration: none;
  &:hover {
    color: ${semantic.text.brand};
  }
`;

/* ── Floating pill nav (Figma 2:11 · 83px, radius 27, inset 105px) ──────────── */

const Sticky = styled.header`
  position: sticky;
  top: 0;
  z-index: 40;
  padding: 9px 5.46% 0;
  pointer-events: none;
  ${BP.lg} {
    padding: 9px 18px 0;
  }
`;

const Nav = styled.nav`
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: center;
  height: 83px;
  padding: 13.5px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 27px;
  background: color-mix(in srgb, ${semantic.background.primary} 92%, transparent);
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  box-shadow: ${shadow.sm};
  font-family: ${typeface.body};
  ${BP.md} {
    height: 64px;
    padding: 8px 8px 8px 14px;
    border-radius: 18px;
  }
`;

const Brand = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 13.5px 18px;
  border-radius: 13.5px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: 22px;
  letter-spacing: -0.02em;
  height: 28px;
  box-sizing: content-box;
  img {
    width: 28px;
    height: 28px;
    display: block;
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
  ${BP.md} {
    padding: 0;
  }
`;

const Menu = styled.ul`
  list-style: none;
  margin: 0 0 0 26px;
  padding: 0;
  display: flex;
  align-items: center;
  ${BP.lg} {
    display: none;
  }
`;

const MenuItem = styled.li`
  position: relative;
  &:hover > div,
  &:focus-within > div {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
`;

const MenuButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 13.5px;
  padding: 13.5px 18px;
  border-radius: 13.5px;
  border: 0;
  background: transparent;
  font-family: ${typeface.body};
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  text-decoration: none;
  cursor: var(--koala-cursor-pointing);
  transition: background var(--motion-fast) var(--motion-ease-standard);
  svg {
    color: ${semantic.text.tertiary};
    transition: transform var(--motion-fast) var(--motion-ease-standard);
  }
  &:hover,
  ${MenuItem}:focus-within & {
    background: ${semantic.button.ghost.bgHover};
  }
  ${MenuItem}:hover & svg,
  ${MenuItem}:focus-within & svg {
    transform: rotate(180deg);
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 280px;
  padding: 9px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 18px;
  background: ${semantic.background.primary};
  box-shadow: ${shadow.lg};
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity var(--motion-fast) var(--motion-ease-standard), transform var(--motion-fast) var(--motion-ease-standard), visibility 0s linear var(--motion-fast);
`;

const DropLink = styled.a`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-size: 15.8px;
  line-height: 20px;
  font-weight: ${fontWeight.medium};
  small {
    font-size: 13.5px;
    line-height: 18px;
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.tertiary};
  }
  &:hover {
    background: ${semantic.background.secondary};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Right = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  ${BP.lg} {
    display: none;
  }
`;

const TextLink = styled.a`
  padding: 13.5px 18px;
  border-radius: 13.5px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  text-decoration: none;
  &:hover {
    background: ${semantic.button.ghost.bgHover};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Outline = styled.a`
  margin: 0 4.5px;
  padding: 13.5px 18px;
  border: 1px solid ${semantic.border.secondary};
  border-radius: 13.5px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  text-decoration: none;
  &:hover {
    background: ${semantic.button.secondary.bgHover};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Primary = styled.a`
  padding: 14.75px 18px 15.75px;
  border-radius: 13.5px;
  background: ${semantic.button.brand.bg};
  color: ${semantic.button.brand.fg};
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  text-decoration: none;
  &:hover {
    background: ${semantic.button.brand.bgHover};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Burger = styled.button`
  display: none;
  margin-left: auto;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${semantic.border.primary};
  border-radius: 12px;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  ${BP.lg} {
    display: inline-flex;
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Sheet = styled.div`
  pointer-events: auto;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 18px;
  background: ${semantic.background.primary};
  box-shadow: ${shadow.lg};
  display: none;
  ${BP.lg} {
    display: block;
  }
`;

const SheetGroup = styled.div`
  padding: 6px 0;
  & + & {
    border-top: 1px solid ${semantic.border.primary};
  }
  p {
    margin: 0 12px 4px;
    font-size: 13.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${semantic.text.tertiary};
  }
`;

const SheetCtas = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 12px;
  a {
    justify-content: center;
    text-align: center;
    margin: 0;
  }
`;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Bar role="region" aria-label="Announcement">
        <BarInner>
          <BarText>
            <YoutubeLogo size={18} weight="fill" aria-hidden />
            <b>{ANNOUNCEMENT.strong}</b>
            <span>{ANNOUNCEMENT.rest}</span>
          </BarText>
          <BarLink href={ANNOUNCEMENT.href}>
            {ANNOUNCEMENT.cta}
            <ArrowUpRight size={19.69} weight="bold" aria-hidden />
          </BarLink>
        </BarInner>
      </Bar>

      <Sticky>
        <Nav aria-label="Main navigation">
          <Brand href="/" aria-label={`${SITE_NAME} — home`}>
            <img src="/favicon.svg" alt="" width={28} height={28} />
            {SITE_NAME}
          </Brand>

          <Menu>
            {NAV.map((entry) => (
              <MenuItem key={entry.label}>
                <MenuButton
                  href={entry.href ?? '#'}
                  aria-haspopup={entry.items ? 'true' : undefined}
                  onClick={(e) => { if (!entry.href) e.preventDefault(); }}
                >
                  {entry.label}
                  {entry.items ? <CaretDown size={9} weight="bold" aria-hidden /> : null}
                </MenuButton>
                {entry.items ? (
                  <Dropdown role="menu" aria-label={entry.label}>
                    {entry.items.map((item) => (
                      <DropLink key={item.label} href={item.href} role="menuitem">
                        {item.label}
                        {item.hint ? <small>{item.hint}</small> : null}
                      </DropLink>
                    ))}
                  </Dropdown>
                ) : null}
              </MenuItem>
            ))}
          </Menu>

          <Right>
            <TextLink href={SIGN_IN_HREF}>Login</TextLink>
            <Outline href={`mailto:${SUPPORT_EMAIL}?subject=Ranksmile%20demo`}>Book a demo</Outline>
            <Primary href={SIGN_UP_HREF}>Start for Free</Primary>
          </Right>

          <Burger
            type="button"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} weight="bold" aria-hidden /> : <List size={20} weight="bold" aria-hidden />}
          </Burger>
        </Nav>

        {open ? (
          <Sheet id="landing-mobile-nav">
            {NAV.map((entry) => (
              <SheetGroup key={entry.label}>
                <p>{entry.label}</p>
                {entry.items
                  ? entry.items.map((item) => (
                    <DropLink key={item.label} href={item.href} onClick={() => setOpen(false)}>{item.label}</DropLink>
                  ))
                  : <DropLink href={entry.href ?? '#'} onClick={() => setOpen(false)}>{entry.label}</DropLink>}
              </SheetGroup>
            ))}
            <SheetCtas>
              <Outline href={SIGN_IN_HREF}>Login</Outline>
              <Primary href={SIGN_UP_HREF}>Start for Free</Primary>
            </SheetCtas>
          </Sheet>
        ) : null}
      </Sticky>
    </>
  );
}

export default Header;
