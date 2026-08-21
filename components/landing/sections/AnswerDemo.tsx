import React, { useState } from 'react';
import styled from '@emotion/styled';
import { AppleLogo, Globe, ShieldCheck, Sparkle, Sun, WifiHigh, X } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../primitives';

/* Figma 1:195 — 1440 column, px 27; heading at 180; controls +90; laptop at 643, 876 tall. */

const Demo = styled(Section)`
  overflow: hidden;
  padding-top: 180px;
  ${BP.md} {
    padding-top: 90px;
  }
`;

const Glow = styled.div`
  position: absolute;
  left: -600px;
  top: 72px;
  width: 1200px;
  height: 1200px;
  pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--koala-bg-brand) 10%, transparent), transparent 70%);
`;

const Heading = styled.h2`
  margin: 0;
  max-width: 990px;
  font-weight: ${fontWeight.medium};
  font-size: 45px;
  line-height: 47.26px;
  letter-spacing: -1.726px;
  color: ${semantic.text.primary};
  em {
    font-style: normal;
    color: var(--landing-green);
  }
  span {
    display: block;
    color: ${semantic.text.secondary};
  }
  ${BP.md} {
    font-size: 32px;
    line-height: 36px;
    letter-spacing: -1px;
  }
`;

/* Controls row — 94.5 tall; labels at top, pills at 31.5 (min-h 63). */
const Controls = styled.div`
  position: relative;
  margin-top: 90px;
  display: grid;
  grid-template-columns: 324px 72px 378px 72px 1fr;
  align-items: end;
  ${BP.lg} {
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    & > i {
      display: none;
    }
  }
  ${BP.md} {
    grid-template-columns: 1fr;
    margin-top: 45px;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
`;

const FieldLabel = styled.span`
  padding-left: 18px;
  font-size: 13.5px;
  line-height: 13.5px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${semantic.text.tertiary};
`;

const Pill = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14.6px;
  min-height: 63px;
  padding: 0 18px 0 23.6px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.primary};
  box-shadow: 0px 1px 2px rgba(0,0,0,0.04);
  font-size: 19.8px;
  line-height: 27px;
  letter-spacing: -0.352px;
  color: ${semantic.text.primary};
  white-space: nowrap;
  overflow: hidden;
  svg {
    flex-shrink: 0;
  }
  > span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ${BP.sm} {
    font-size: 16px;
  }
`;

const Placeholder = styled.span`
  color: ${semantic.input.placeholder};
`;

const TextCaret = styled.i`
  display: inline-block;
  width: 2px;
  height: 19.8px;
  margin-left: 2px;
  vertical-align: -3px;
  background: ${semantic.text.secondary};
`;

const Dash = styled.i`
  height: 63px;
  display: flex;
  align-items: center;
  &::before {
    content: '';
    width: 100%;
    border-top: 1.125px dashed ${semantic.border.secondary};
  }
`;

/* 36×18 toggle, 18px knob (Figma 1:2513). */
const Toggle = styled.label<{ $on: boolean }>`
  position: relative;
  width: 36px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 9999px;
  background: ${(p) => (p.$on ? 'var(--landing-green)' : semantic.border.secondary)};
  cursor: var(--koala-cursor-pointing);
  transition: background var(--motion-fast) var(--motion-ease-standard);
  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: inherit;
  }
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: ${(p) => (p.$on ? '18px' : '0')};
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 9999px;
    background: ${semantic.background.primary};
    border: 1px solid ${semantic.border.secondary};
    transition: left var(--motion-fast) var(--motion-ease-standard);
  }
  &:focus-within {
    box-shadow: var(--shadow-focus);
  }
`;

/* Connector from controls to laptop: 2×90 at x 1114. */
const Connector = styled.div`
  position: absolute;
  left: 1114px;
  top: 94.5px;
  width: 2px;
  height: 90px;
  background: linear-gradient(to bottom, ${semantic.border.secondary}, transparent);
  ${BP.lg} {
    display: none;
  }
`;

/* Laptop — 876.75 tall screen, radius 18, bezel drawn in CSS. */
const LaptopWrap = styled.div`
  position: relative;
  margin-top: 90px;
  ${BP.md} {
    margin-top: 45px;
  }
`;

const Bezel = styled.div`
  position: relative;
  margin: 0 auto;
  padding: 14px 14px 0;
  border-radius: 26px 26px 0 0;
  background: ${semantic.background.inverse};
  box-shadow: 0 30px 80px rgba(0,0,0,0.16);
