import React, { useState } from 'react';
import styled from '@emotion/styled';
import {
  ArrowUpRight,
  Buildings,
  CaretDown,
  ChartLineUp,
  ChatCircleDots,
  FileText,
  Gauge,
  List,
  LockKey,
  MagnifyingGlass,
  PenNib,
  Receipt,
  Scales,
  Sparkle,
  UsersThree,
  Plug,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, fontWeight } from '../../koala/tokens/typography';
import { shadow } from '../../koala/tokens/effects';
import { BP } from '../primitives';
import { ANNOUNCEMENT, NAV, SIGN_IN_HREF, SIGN_UP_HREF, SITE_NAME, SUPPORT_EMAIL } from '../content';

/* ── Announcement bar (unchanged) ────────────────────────────────────────────── */

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

/* ── Floating navbar (Figma 3950:207658 · h 64, radius 20, ghost links) ──────── */

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
  height: 64px;
  padding: 0 16px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 20px;
  background: color-mix(in srgb, ${semantic.background.primary} 94%, transparent);
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  box-shadow: ${shadow.sm};
  font-family: ${typeface.body};
  ${BP.md} {
    padding: 0 8px 0 14px;
    border-radius: 18px;
  }
`;

const Brand = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
  padding: 6px 8px;
  border-radius: 12px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-weight: ${fontWeight.bold};
  font-size: 21px;
  letter-spacing: -0.02em;
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
    margin-right: 0;
    padding: 0;
  }
`;

const Menu = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  ${BP.lg} {
    display: none;
  }
`;

/* Ghost nav button — Figma: h 38, p 8, radius 16, 16px medium, caret 14. */
const MenuButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 16px;
  border: 0;
  background: transparent;
  font-family: ${typeface.body};
  font-size: 16px;
  line-height: 24px;
  letter-spacing: -0.25px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  text-decoration: none;
  white-space: nowrap;
  cursor: var(--koala-cursor-pointing);
  transition: background var(--motion-fast) var(--motion-ease-standard);
  svg {
    color: ${semantic.text.secondary};
    transition: transform var(--motion-fast) var(--motion-ease-standard);
  }
  &:hover {
    background: ${semantic.button.ghost.bgHover};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

/* Component selectors need the Emotion babel plugin (not configured); the hover/focus
   rules for the button live on the parent <li> instead, via plain child selectors. */
const MenuItem = styled.li`
  position: relative;
  &:hover > div,
  &:focus-within > div {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
  &:hover > a,
  &:focus-within > a {
    background: ${semantic.button.ghost.bgHover};
  }
  &:hover > a svg,
  &:focus-within > a svg {
    transform: rotate(180deg);
  }
`;

/* Mega dropdown — Figma 3950:207884: white card, icon + bold title + description rows. */

const Dropdown = styled.div<{ $cols: 1 | 2 }>`
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, minmax(232px, 1fr));
  gap: 0 8px;
  padding: 8px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 16px;
  background: ${semantic.background.primary};
  box-shadow: ${shadow.lg};
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard),
    visibility 0s linear var(--motion-fast);
`;

const DropLink = styled.a`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  text-decoration: none;
  color: ${semantic.text.primary};
  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${semantic.text.primary};
  }
  b {
    display: block;
    font-size: 16px;
    line-height: 24px;
    letter-spacing: -0.25px;
    font-weight: ${fontWeight.bold};
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: -0.4px;
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.secondary};
  }
  &:hover {
    background: ${semantic.background.secondary};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

/* Right buttons — Figma Button Group: brand sm + outline sm, radius 12. */

const Right = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  ${BP.lg} {
    display: none;
  }
`;

const TextLink = styled.a`
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: ${fontWeight.medium};
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

const Primary = styled.a`
  padding: 6px 10px;
  border-radius: 12px;
  background: ${semantic.button.brand.bg};
  color: ${semantic.button.brand.fg};
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: ${fontWeight.medium};
  text-decoration: none;
  &:hover {
    background: ${semantic.button.brand.bgHover};
  }
  &:focus-visible {
    outline: none;
    box-shadow: ${shadow.focus};
  }
`;

const Outline = styled.a`
  padding: 6px 10px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 12px;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: ${fontWeight.medium};
  text-decoration: none;
  box-shadow: 0px 1px 1px rgba(0, 0, 0, 0.04);
  &:hover {
    background: ${semantic.button.secondary.bgHover};
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
    display: flex;
    justify-content: center;
    text-align: center;
    margin: 0;
    padding: 10px;
  }
`;

/* Figma dropdown rows carry an icon per link; NAV stays data-only, glyphs map here. */
const ITEM_ICON: Record<string, PhosphorIcon> = {
  'Content Score': Gauge,
  'AI Visibility': Sparkle,
  'Rank Tracking': ChartLineUp,
  'Coverage & Keyword Gap': MagnifyingGlass,
  'In-house SEO teams': Buildings,
  Agencies: UsersThree,
  'Content managers & writers': PenNib,
  'WordPress plugin': Plug,
  'llms.txt': FileText,
  'pricing.md': Receipt,
  'Legal hub': Scales,
  Contact: ChatCircleDots,
  'Terms of Service': FileText,
  'Privacy Policy': LockKey,
};

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
                  {entry.items ? <CaretDown size={14} weight="bold" aria-hidden /> : null}
                </MenuButton>
                {entry.items ? (
                  <Dropdown role="menu" aria-label={entry.label} $cols={entry.items.length > 4 ? 2 : 1}>
                    {entry.items.map((item) => {
                      const ItemIcon = ITEM_ICON[item.label];
                      return (
                        <DropLink key={item.label} href={item.href} role="menuitem">
                          {ItemIcon ? <ItemIcon size={20} weight="bold" aria-hidden /> : null}
                          <span>
                            <b>{item.label}</b>
                            {item.hint ? <small>{item.hint}</small> : null}
                          </span>
                        </DropLink>
                      );
                    })}
                  </Dropdown>
                ) : null}
              </MenuItem>
            ))}
          </Menu>

          <Right>
            <TextLink href={SIGN_IN_HREF}>Login</TextLink>
            <Primary href={SIGN_UP_HREF}>Start for Free</Primary>
            <Outline href={`mailto:${SUPPORT_EMAIL}?subject=Ranksmile%20demo`}>Book a demo</Outline>
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
                  ? entry.items.map((item) => {
                    const ItemIcon = ITEM_ICON[item.label];
                    return (
                      <DropLink key={item.label} href={item.href} onClick={() => setOpen(false)}>
                        {ItemIcon ? <ItemIcon size={20} weight="bold" aria-hidden /> : null}
                        <span><b>{item.label}</b></span>
                      </DropLink>
                    );
                  })
                  : (
                    <DropLink href={entry.href ?? '#'} onClick={() => setOpen(false)}>
                      <span><b>{entry.label}</b></span>
                    </DropLink>
                  )}
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
