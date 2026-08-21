import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Check } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, ArrowLink, Container, Section, Tag } from '../../landing/primitives';
import { PLANS, PRICING, PRICING_HREF, SIGN_UP_HREF } from '../content';

/*
 * Figma 3:4942 — head (tag · 55.2 H2) · top card 1386×456 (926fr / 611fr): title, price + billing
 * toggle + saving chip, prompt slider (50/100/200/∞), hint, full-width CTA | "Includes:" list ·
 * bottom grid 921 + 456: "Pro" (tinted, 2-col features) and "Peace of Mind" cards with taglines ·
 * footer row "Not sure yet?" + "Compare all plans". Plans/prices come from the billing source of truth.
 */

const Wrap = styled(Section)`
  padding: 180px 0 126px;
  ${BP.md} {
    padding: 72px 0 54px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  margin-bottom: 90px;
  text-align: center;
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    margin-bottom: 45px;
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
  }
`;

/* ── Top card ──────────────────────────────────────────────────────────────── */

const TopCard = styled.div`
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

const TopLeft = styled.div`
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
    line-height: 23.63px;
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
  .cur {
    margin-left: 5.4px;
  }
`;

const Billing = styled.label<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5.9px;
  font-size: 15.8px;
  line-height: 15.75px;
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  i {
    position: relative;
    width: 31.5px;
    height: 18px;
    border-radius: 18px;
    background: ${(p) => (p.$on ? 'var(--landing-blue)' : semantic.border.secondary)};
    transition: background var(--motion-fast) var(--motion-ease-standard);
    &::after {
      content: '';
      position: absolute;
      top: 2.25px;
      left: ${(p) => (p.$on ? '16.19px' : '2.25px')};
      width: 13.5px;
      height: 13.5px;
      border-radius: 6.75px;
      background: ${semantic.background.primary};
      transition: left var(--motion-fast) var(--motion-ease-standard);
    }
  }
  &:focus-within i {
    box-shadow: var(--shadow-focus);
  }
`;

const Saving = styled.span`
  margin-left: 3.6px;
  padding: 4.5px 11.25px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 9999px;
  font-size: 13.5px;
  line-height: 13.5px;
  color: ${semantic.text.primary};
`;

const Question = styled.p`
  margin: 0 0 13.5px;
  display: flex;
  align-items: center;
  gap: 6.74px;
  font-size: 18px;
  line-height: 27px;
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

const Stop = styled.button<{ $active: boolean }>`
  height: 43px;
  min-width: 43px;
  padding: 0 11.6px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.primary};
  font-family: inherit;
  font-size: 13.5px;
  line-height: 20.25px;
  font-weight: ${(p) => (p.$active ? fontWeight.bold : fontWeight.medium)};
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  box-shadow: ${(p) => (p.$active ? '0 2px 8px rgba(0,0,0,0.12)' : 'none')};
  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  &.inf {
    font-size: 25.2px;
    line-height: 37.81px;
    font-weight: ${fontWeight.bold};
  }
`;

const Hint = styled.p`
  margin: 0;
  padding: 13.5px 0 36px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.secondary};
  }
`;

const WideCta = styled.a`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
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
  &:hover {
    background: ${semantic.button.brand.bgHover};
  }
  ${BP.sm} {
    flex-direction: column;
    text-align: center;
  }
`;

const TopRight = styled.div`
  padding: 76.5px 36px 36px;
  border-left: 1px solid rgba(0,0,0,0.05);
  background: rgba(255,255,255,0.4);
  display: flex;
  flex-direction: column;
  gap: 13.5px;
  h4 {
    margin: 0;
    font-size: 15.8px;
    line-height: 23.63px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.lg} {
    border-left: 0;
    border-top: 1px solid rgba(0,0,0,0.05);
    padding-top: 36px;
  }
`;

const Feature = styled.div<{ $excluded?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${(p) => (p.$excluded ? semantic.text.tertiary : semantic.text.primary)};
  text-decoration: ${(p) => (p.$excluded ? 'line-through' : 'none')};
  svg {
    flex-shrink: 0;
    margin-top: 3.9px;
    color: ${(p) => (p.$excluded ? semantic.text.tertiary : 'var(--landing-blue)')};
  }
`;

const Engines = styled.span`
  display: inline-flex;
  margin-left: 9px;
  vertical-align: middle;
  img,
  i {
    width: 27px;
    height: 27px;
    margin-right: -4px;
    box-sizing: border-box;
    padding: 2.25px;
    border-radius: 9999px;
    border: 1px solid ${semantic.border.secondary};
    background: ${semantic.background.primary};
    object-fit: contain;
  }
`;

