import React, { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { ArrowRight, Cursor, Quotes } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Eyebrow, Section } from '../primitives';
import { UPDATES, WORKFLOW, WORKFLOW_QUOTES, type WorkflowStep } from '../content';

/* Figma 1:3084 — outer 1440 frame (bg-secondary, p 4.5, radius 27) → inner radius 22.5. */

const TONE: Record<WorkflowStep['tone'], string> = {
  brand: 'var(--koala-bg-brand)',
  green: 'var(--landing-green)',
  blue: 'var(--landing-blue)',
};

const Wrap = styled(Section)`
  padding-bottom: 126px;
  ${BP.md} {
    padding-bottom: 54px;
  }
`;

const Outer = styled.div`
  padding: 4.5px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 27px;
  background: ${semantic.background.secondary};
`;

const Inner = styled.div`
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 22.5px;
  background: ${semantic.background.primary};
`;

const Head = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 17px;
  padding: 89px 27px 90px;
  border-bottom: 1px solid ${semantic.border.primary};
  text-align: center;
  h2 {
    margin: 0;
    font-size: 44.5px;
    line-height: 53.41px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 54px 18px;
    h2 {
      font-size: 32px;
      line-height: 38px;
    }
  }
`;

const Lights = styled.div`
  position: absolute;
  top: 18px;
  left: 18px;
  display: flex;
  gap: 4.5px;
  span {
    width: 9px;
    height: 9px;
    border-radius: 9999px;
    background: ${semantic.border.primary};
  }
`;

/* One step: 900 tall; left column 713.62 (pl 54), right panel from 713.6. */
const Step = styled.article`
  position: relative;
  display: grid;
  grid-template-columns: 713.62fr 726.38fr;
  min-height: 900px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    min-height: 0;
  }
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  padding-left: 54px;
  ${BP.md} {
    padding-left: 0;
  }
`;

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 26.48px;
  padding: 100.47px 22.5px 101.47px 27px;
  border-left: 1px solid ${semantic.background.secondary};
  border-bottom: 1px solid ${semantic.background.secondary};
  ${BP.md} {
    padding: 54px 18px;
  }
`;

const StepTag = styled.p<{ $color: string }>`
  margin: 0;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  text-transform: uppercase;
  color: ${(p) => p.$color};
`;

const StepTitle = styled.h3`
  margin: 0;
  font-size: 28.8px;
  line-height: 35.99px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.secondary};
  }
  ${BP.md} {
    font-size: 24px;
    line-height: 30px;
  }
`;

