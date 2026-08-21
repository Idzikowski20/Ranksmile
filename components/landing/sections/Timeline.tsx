import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Eyebrow, H2, Lead, Section } from '../primitives';
import { TIMELINE } from '../content';

/* Figma 1:3304 — 900 tall; 17 vertical rules (gap 126); rail at 657; 3 labelled dots. */

const Wrap = styled(Section)`
  position: relative;
  overflow: hidden;
  height: 900px;
  ${BP.lg} {
    height: auto;
    padding: 90px 18px;
  }
`;

const Rules = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  gap: 126px;
  pointer-events: none;
  ${BP.lg} {
    display: none;
  }
`;

const Rule = styled.i<{ $tick: number; $active?: boolean }>`
  position: relative;
  width: 1px;
  height: 100%;
  background: linear-gradient(to bottom, transparent, ${semantic.border.primary} 12%, ${semantic.border.primary} 88%, transparent);
  &::after {
    content: '';
    position: absolute;
    left: 0;
    width: 1px;
    top: ${(p) => 657 - p.$tick}px;
    height: ${(p) => p.$tick}px;
    background: ${(p) => (p.$active ? semantic.text.primary : semantic.border.strong)};
  }
  &::before {
    content: '';
    position: absolute;
    left: 0;
    width: 1px;
    top: 693px;
    height: 15.75px;
    background: ${(p) => (p.$active ? semantic.text.primary : semantic.border.strong)};
  }
`;

const Head = styled.div`
  position: absolute;
  left: 50%;
  top: 180px;
  transform: translateX(-50%);
  width: min(810px, calc(100% - 36px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 17.1px;
  text-align: center;
  ${BP.lg} {
    position: static;
    transform: none;
    width: auto;
    margin: 0 auto 54px;
  }
`;

const Rail = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 657px;
  height: 2px;
  display: flex;
  justify-content: center;
  ${BP.lg} {
    display: none;
  }
`;

const RailFade = styled.i<{ $dir: 'left' | 'right' }>`
  width: 455.9px;
  height: 100%;
  background: ${(p) => (p.$dir === 'left'
    ? `linear-gradient(to right, transparent, ${semantic.border.secondary})`
    : `repeating-linear-gradient(to right, var(--koala-bg-brand) 0 12px, transparent 12px 24px)`)};
  mask-image: ${(p) => (p.$dir === 'right' ? 'linear-gradient(to right, black, transparent)' : 'none')};
  -webkit-mask-image: ${(p) => (p.$dir === 'right' ? 'linear-gradient(to right, black, transparent)' : 'none')};
`;

const RailLine = styled.div`
  position: relative;
  width: 1008.17px;
  height: 100%;
  background: ${semantic.background.brand};
  transform-origin: left;
`;

const DotMark = styled.i<{ $x: number }>`
  position: absolute;
  left: ${(p) => p.$x}px;
  top: 50%;
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  border-radius: 4.5px;
  border: 1px solid ${semantic.text.primary};
  background: ${semantic.background.primary};
`;

const Year = styled.span<{ $x: number; $vertical?: boolean }>`
  position: absolute;
  left: ${(p) => p.$x}px;
  bottom: ${(p) => (p.$vertical ? '27px' : '36px')};
  transform: translateX(-50%);
  font-size: 18px;
  line-height: ${(p) => (p.$vertical ? '22px' : '27px')};
  color: ${semantic.text.primary};
  writing-mode: ${(p) => (p.$vertical ? 'vertical-lr' : 'horizontal-tb')};
  text-orientation: upright;
  letter-spacing: ${(p) => (p.$vertical ? '2px' : '0')};
`;

const Notes = styled.div`
  position: absolute;
  left: 50%;
  top: 692px;
  transform: translateX(-50%);
  width: 1008.17px;
  ${BP.lg} {
    position: static;
    transform: none;
    width: auto;
    display: grid;
    gap: 27px;
  }
`;

const Note = styled.div<{ $x: number }>`
  position: absolute;
  left: ${(p) => p.$x}px;
  top: 0;
  width: 432px;
  transform: translateX(-50%);
  padding: 27px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 9px;
  text-align: center;
  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 21.6px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.secondary};
  }
  ${BP.lg} {
    position: static;
    transform: none;
    width: auto;
    padding: 18px;
    border: 1px solid ${semantic.border.primary};
    border-radius: 18px;
    text-align: left;
    h3::before {
      content: attr(data-year) ' · ';
      color: ${semantic.text.tertiary};
    }
  }
`;

const TICKS = [15.75, 15.75, 15.75, 27, 15.75, 30.24, 45.7, 62.77, 78.96, 97.87, 119.42, 147.25, 176.47, 217.04, 271.46];
const ACTIVE = new Set([3, 7, 11]);
const DOT_X = [0, 499.59, 1008.17];

export function Timeline() {
  return (
    <Wrap aria-labelledby="timeline-title">
      <Rules aria-hidden>
        {TICKS.map((t, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Rule key={i} $tick={t} $active={ACTIVE.has(i)} />
        ))}
      </Rules>

      <Head data-reveal>
        <Eyebrow $tone="brand">The Ranksmile advantage</Eyebrow>
        <H2 id="timeline-title" $size={55.2}>
          Built for the Way
          <br />
          Buyers Search Now
        </H2>
        <Lead>
          The internet changed twice. Rankings, then answers. Teams that track both in one loop don&apos;t just
          keep up — they lead. That&apos;s the streak Ranksmile is built to keep.
        </Lead>
      </Head>

      <Rail aria-hidden>
        <RailFade $dir="left" />
        <RailLine data-rail>
          {DOT_X.map((x, i) => (
            <React.Fragment key={x}>
              <DotMark $x={x} data-rail-dot />
              <Year $x={x} $vertical={i < 2}>{TIMELINE[i].year}</Year>
            </React.Fragment>
          ))}
        </RailLine>
        <RailFade $dir="right" />
      </Rail>

      <Notes>
        {TIMELINE.map((t, i) => (
          <Note key={t.year} $x={DOT_X[i]} data-reveal>
            <h3 data-year={t.year}>{t.title}</h3>
            <p>{t.body}</p>
          </Note>
        ))}
      </Notes>
    </Wrap>
  );
}

export default Timeline;
