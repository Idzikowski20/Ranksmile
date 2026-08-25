import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { ArrowLink, BP, Container, H2, Lead, Section } from '../primitives';
import { DATA_CARDS } from '../content';

/* Figma 1:3462 — pt 180 pb 90; grid 60fr/1fr → rendered as 2fr/1fr so the side cards stay legible. */

const Wrap = styled(Section)`
  padding: 180px 0 90px;
  ${BP.md} {
    padding: 90px 0 54px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7.9px;
  max-width: 810px;
  margin: 0 auto 90px;
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: 218.28px 218.28px auto;
  gap: 13.5px;
  ${BP.md} {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
`;

const Big = styled.a`
  grid-row: 1 / span 2;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 17px;
  min-height: 450px;
  padding: 36px 54px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 9px;
  border: 1px solid var(--landing-green);
  background: var(--landing-green);
  color: var(--landing-green-ink);
  text-decoration: none;
  ${BP.md} {
    grid-row: auto;
    padding: 27px;
    min-height: 360px;
  }
`;

const BigTop = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
`;

const Chart = styled.svg`
  position: absolute;
  left: -1%;
  right: -1%;
  top: 16.4%;
  width: 102%;
  height: 83%;
  pointer-events: none;
`;

const BigValue = styled.span`
  position: relative;
  margin-top: 128px;
  font-size: 198px;
  line-height: 158.43px;
  letter-spacing: -9.9px;
  font-weight: ${fontWeight.bold};
  ${BP.md} {
    margin-top: 60px;
    font-size: 120px;
    line-height: 100px;
    letter-spacing: -5px;
  }
`;

const BigCaption = styled.span`
  position: relative;
  font-size: 20.3px;
  line-height: 30.39px;
  font-weight: ${fontWeight.bold};
`;

const Side = styled.a`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 36px 54px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 9px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  color: ${semantic.text.primary};
  text-decoration: none;
  ${BP.lg} {
    padding: 27px;
  }
`;

const SideValue = styled.span`
  font-size: 126px;
  line-height: 100.82px;
  letter-spacing: -3.15px;
  font-weight: ${fontWeight.medium};
  ${BP.lg} {
    font-size: 72px;
    line-height: 72px;
    letter-spacing: -2px;
  }
`;

const SideRow = styled.span`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
  span:first-of-type {
    color: ${semantic.text.secondary};
  }
  ${BP.lg} {
    font-size: 15px;
  }
`;

const NoteRow = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 27px 0;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  p {
    margin: 0;
  }
  u,
  strong {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
    text-underline-position: from-font;
  }
  ${BP.md} {
    flex-direction: column;
    align-items: flex-start;
    padding: 0;
  }
`;

const QuoteGrid = styled(Grid)`
  margin-top: 90px;
  grid-template-rows: 540.08px auto;
  ${BP.md} {
    grid-template-rows: auto;
    margin-top: 45px;
  }
`;

const QuoteCard = styled.div<{ $size: 45 | 36 }>`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 540px;
  padding: 54px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 9px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  p {
    margin: 0;
    position: relative;
    font-size: ${(p) => p.$size}px;
    line-height: ${(p) => (p.$size === 45 ? '49.51px' : '39.61px')};
    color: ${semantic.text.secondary};
    text-wrap: pretty;
    strong {
      font-weight: ${fontWeight.regular};
      color: ${semantic.text.primary};
    }
  }
  ${BP.md} {
    min-height: 0;
    padding: 27px;
    p {
      font-size: 26px;
      line-height: 32px;
    }
  }
`;

/* Figma 1:3516 — the reference art, inset -19.74% top/bottom, from 40% across. */
const QuoteArt = styled.img`
  position: absolute;
  top: -19.74%;
  left: 40%;
  width: 60%;
  height: 139.5%;
  object-fit: cover;
  pointer-events: none;
  opacity: 0.9;
`;

const QuoteAuthor = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 27px;
  margin-top: 36px;
  img {
    width: 37.5px;
    height: 45px;
    object-fit: contain;
  }
  div {
    padding-left: 27px;
    border-left: 1px solid ${semantic.border.secondary};
  }
  b {
    display: block;
    font-size: 18px;
    line-height: 27px;
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
  }
  span {
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.secondary};
  }
`;

export function Data() {
  const { big, side, note, noteLink, quotes, footer, footerLink } = DATA_CARDS;
  return (
    <Wrap id="data" aria-labelledby="data-title">
      <Container>
        <Head data-reveal>
          <H2 id="data-title">The Data Speaks for Itself</H2>
          <Lead>
            Easy to use for both startups and the world&apos;s largest enterprises. When the rest of the industry
            catches up, you&apos;ll already be there.
          </Lead>
        </Head>

        <Grid>
          <Big href="#demo" data-reveal>
            <BigTop>
              <span>{big.topLeft}</span>
              <span>{big.topRight}</span>
            </BigTop>
            <Chart viewBox="0 0 880 380" preserveAspectRatio="none" aria-hidden>
              <polyline
                points="0,340 80,318 160,296 240,276 320,250 400,238 480,214 560,182 640,150 720,124 800,90 880,52"
                fill="none"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                data-chart-line
              />
            </Chart>
            <BigValue data-count={5} data-decimals={0} data-suffix="">{big.value}</BigValue>
            <BigCaption>{big.caption}</BigCaption>
          </Big>
          {side.map((s) => (
            <Side key={s.label} href="/plans" data-reveal>
              <SideValue>{s.value}</SideValue>
              <SideRow>
                <span>{s.label}</span>
                <span>{s.link}</span>
              </SideRow>
            </Side>
          ))}
          <NoteRow data-reveal>
            <p>
              {note.muted}
              <u>{note.strong}</u>
              {note.tail}
            </p>
            <ArrowLink href={noteLink.href}>
              <span>{noteLink.label}</span>
              <span>-&gt;</span>
            </ArrowLink>
          </NoteRow>
        </Grid>

        <QuoteGrid>
          <QuoteCard $size={45} data-reveal>
            <QuoteArt src="/landing/data-quote-bg.png" alt="" loading="lazy" aria-hidden />
            <p>
              {quotes[0].muted}
              <strong>{quotes[0].strong}</strong>
            </p>
            <QuoteAuthor>
              <img loading="lazy" decoding="async" src="/favicon.svg" alt="" />
              <div>
                <b>{quotes[0].name}</b>
                <span>{quotes[0].role}</span>
              </div>
            </QuoteAuthor>
          </QuoteCard>
          <QuoteCard $size={36} data-reveal>
            <p>
              {quotes[1].muted}
              <strong>{quotes[1].strong}</strong>
            </p>
            <QuoteAuthor>
              <img loading="lazy" decoding="async" src="/favicon.svg" alt="" />
              <div>
                <b>{quotes[1].name}</b>
                <span>{quotes[1].role}</span>
              </div>
            </QuoteAuthor>
          </QuoteCard>
          <NoteRow data-reveal>
            <p>
              {footer.muted}
              <strong>{footer.strong}</strong>
              {footer.tail}
            </p>
            <ArrowLink href={footerLink.href}>
              <span>{footerLink.label}</span>
              <span>-&gt;</span>
            </ArrowLink>
          </NoteRow>
        </QuoteGrid>
      </Container>
    </Wrap>
  );
}

export default Data;