/* ── Bottom grid ───────────────────────────────────────────────────────────── */

const Bottom = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 921fr) minmax(0, 456fr);
  gap: 45px 9px;
  margin-top: 90px;
  ${BP.lg} {
    grid-template-columns: 1fr;
  }
  ${BP.md} {
    margin-top: 45px;
  }
`;

const PlanCard = styled.article<{ $tint?: boolean }>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 13.5px;
  border: 1px solid ${semantic.border.primary};
  background: ${(p) => (p.$tint ? 'color-mix(in srgb, var(--landing-blue) 8%, var(--koala-bg-primary))' : semantic.background.primary)};
`;

const PlanBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 45px;
  padding: 36px 36px 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.6), transparent);
`;

const PlanHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  h3 {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  .desc {
    margin: 0;
    max-width: 393px;
    min-height: 65px;
    padding: 8px 0 18px;
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.secondary};
  }
`;

const PlanCta = styled.a<{ $inverse?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13.5px 27px;
  border-radius: 13.5px;
  background: ${(p) => (p.$inverse ? semantic.background.inverse : semantic.button.brand.bg)};
  color: ${(p) => (p.$inverse ? semantic.text.onInverse : semantic.button.brand.fg)};
  text-decoration: none;
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  box-shadow: inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25);
  &:hover {
    filter: brightness(0.95);
  }
`;

const Features = styled.div<{ $cols: 1 | 2 }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, minmax(0, 1fr));
  gap: 18px;
  padding: 36px 36px 45px;
  border-top: 1px solid rgba(0,0,0,0.05);
  ${BP.sm} {
    grid-template-columns: 1fr;
  }
`;

const Tagline = styled.div`
  margin-top: auto;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(0,0,0,0.05);
  background: ${semantic.background.secondary};
  font-size: 15.8px;
  color: ${semantic.text.secondary};
`;

const Foot = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 28px;
  border-top: 1px solid ${semantic.border.primary};
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

const ENGINE_ICONS = [
  '/ai-tracking/engine-chatgpt.svg',
  '/ai-tracking/engine-perplexity.svg',
  '/ai-tracking/engine-google.png',
  '/ai-tracking/engine-aioverview.svg',
  '/ai-tracking/engine-gemini.png',
];

/* Slider stops map to the daily-prompt allowance of each sellable plan. */
const STOPS = PLANS.map((p) => {
  const prompts = p.cardBenefits.find((b) => b.label.startsWith('AI Prompts'))?.value ?? '';
  return { slug: p.slug, label: prompts.replace(/\D/g, '') || prompts };
});

