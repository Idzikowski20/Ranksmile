import React, { useState } from 'react';
import styled from '@emotion/styled';
import { Globe, Sparkle, CheckCircle, MinusCircle } from '@phosphor-icons/react';
import { Switch } from '../../koala/core/switch/switch';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, H2, Panel, Section } from '../primitives';

const Head = styled.div`
  max-width: 760px;
  margin-bottom: 40px;
`;

const Title = styled(H2)`
  span {
    color: ${semantic.text.brand};
  }
`;

const Sub = styled.p`
  margin: 16px 0 0;
  font-family: ${typeface.body};
  font-size: clamp(18px, 2.2vw, 26px);
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: ${semantic.text.tertiary};
  text-wrap: pretty;
`;

const Controls = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  margin-bottom: 20px;
  ${media.md} {
    grid-template-columns: 1fr 1fr 1.4fr;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.span`
  font-family: ${typeface.body};
  font-size: ${textScale.xs.fontSize};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${semantic.text.tertiary};
`;

const Pill = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.full};
  background: ${semantic.background.primary};
  font-family: ${typeface.body};
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  box-shadow: ${shadow.xs};
  svg {
    flex-shrink: 0;
    color: ${semantic.text.secondary};
  }
  label {
    flex: 1;
    cursor: var(--koala-cursor-pointing);
  }
`;

const Frame = styled(Panel)`
  overflow: hidden;
  font-family: ${typeface.body};
`;

const FrameBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.secondary};
`;

const Answer = styled.div`
  padding: 24px 20px 28px;
  ${media.md} {
    padding: 32px 32px 36px;
  }
`;

const Prompt = styled.p`
  margin: 0 0 20px;
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const AnswerText = styled.p`
  margin: 0 0 16px;
  max-width: 720px;
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  color: ${semantic.text.secondary};
`;

const Sources = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
`;

/* Your domain jumps to the top when Ranksmile is on, sinks to the bottom when off. */
function sourceOrder(p: { $you?: boolean; $on: boolean }): number {
  if (!p.$you) return 1;
  return p.$on ? 0 : 9;
}

const Source = styled.li<{ $you?: boolean; $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 14px;
  border: 1px solid ${(p) => (p.$you && p.$on ? semantic.border.brand : semantic.border.primary)};
  border-radius: ${radius.card.sm};
  background: ${(p) => (p.$you && p.$on ? 'color-mix(in srgb, var(--koala-bg-brand) 6%, var(--koala-bg-primary))' : semantic.background.primary)};
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.primary};
  opacity: ${(p) => (p.$you && !p.$on ? 0.55 : 1)};
  order: ${(p) => sourceOrder(p)};
  transition:
    border-color var(--motion-normal) var(--motion-ease-standard),
    background var(--motion-normal) var(--motion-ease-standard),
    opacity var(--motion-normal) var(--motion-ease-standard),
    transform var(--motion-slow) var(--motion-ease-out);
  svg {
    flex-shrink: 0;
  }
  b {
    font-weight: ${fontWeight.medium};
  }
  small {
    margin-left: auto;
    font-size: ${textScale.xs.fontSize};
    color: ${semantic.text.tertiary};
    white-space: nowrap;
  }
`;

const Rank = styled.span`
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${semantic.background.secondary};
  font-size: ${textScale.xs.fontSize};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
`;

const COMPETITORS = [
  { name: 'northwind.com', note: 'cited in 4 of 5 engines' },
  { name: 'contoso.io', note: 'cited in 3 of 5 engines' },
  { name: 'fabrikam.co', note: 'cited in 2 of 5 engines' },
];

export function AnswerDemo() {
  const [on, setOn] = useState(false);

  return (
    <Section id="demo" $tone="secondary" aria-labelledby="demo-title">
      <Container>
        <Head data-reveal>
          <Title id="demo-title">
            Don&apos;t just rank.
            {' '}
            <span>Be the definitive answer.</span>
          </Title>
          <Sub>
            Ranksmile gives you the data and workflow to dominate traditional search and the new wave of AI engines
            like ChatGPT and Claude.
          </Sub>
        </Head>

        <Controls data-reveal>
          <Field>
            <FieldLabel>Your site</FieldLabel>
            <Pill>
              <Globe size={18} weight="bold" aria-hidden />
              yourdomain.com
            </Pill>
          </Field>
          <Field>
            <FieldLabel>Ranksmile</FieldLabel>
            <Pill>
              {on
                ? <CheckCircle size={18} weight="fill" color="var(--koala-status-success)" aria-hidden />
                : <MinusCircle size={18} weight="fill" color="var(--koala-status-danger)" aria-hidden />}
              <label htmlFor="demo-switch">{on ? 'Cited with Ranksmile' : 'Invisible without Ranksmile'}</label>
              <Switch
                size="sm"
                checked={on}
                onChange={setOn}
                name="demo-switch"
                aria-label="Toggle Ranksmile on the demo answer"
              />
            </Pill>
          </Field>
          <Field>
            <FieldLabel>User questions &amp; prompts</FieldLabel>
            <Pill>
              <Sparkle size={18} weight="fill" aria-hidden />
              best rank tracker with AI visibility for agencies
            </Pill>
          </Field>
        </Controls>

        <Frame data-reveal data-state={on ? 'on' : 'off'} aria-live="polite">
          <FrameBar>
            <Sparkle size={16} weight="fill" aria-hidden />
            AI answer · simulated
          </FrameBar>
          <Answer>
            <Prompt>“What is the best rank tracker with AI visibility for agencies?”</Prompt>
            <AnswerText>
              {on
                ? 'For agencies that need rankings and AI citations in one place, the most frequently cited option is '
                  + 'yourdomain.com, followed by Northwind and Contoso. It combines daily rank tracking, a live Content Score '
                  + 'and visibility tracking across five AI engines.'
                : 'Agencies looking for rank tracking with AI visibility most often consider Northwind, Contoso and Fabrikam. '
                  + 'Each covers daily rank tracking; Northwind adds citation monitoring across several AI engines.'}
            </AnswerText>
            <Sources aria-label="Sources named in the answer">
              <Source $you $on={on}>
                <Rank>{on ? 1 : '—'}</Rank>
                <b>yourdomain.com</b>
                <small>{on ? 'cited in 5 of 5 engines' : 'not mentioned'}</small>
              </Source>
              {COMPETITORS.map((c, i) => (
                <Source key={c.name} $on={on}>
                  <Rank>{on ? i + 2 : i + 1}</Rank>
                  {c.name}
                  <small>{c.note}</small>
                </Source>
              ))}
            </Sources>
          </Answer>
        </Frame>
      </Container>
    </Section>
  );
}

export default AnswerDemo;
