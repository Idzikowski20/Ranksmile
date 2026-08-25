import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Check } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { ANALYTICS, SIGN_UP_HREF } from '../content';

/* Figma 5:3223 — AI Search Analytics tab: eyebrow + sub, then a 926/611 card (price · billing · slider · CTA | Includes). */

const Wrap = styled(Section)`
  padding: 45px 0 90px;
  ${BP.md} {
    padding: 27px 0 54px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 36px;
  text-align: center;
  p.eyebrow {
    margin: 0;
    font-size: 15.8px;
    font-weight: ${fontWeight.bold};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  p.sub {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.secondary};
  }
`;

const Card = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 926fr) minmax(0, 611fr);
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 13.5px;
  background:
    radial-gradient(${semantic.border.secondary} 1px, transparent 1px) 0 0 / 18px 18px,
    ${semantic.background.primary};
  ${BP.lg} {
    grid-template-columns: 1fr;
  }
`;

const Left = styled.div`
  padding: 36px;
  display: flex;
  flex-direction: column;
  h3 {
    margin: 0 0 9px;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  .sub {
    margin: 0 0 13.5px;
    font-size: 15.8px;
    color: ${semantic.text.secondary};
  }
`;

const PriceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 13.5px;
  margin-bottom: 36px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  .muted {
    color: ${semantic.text.secondary};
    margin-left: 5.4px;
  }
`;

const Billing = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5.9px;
  font-size: 15.8px;
  i {
    width: 31.5px;
    height: 18px;
    border-radius: 18px;
    background: var(--landing-blue);
    position: relative;
    &::after {
      content: '';
      position: absolute;
      top: 2.25px;
      left: 16.19px;
      width: 13.5px;
      height: 13.5px;
      border-radius: 6.75px;
      background: #fff;
    }
  }
`;

const Saving = styled.span`
  margin-left: 3.6px;
  padding: 4.5px 11.25px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 9999px;
  font-size: 13.5px;
`;

const Question = styled.p`
  margin: 0 0 13.5px;
  display: flex;
  align-items: center;
  gap: 6.74px;
  font-size: 18px;
  color: ${semantic.text.primary};
  i {
    width: 20.25px;
    height: 20.25px;
    border: 1px solid rgba(0,0,0,0.36);
    border-radius: 10.13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12.4px;
    font-style: normal;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.secondary};
  }
`;

const Slider = styled.div`
  position: relative;
  height: 54px;
  padding: 2.25px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.secondary};
`;

const Fill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  border-radius: 9999px;
  background: var(--landing-blue);
  transition: width var(--motion-normal) var(--motion-ease-standard);
`;

const Stops = styled.div`
  position: absolute;
  inset: 1.85px 0.13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4.5px;
`;

const Stop = styled.button<{ $active: boolean; $inf?: boolean }>`
  height: 43px;
  min-width: 43px;
  padding: 0 11.6px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.primary};
  font-family: inherit;
  font-size: ${(p) => (p.$inf ? '25.2px' : '13.5px')};
  line-height: ${(p) => (p.$inf ? '37.81px' : '20.25px')};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  box-shadow: ${(p) => (p.$active ? '0 2px 8px rgba(0,0,0,0.12)' : 'none')};
  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
`;

const Hint = styled.p`
  margin: 0;
  padding: 13.5px 0 36px;
  font-size: 15.8px;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.secondary};
  }
`;

const Cta = styled.a`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13.5px 27px;
  border-radius: 13.5px;
  background: ${semantic.button.brand.bg};
  color: ${semantic.button.brand.fg};
  text-decoration: none;
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  box-shadow: inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25);
  span {
    font-weight: ${fontWeight.regular};
    opacity: 0.6;
  }
  ${BP.sm} {
    flex-direction: column;
    text-align: center;
  }
`;

const Right = styled.div`
  padding: 76.5px 36px 36px;
  border-left: 1px solid rgba(0,0,0,0.05);
  background: rgba(255,255,255,0.4);
  display: flex;
  flex-direction: column;
  gap: 13.5px;
  h4 {
    margin: 0;
    font-size: 15.8px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.lg} {
    border-left: 0;
    border-top: 1px solid rgba(0,0,0,0.05);
    padding-top: 36px;
  }
`;

const Feat = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.primary};
  svg {
    flex-shrink: 0;
    margin-top: 3.9px;
    color: var(--landing-blue);
  }
`;

export function PrAnalytics() {
  const [stop, setStop] = useState(1);
  const pct = [20.6, 55, 100, 100][stop];
  return (
    <Wrap aria-label="AI Search Analytics">
      <Container>
        <Head data-reveal>
          <p className="eyebrow">{ANALYTICS.eyebrow}</p>
          <p className="sub">{ANALYTICS.sub}</p>
        </Head>
        <Card data-reveal>
          <Left>
            <h3>{ANALYTICS.title}</h3>
            <p className="sub">{ANALYTICS.desc}</p>
            <PriceRow>
              <span>
                {`${ANALYTICS.price} USD`}
                <span className="muted">per month</span>
              </span>
              <Billing>
                <i aria-hidden />
                Billed yearly
                <Saving>{`Saving $${ANALYTICS.yearlySaving}`}</Saving>
              </Billing>
            </PriceRow>
            <Question>
              {ANALYTICS.question}
              <i title="One tracked question sent to every engine daily">?</i>
            </Question>
            <Slider role="radiogroup" aria-label="Daily prompts">
              <Fill $pct={pct} />
              <Stops>
                {ANALYTICS.stops.map((s, i) => (
                  <Stop
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={stop === i}
                    $active={stop === i}
                    $inf={s === '∞'}
                    onClick={() => setStop(i)}
                  >
                    {s}
                  </Stop>
                ))}
              </Stops>
            </Slider>
            <Hint>
              {ANALYTICS.hint.strong}
              <span>{ANALYTICS.hint.muted}</span>
            </Hint>
            <Cta href={`${SIGN_UP_HREF}?plan=analytics`}>
              {`Start for $${ANALYTICS.price}/mo, billed yearly`}
              <span>{ANALYTICS.ctaMuted}</span>
            </Cta>
          </Left>
          <Right>
            <h4>{ANALYTICS.includes}</h4>
            {ANALYTICS.items.map((f) => (
              <Feat key={f}>
                <Check size={15.75} weight="bold" aria-hidden />
                <span>{f}</span>
              </Feat>
            ))}
          </Right>
        </Card>
      </Container>
    </Wrap>
  );
}

export default PrAnalytics;
