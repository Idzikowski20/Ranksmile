import React from 'react';
import styled from '@emotion/styled';
import { ArrowUpRight, CheckCircle } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, fontWeight } from '../../koala/tokens/typography';
import { shadow } from '../../koala/tokens/effects';
import { LEGAL_COMPANY } from '../../../lib/legal/company';
import { BP, Container } from '../primitives';
import { FOOTER_BADGES, FOOTER_COLUMNS, FOOTER_LEGAL, SIGN_UP_HREF, SITE_NAME, SUPPORT_EMAIL } from '../content';

/* Figma 1:3845 — py 126; grid 1.5fr + 4×1fr, gap-x 18 / gap-y 90; rows: logo+badges · columns · legal. */

const Root = styled.footer`
  border-top: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  font-family: ${typeface.body};
  color: ${semantic.text.primary};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(4, minmax(0, 1fr));
  column-gap: 18px;
  row-gap: 90px;
  padding: 126px 0;
  ${BP.lg} {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 54px;
    padding: 72px 0;
  }
  ${BP.sm} {
    grid-template-columns: 1fr;
  }
`;

const Logo = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  height: 78.83px;
  text-decoration: none;
  color: ${semantic.text.primary};
  font-family: ${typeface.heading};
  font-size: 44px;
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: ${fontWeight.bold};
  img {
    width: 56px;
    height: 56px;
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

const Badges = styled.div`
  grid-column: 2 / -1;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 45px;
  padding-top: 58.83px;
  flex-wrap: wrap;
  ${BP.lg} {
    grid-column: 1 / -1;
    padding-top: 0;
  }
`;

const Badge = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  font-size: 18px;
  line-height: 27px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  white-space: pre;
  svg {
    color: ${semantic.status.success};
  }
  span {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.secondary};
  }
`;

const Company = styled.div`
  display: flex;
  flex-direction: column;
  gap: 17.4px;
  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    font-weight: ${fontWeight.regular};
  }
  address {
    font-style: normal;
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.secondary};
  }
`;

const Col = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 18px;
  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    font-weight: ${fontWeight.regular};
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
`;

const FLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4.5px;
  padding: 5.4px 0;
  font-size: 15.8px;
  line-height: 23.63px;
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

const Legal = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
  }
  small {
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.tertiary};
  }
`;

export function Footer() {
  return (
    <Root>
      <Container>
        <Grid>
          <Logo href="/">
            <img loading="lazy" decoding="async" src="/favicon.svg" alt="" width={56} height={56} />
            <span>
              Rank
              <em>smile</em>
            </span>
          </Logo>
          <Badges>
            {FOOTER_BADGES.map((b) => (
              <Badge key={b.strong} href={b.href}>
                <CheckCircle size={18} weight="fill" aria-hidden />
                {b.strong}
                {' '}
                <span>{b.muted}</span>
              </Badge>
            ))}
          </Badges>

          <Company>
            <h3>Company</h3>
            <address>
              {LEGAL_COMPANY.legalName}
              <br />
              {LEGAL_COMPANY.registeredAddress}
              <br />
              {LEGAL_COMPANY.country}
              <br />
              {`NIP: ${LEGAL_COMPANY.nip}`}
            </address>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <li>
                <FLink href="/legal">
                  Legal hub
                  <ArrowUpRight size={13.5} weight="bold" aria-hidden />
                </FLink>
              </li>
              <li><FLink href={SIGN_UP_HREF}>Start for free</FLink></li>
              <li><FLink href={`mailto:${SUPPORT_EMAIL}`}>Contact</FLink></li>
            </ul>
          </Company>

          {FOOTER_COLUMNS.map((col) => (
            <Col key={col.title} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    <FLink href={link.href}>
                      {link.label}
                      {'external' in link && link.external ? <ArrowUpRight size={13.5} weight="bold" aria-hidden /> : null}
                    </FLink>
                  </li>
                ))}
              </ul>
            </Col>
          ))}

          <Legal>
            <div>
              {FOOTER_LEGAL.map((l) => <FLink key={l.href} href={l.href}>{l.label}</FLink>)}
            </div>
            <small>
              ©
              {' '}
              {new Date().getFullYear()}
              {' '}
              {SITE_NAME}
            </small>
          </Legal>
        </Grid>
      </Container>
    </Root>
  );
}

export default Footer;