export function AiPricing() {
  const [yearly, setYearly] = useState(true);
  const [stop, setStop] = useState(0);
  const plan = PLANS[stop];
  const price = yearly ? plan.priceYearly : plan.priceMonthly;
  const saving = (plan.priceMonthly - plan.priceYearly) * 12;
  const pct = [20.6, 55, 100][stop];
  const [pro, peace] = [PLANS[1], PLANS[2]];

  return (
    <Wrap id="pricing" aria-labelledby="ai-pricing-title">
      <Container>
        <Head data-reveal>
          <Tag>{PRICING.eyebrow}</Tag>
          <h2 id="ai-pricing-title">
            {PRICING.titleLines[0]}
            <br />
            {PRICING.titleLines[1]}
          </h2>
        </Head>

        <TopCard data-reveal>
          <TopLeft>
            <h3>{PRICING.top.title}</h3>
            <p className="sub">{PRICING.top.sub}</p>
            <PriceRow>
              <span>
                {price}
                <span className="cur">EUR</span>
                <span className="muted">per month</span>
              </span>
              <Billing $on={yearly}>
                <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
                <i aria-hidden />
                Billed yearly
                {yearly ? <Saving>{`Saving €${saving}`}</Saving> : null}
              </Billing>
            </PriceRow>
            <Question>
              {PRICING.top.question}
              <i title="A prompt is one tracked question sent to every engine daily">?</i>
            </Question>
            <Slider role="radiogroup" aria-label="Daily prompts">
              <Fill $pct={pct} />
              <Stops>
                {STOPS.map((s, i) => (
                  <Stop
                    key={s.slug}
                    type="button"
                    role="radio"
                    aria-checked={stop === i}
                    $active={stop === i}
                    onClick={() => setStop(i)}
                  >
                    {s.label}
                  </Stop>
                ))}
                <Stop type="button" className="inf" $active={false} onClick={() => setStop(PLANS.length - 1)} aria-label="Custom volume">
                  ∞
                </Stop>
              </Stops>
            </Slider>
            <Hint>
              {PRICING.top.hint.strong}
              <span>{PRICING.top.hint.muted}</span>
            </Hint>
            <WideCta href={`${SIGN_UP_HREF}?plan=${plan.slug}&billing=${yearly ? 'yearly' : 'monthly'}`}>
              {`Start ${plan.name} for €${price}/mo${yearly ? ', billed yearly' : ''}`}
              <span>{PRICING.top.ctaMuted}</span>
            </WideCta>
          </TopLeft>
          <TopRight>
            <h4>{PRICING.top.includes}</h4>
            {plan.cardBenefits.map((b) => (
              <Feature key={b.label} $excluded={b.state === 'excluded'}>
                <Check size={15.75} weight="bold" aria-hidden />
                <span>
                  {b.value ? `${b.label}: ${b.value}` : b.label}
                  {b.label.startsWith('AI Visibility engines') || b.label.startsWith('AI Prompts (all') ? (
                    <Engines aria-hidden>
                      {ENGINE_ICONS.map((src) => <img key={src} src={src} alt="" />)}
                    </Engines>
                  ) : null}
                </span>
              </Feature>
            ))}
          </TopRight>
        </TopCard>

        <Bottom>
          <PlanCard $tint data-reveal>
            <PlanBody>
              <PlanHead>
                <h3>{pro.name}</h3>
                <PriceRow style={{ marginBottom: 0 }}>
                  <span>
                    {yearly ? pro.priceYearly : pro.priceMonthly}
                    <span className="cur">EUR</span>
                    <span className="muted">per month</span>
                  </span>
                </PriceRow>
                <Billing $on={yearly}>
                  <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
                  <i aria-hidden />
                  Billed yearly
                  {yearly ? <Saving>{`Saving €${(pro.priceMonthly - pro.priceYearly) * 12}`}</Saving> : null}
                </Billing>
                <p className="desc">{pro.desc}</p>
              </PlanHead>
              <PlanCta href={`${SIGN_UP_HREF}?plan=${pro.slug}&billing=${yearly ? 'yearly' : 'monthly'}`}>Start for Free</PlanCta>
            </PlanBody>
            <Features $cols={2}>
              {pro.cardBenefits.map((b) => (
                <Feature key={b.label} $excluded={b.state === 'excluded'}>
                  <Check size={15.75} weight="bold" aria-hidden />
                  <span>{b.value ? `${b.label}: ${b.value}` : b.label}</span>
                </Feature>
              ))}
            </Features>
            <Tagline>{PRICING.proTagline}</Tagline>
          </PlanCard>

          <PlanCard data-reveal>
            <PlanBody>
              <PlanHead>
                <h3>{peace.name}</h3>
                <PriceRow style={{ marginBottom: 0 }}>
                  <span>
                    {yearly ? peace.priceYearly : peace.priceMonthly}
                    <span className="cur">EUR</span>
                    <span className="muted">per month</span>
                  </span>
                </PriceRow>
                <Billing $on={yearly}>
                  <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
                  <i aria-hidden />
                  Billed yearly
                  {yearly ? <Saving>{`Saving €${(peace.priceMonthly - peace.priceYearly) * 12}`}</Saving> : null}
                </Billing>
                <p className="desc">{peace.desc}</p>
              </PlanHead>
              <PlanCta $inverse href={`${SIGN_UP_HREF}?plan=${peace.slug}&billing=${yearly ? 'yearly' : 'monthly'}`}>Start for Free</PlanCta>
            </PlanBody>
            <Features $cols={1}>
              <Feature>
                <Check size={15.75} weight="bold" aria-hidden />
                <span><b style={{ fontWeight: 700 }}>{`Everything in ${pro.name}, plus:`}</b></span>
              </Feature>
              {peace.cardBenefits.map((b) => (
                <Feature key={b.label} $excluded={b.state === 'excluded'}>
                  <Check size={15.75} weight="bold" aria-hidden />
                  <span>{b.value ? `${b.label}: ${b.value}` : b.label}</span>
                </Feature>
              ))}
            </Features>
            <Tagline>{PRICING.peaceTagline}</Tagline>
          </PlanCard>

          <Foot data-reveal>
            <span>
              <b>{PRICING.footer.strong}</b>
              {PRICING.footer.muted}
            </span>
            <ArrowLink href={PRICING_HREF}>
              <span>{PRICING.footer.link}</span>
              <span>→</span>
            </ArrowLink>
          </Foot>
        </Bottom>
      </Container>
    </Wrap>
  );
}

export default AiPricing;