`;

const Screen = styled.div`
  position: relative;
  height: 876.75px;
  overflow: hidden;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(180deg, #eaf4ff 0%, #bcdcff 38%, #d8ecff 70%, #f4f8fb 100%);
  ${BP.md} {
    height: 640px;
  }
  ${BP.sm} {
    height: 560px;
  }
`;

const Base = styled.div`
  height: 18px;
  margin: 0 -36px;
  border-radius: 0 0 18px 18px;
  background: linear-gradient(180deg, #e8e8ea, #cfcfd3);
  ${BP.md} {
    margin: 0 -12px;
  }
`;

const MenuBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 27px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4.5px 9px;
  box-sizing: border-box;
  background: rgba(0,0,0,0.84);
  color: rgba(255,255,255,0.92);
  font-size: 11.4px;
  line-height: 17px;
  letter-spacing: 0.229px;
  > div {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  b {
    font-weight: ${fontWeight.bold};
  }
  svg {
    margin: 0 9px;
  }
`;

/* Answer card — 504 wide, white/90, radius 27, p 54/36/36. */
const Card = styled.div`
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  width: min(504px, calc(100% - 36px));
  min-height: 540px;
  box-sizing: border-box;
  padding: 54px 36px 36px;
  display: flex;
  flex-direction: column;
  gap: 27px;
  border-radius: 27px;
  border: 1px solid ${semantic.background.primary};
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(22.5px);
  -webkit-backdrop-filter: blur(22.5px);
  box-shadow: 0px 9px 45px 0px rgba(0,0,0,0.35);
  color: ${semantic.text.primary};
  font-size: 15.8px;
  ${BP.sm} {
    padding: 45px 18px 18px;
    min-height: 0;
  }
`;

const Lights = styled.div`
  position: absolute;
  top: 18px;
  left: 27px;
  display: flex;
  gap: 4.5px;
  span {
    width: 9px;
    height: 9px;
    border-radius: 9999px;
  }
`;

const PromptRow = styled.div`
  display: flex;
  gap: 13.5px;
  padding: 15.75px 18px;
  border-radius: 13.5px;
  background: rgba(0,0,0,0.05);
  i {
    flex-shrink: 0;
    width: 27px;
    height: 27px;
    border-radius: 9999px;
    background: rgba(0,0,0,0.15);
  }
  b {
    display: block;
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.315px;
    line-height: 20.7px;
  }
  p {
    margin: 0;
    line-height: 24.84px;
  }
`;

const AnswerBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 27px;
  padding: 0 18px;
`;

const EngineRow = styled.div`
  display: flex;
  align-items: center;
  gap: 13.5px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.315px;
  line-height: 20.7px;
  i {
    width: 27px;
    height: 27px;
    border-radius: 9999px;
    background: rgba(0,0,0,0.05);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${semantic.text.brand};
  }
`;

const Lines = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0 0 0 9px;
  display: flex;
  flex-direction: column;
  gap: 13.5px;
`;

const LINE_FG = { neutral: 'inherit', bad: '#ff1d5d', good: 'var(--landing-green-ink)' } as const;
const LINE_BG = {
  neutral: 'rgba(0,0,0,0.15)',
  bad: 'rgba(255,29,93,0.15)',
  good: 'color-mix(in srgb, var(--landing-green) 18%, transparent)',
} as const;

const Line = styled.li<{ $state?: keyof typeof LINE_FG }>`
  display: flex;
  align-items: center;
  gap: 13.5px;
  line-height: 15.75px;
  font-weight: ${(p) => (p.$state && p.$state !== 'neutral' ? fontWeight.bold : fontWeight.regular)};
  color: ${(p) => LINE_FG[p.$state ?? 'neutral']};
  i {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${(p) => LINE_BG[p.$state ?? 'neutral']};
  }
`;

const Verdict = styled.p`
  margin: 0;
  padding: 0 36px 18px 9px;
  line-height: 27px;
  b {
    font-weight: ${fontWeight.bold};
  }
`;

const CardCta = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3.9px;
  min-height: 54px;
  padding: 0 18px;
  border-radius: 13.5px;
  background: ${semantic.background.inverse};
  color: ${semantic.text.onInverse};
  text-decoration: none;
  letter-spacing: -0.158px;
  line-height: 15.75px;
  b {
    font-weight: ${fontWeight.bold};
  }
  &:hover {
    filter: brightness(1.15);
  }
`;

const Fade = styled.div`
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1920px;
  height: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, ${semantic.background.primary} 77%);
`;

const PROMPT = 'best rank tracker with AI visibility for agencies';

export function AnswerDemo() {
  const [on, setOn] = useState(false);

  return (
    <Demo id="demo" aria-labelledby="demo-title">
      <Container style={{ position: 'relative' }}>
        <Glow aria-hidden />
        <Heading id="demo-title" data-reveal>
          Don&apos;t just rank.
          {' '}
          <em>Be the definitive answer.</em>
          <span>
            Ranksmile gives you the data and workflow to dominate traditional search and the new wave of AI
            engines like ChatGPT and Claude.
          </span>
        </Heading>

        <Controls data-reveal>
          <Field>
            <FieldLabel>Your site</FieldLabel>
            <Pill>
              <Globe size={27} weight="regular" aria-hidden />
              <Placeholder>TypeYourDomain.com</Placeholder>
            </Pill>
          </Field>
          <Dash aria-hidden />
          <Field>
            <FieldLabel>Ranksmile OS</FieldLabel>
            <Pill>
              <ShieldCheck
                size={27}
                weight={on ? 'fill' : 'regular'}
                color={on ? 'var(--landing-green)' : 'var(--koala-status-danger)'}
                aria-hidden
              />
              <span>{on ? 'Visible with Ranksmile' : 'Invisible without Ranksmile'}</span>
              <Toggle $on={on}>
                <input
                  type="checkbox"
                  name="demo-switch"
                  checked={on}
                  onChange={(e) => setOn(e.target.checked)}
                  aria-label="Toggle Ranksmile on the simulated AI answer"
                />
              </Toggle>
            </Pill>
          </Field>
          <Dash aria-hidden />
          <Field>
            <FieldLabel>User questions &amp; prompts</FieldLabel>
            <Pill>
              <Sparkle size={27} weight="fill" color="var(--koala-text-brand)" aria-hidden />
              <span>
                {PROMPT}
                <TextCaret aria-hidden />
              </span>
            </Pill>
          </Field>
          <Connector aria-hidden />
        </Controls>

        <LaptopWrap data-reveal data-state={on ? 'on' : 'off'}>
          <Bezel>
            <Screen>
              <MenuBar aria-hidden>
                <div>
                  <AppleLogo size={14} weight="fill" />
                  <b>AI Overviews</b>
                  <span>File</span>
                  <span>Edit</span>
                  <span>View</span>
                  <span>Window</span>
                  <span>Help</span>
                </div>
                <div>
                  <span>Fri, Aug 21 07:50:48</span>
                  <WifiHigh size={14} weight="bold" />
                  <Sun size={14} weight="fill" />
                </div>
              </MenuBar>

              <Card data-demo-card aria-live="polite">
                <Lights aria-hidden>
                  <span style={{ background: '#ff5f57' }} />
                  <span style={{ background: '#ffbd2e' }} />
                  <span style={{ background: '#28c840' }} />
                </Lights>
                <PromptRow>
                  <i aria-hidden />
                  <div>
                    <b>Zara Okafor</b>
                    <p>{PROMPT}</p>
                  </div>
                </PromptRow>
                <AnswerBody>
                  <EngineRow>
                    <i aria-hidden><Sparkle size={16} weight="fill" /></i>
                    AI Overviews
                  </EngineRow>
                  <Lines>
                    {on ? (
                      <>
                        <Line $state="good">
                          <i aria-hidden><ShieldCheck size={12} weight="bold" /></i>
                          yourdomain.com — mentioned as #1
                        </Line>
                        <Line><i aria-hidden />yourcompetitor.com — also mentioned</Line>
                        <Line><i aria-hidden />betteralternative.com — referenced</Line>
                        <Line $state="good">
                          <i aria-hidden><ShieldCheck size={12} weight="bold" /></i>
                          You are the answer
                        </Line>
                      </>
                    ) : (
                      <>
                        <Line><i aria-hidden />yourcompetitor.com — mentioned as #1</Line>
                        <Line><i aria-hidden />betteralternative.com — also mentioned</Line>
                        <Line><i aria-hidden />anotheroption.com — referenced</Line>
                        <Line $state="bad">
                          <i aria-hidden><X size={12} weight="bold" /></i>
                          You are not the answer
                        </Line>
                      </>
                    )}
                  </Lines>
                  <Verdict>
                    {on ? (
                      <>
                        Buyers ask AI first now.
                        <br />
                        <b>You are the answer</b>
                        {' '}
                        — Ranksmile found the gap, shipped the brief, and the engines picked it up.
                      </>
                    ) : (
                      <>
                        Buyers ask AI first now.
                        <br />
                        <b>You aren&apos;t the answer</b>
                        {' '}
                        - without Ranksmile, your brand stays invisible.
                      </>
                    )}
                  </Verdict>
                </AnswerBody>
                <CardCta href="/auth/sign-up">
                  <b>See if you&apos;re the answer</b>
                  <span>— 7-day free trial</span>
                </CardCta>
              </Card>
            </Screen>
            <Base aria-hidden />
          </Bezel>
          <Fade aria-hidden />
        </LaptopWrap>
      </Container>
    </Demo>
  );
}

export default AnswerDemo;