const Item = styled.div<{ $open: boolean; $color: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: ${(p) => (p.$open ? '36px 144px 36px 27px' : '27px 144px 27px 27px')};
  border-left: 1px solid ${semantic.background.secondary};
  border-bottom: 1px solid ${semantic.background.secondary};
  background: ${(p) => (p.$open ? 'var(--koala-bg-tertiary)' : semantic.background.primary)};
  transition: background var(--motion-fast) var(--motion-ease-standard);
  &::before {
    content: '';
    position: absolute;
    left: -1.5px;
    top: 0;
    bottom: 36px;
    width: 1.5px;
    background: ${(p) => p.$color};
    opacity: ${(p) => (p.$open ? 1 : 0)};
    transition: opacity var(--motion-fast) var(--motion-ease-standard);
  }
  ${BP.md} {
    padding-right: 18px;
    padding-left: 18px;
  }
`;

const ItemButton = styled.button`
  all: unset;
  display: block;
  width: 100%;
  cursor: var(--koala-cursor-pointing);
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  &:focus-visible {
    outline: 2px solid ${semantic.border.focus};
    outline-offset: 4px;
    border-radius: 6px;
  }
`;

const ItemBody = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${(p) => (p.$open ? '1fr' : '0fr')};
  transition: grid-template-rows var(--motion-normal) var(--motion-ease-standard);
  > div {
    overflow: hidden;
  }
  p {
    margin: 0;
    padding-right: 17px;
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.secondary};
  }
`;

const Panel = styled.div<{ $color: string }>`
  position: relative;
  overflow: hidden;
  border-left: 1px solid ${semantic.border.primary};
  background: ${(p) => p.$color};
  background-image: radial-gradient(ellipse 55% 45% at 50% 50%, rgba(0,0,0,0.12), transparent 70%);
  ${BP.lg} {
    min-height: 520px;
  }
`;

/* Figma 1:3124 — the reference card art fills the panel (h 100%, w 100.92%). */
const PanelImg = styled.img`
  position: absolute;
  inset: 0 0 0 calc(0.14% - 1px);
  width: 100.92%;
  height: 100%;
  object-fit: cover;
  object-position: left top;
`;

/* Quote band — 591.94 tall, content at left 81. */
const Band = styled.div`
  position: relative;
  min-height: 591.94px;
  padding: 160px 81px;
  box-sizing: border-box;
  border-top: 1px solid ${semantic.border.primary};
  border-bottom: 1px solid ${semantic.border.primary};
  background-image: radial-gradient(ellipse 40% 50% at 80% 50%, color-mix(in srgb, ${semantic.border.secondary} 40%, transparent), transparent 70%);
  svg {
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    min-height: 0;
    padding: 54px 18px;
  }
`;

const BandQuote = styled.p`
  margin: 27px 0 0;
  max-width: 810px;
  font-size: 27px;
  line-height: 33.76px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
  text-wrap: pretty;
  ${BP.md} {
    font-size: 21px;
    line-height: 28px;
  }
`;

const BandAuthor = styled.p`
  margin: 36px 0 0;
  display: flex;
  gap: 13.49px;
  font-size: 18px;
  line-height: 27px;
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  span {
    color: ${semantic.text.secondary};
  }
`;

/* Updates — border-t, px 81 py 126, 4 columns of 248.8 with gap 90. */
const Updates = styled.div`
  position: relative;
  padding: 126px 81px;
  border-top: 1px solid ${semantic.border.primary};
  display: flex;
  flex-direction: column;
  gap: 90px;
  ${BP.md} {
    padding: 54px 18px;
    gap: 45px;
  }
`;

const UpdatesHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 27px;
  h2 {
    margin: 22.5px 0 0;
    font-size: 35.8px;
    line-height: 42.93px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 6.75px;
    font-size: 16.9px;
    letter-spacing: -0.174px;
    color: ${semantic.text.secondary};
    text-decoration: none;
    white-space: nowrap;
    svg {
      color: ${semantic.text.primary};
    }
  }
  ${BP.md} {
    h2 {
      font-size: 28px;
      line-height: 34px;
    }
  }
`;

const UpdateList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 248.8px));
  gap: 90px;
  ${BP.lg} {
    grid-template-columns: repeat(2, 1fr);
    gap: 45px;
  }
  ${BP.sm} {
    grid-template-columns: 1fr;
  }
`;

const Update = styled.li`
  display: flex;
  flex-direction: column;
  gap: 16.76px;
  p {
    margin: 0;
    display: flex;
    gap: 4.5px;
    font-size: 13.5px;
    line-height: 18.9px;
    text-transform: uppercase;
    color: ${semantic.text.primary};
    span {
      color: ${semantic.text.tertiary};
    }
  }
  h3 {
    margin: 0;
    font-size: 19.8px;
    line-height: 23.76px;
    letter-spacing: -0.204px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

const CursorTag = styled.div<{ $x: string; $y: string; $flip?: boolean }>`
  position: absolute;
  left: ${(p) => p.$x};
  top: ${(p) => p.$y};
  pointer-events: none;
  svg {
    width: 52.2px;
    height: 52.2px;
    color: ${semantic.text.primary};
    transform: ${(p) => (p.$flip ? 'scaleX(-1)' : 'none')};
  }
  span {
    position: absolute;
    top: 36.54px;
    ${(p) => (p.$flip ? 'right: 31px;' : 'left: 36.54px;')}
    padding: 12.9px 20.36px 13.37px;
    border-radius: 11.7px;
    background: ${semantic.background.inverse};
    color: ${semantic.text.onInverse};
    font-size: 27.1px;
    line-height: 27.14px;
    font-weight: ${fontWeight.bold};
    white-space: nowrap;
  }
  ${BP.lg} {
    display: none;
  }
`;

/* Three reference cards per step — the open accordion item picks which one shows. */
const STEP_IMAGES: Record<string, string[]> = {
  diagnose: ['/landing/loop-card-01.png', '/landing/loop-card-02.png', '/landing/loop-card-03.png'],
  fix: ['/landing/loop-card-04.png', '/landing/loop-card-05.png', '/landing/loop-card-06.png'],
  monitor: ['/landing/loop-card-07.png', '/landing/loop-card-08.png', '/landing/loop-card-09.png'],
};

function StepBlock({ step }: { step: WorkflowStep }) {
  const [open, setOpen] = useState(0);
  const images = STEP_IMAGES[step.id];
  const color = TONE[step.tone];

  return (
    <Step id={`workflow-${step.id}`} aria-labelledby={`workflow-${step.id}-title`}>
      <Left>
        <Intro data-reveal>
          <StepTag $color={color}>
            {step.index}
            {' — '}
            {step.label}
          </StepTag>
          <StepTitle id={`workflow-${step.id}-title`}>
            {step.headingStrong}
            <span>{step.headingMuted}</span>
          </StepTitle>
        </Intro>
        {step.items.map((item, i) => {
          const isOpen = open === i;
          const panelId = `workflow-${step.id}-${i}`;
          return (
            <Item key={item.title} $open={isOpen} $color={color}>
              <ItemButton type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(i)}>
                {item.title}
              </ItemButton>
              <ItemBody id={panelId} $open={isOpen} aria-hidden={!isOpen}>
                <div>
                  <p>{item.body}</p>
                </div>
              </ItemBody>
            </Item>
          );
        })}
      </Left>
      <Panel $color={color} data-panel>
        <PanelImg key={open} src={images[open]} alt="" loading="lazy" width={1264} height={1582} data-panel-mock />
      </Panel>
    </Step>
  );
}

export function Loop() {
  return (
    <Wrap id="workflow" aria-labelledby="workflow-title">
      <Container>
        <Outer>
          <Inner>
            <Head data-reveal>
              <Lights aria-hidden>
                <span />
                <span />
                <span />
              </Lights>
              <Eyebrow>How it works</Eyebrow>
              <h2 id="workflow-title">
                One Platform. One Workflow.
                <br />
                Full Content Loop.
              </h2>
            </Head>

            <StepBlock step={WORKFLOW[0]} />
            <Band data-reveal>
              <Quotes size={44.9} weight="fill" aria-hidden />
              <BandQuote>{WORKFLOW_QUOTES[0].text}</BandQuote>
              <BandAuthor>
                <b>{WORKFLOW_QUOTES[0].author}</b>
                <span>{WORKFLOW_QUOTES[0].org}</span>
              </BandAuthor>
            </Band>
            <StepBlock step={WORKFLOW[1]} />
            <Band data-reveal>
              <Quotes size={44.9} weight="fill" aria-hidden />
              <BandQuote>{WORKFLOW_QUOTES[1].text}</BandQuote>
              <BandAuthor>
                <b>{WORKFLOW_QUOTES[1].author}</b>
                <span>{WORKFLOW_QUOTES[1].org}</span>
              </BandAuthor>
            </Band>
            <StepBlock step={WORKFLOW[2]} />

            <Updates data-reveal>
              <UpdatesHead>
                <div>
                  <Eyebrow>We ship Ranksmile every week</Eyebrow>
                  <h2>
                    Discover New Features
                    <br />
                    &amp; Recent Changes
                  </h2>
                </div>
                <Link href="/auth/sign-up" legacyBehavior>
                  <a>
                    View all
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </a>
                </Link>
              </UpdatesHead>
              <UpdateList>
                {UPDATES.map((u) => (
                  <Update key={u.title}>
                    <p>
                      {u.tag}
                      <span>New</span>
                    </p>
                    <h3>{u.title}</h3>
                  </Update>
                ))}
              </UpdateList>
              <CursorTag $x="calc(100% - 290px)" $y="-82px" aria-hidden>
                <Cursor weight="fill" />
                <span>You</span>
              </CursorTag>
              <CursorTag $x="calc(100% - 250px)" $y="-262px" $flip aria-hidden>
                <Cursor weight="fill" />
                <span>Smily</span>
              </CursorTag>
            </Updates>
          </Inner>
        </Outer>
      </Container>
    </Wrap>
  );
}

export default Loop;
