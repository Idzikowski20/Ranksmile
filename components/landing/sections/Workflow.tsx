import React, { useState } from 'react';
import styled from '@emotion/styled';
import { ArrowUp, ArrowDown, BellRinging, CheckCircle } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { palette } from '../../koala/tokens/colors';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, Eyebrow, H2, Panel, Section, SectionHead } from '../primitives';
import { WORKFLOW, type WorkflowStep } from '../content';

/* Chromatic panels: brand orange + two palette families (no purple — see DESIGN.md). */
const TONE: Record<WorkflowStep['tone'], { bg: string; fg: string }> = {
  brand: { bg: semantic.background.brand, fg: semantic.text.onBrand },
  green: { bg: palette.softGreen[500], fg: palette.white },
  blue: { bg: palette.blue[600], fg: palette.white },
};

const Loop = styled(Panel)`
  overflow: hidden;
  padding: 0;
`;

const Step = styled.article`
  display: grid;
  grid-template-columns: 1fr;
  border-top: 1px solid ${semantic.border.primary};
  ${media.lg} {
    grid-template-columns: 1fr 1fr;
    min-height: 560px;
  }
`;

const Left = styled.div`
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  ${media.md} {
    padding: 48px 40px;
  }
`;

const StepIndex = styled.span<{ $tone: WorkflowStep['tone'] }>`
  font-family: ${typeface.body};
  font-size: ${textScale.xs.fontSize};
  font-weight: ${fontWeight.medium};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${(p) => TONE[p.$tone].bg};
`;

const StepTitle = styled.h3`
  margin: 0;
  font-family: ${typeface.heading};
  font-size: ${textScale['2xl'].fontSize};
  line-height: ${textScale['2xl'].lineHeight};
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  span {
    display: block;
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.tertiary};
  }
`;

const Items = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${semantic.border.primary};
`;

const Item = styled.div<{ $open: boolean; $tone: WorkflowStep['tone'] }>`
  border-bottom: 1px solid ${semantic.border.primary};
  border-left: 3px solid ${(p) => (p.$open ? TONE[p.$tone].bg : 'transparent')};
  background: ${(p) => (p.$open ? semantic.background.secondary : 'transparent')};
  transition: background var(--motion-fast) var(--motion-ease-standard), border-color var(--motion-fast) var(--motion-ease-standard);
`;

const ItemButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 16px;
  border: 0;
  background: transparent;
  text-align: left;
  font-family: ${typeface.body};
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  cursor: var(--koala-cursor-pointing);
  &:focus-visible {
    outline: none;
    box-shadow: inset ${shadow.focus};
  }
  svg {
    flex-shrink: 0;
    color: ${semantic.text.tertiary};
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
    padding: 0 16px 18px;
    font-family: ${typeface.body};
    font-size: ${textScale.sm.fontSize};
    line-height: ${textScale.sm.lineHeight};
    color: ${semantic.text.secondary};
  }
`;

const Right = styled.div<{ $tone: WorkflowStep['tone'] }>`
  position: relative;
  overflow: hidden;
  min-height: 360px;
  padding: 40px 0 0 24px;
  background: ${(p) => TONE[p.$tone].bg};
  color: ${(p) => TONE[p.$tone].fg};
  ${media.md} {
    padding: 56px 0 0 48px;
  }
`;

const Mock = styled.div`
  height: 100%;
  min-height: 320px;
  background: ${semantic.background.primary};
  color: ${semantic.text.primary};
  border: 1px solid ${semantic.border.primary};
  border-right: 0;
  border-bottom: 0;
  border-radius: ${radius.card.default} 0 0 0;
  box-shadow: ${shadow.lg};
  font-family: ${typeface.body};
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const MockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  span {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.tertiary};
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.card.sm};
  font-size: ${textScale.sm.fontSize};
  b {
    font-weight: ${fontWeight.medium};
  }
  small {
    margin-left: auto;
    color: ${semantic.text.tertiary};
    white-space: nowrap;
  }
`;

const METER_FILL = { up: semantic.status.success, down: semantic.status.danger, brand: semantic.background.brand } as const;
const CHIP_BG = { success: semantic.status.successBg, danger: semantic.status.dangerBg, neutral: semantic.background.secondary } as const;
const CHIP_FG = { success: semantic.status.success, danger: semantic.status.danger, neutral: semantic.text.secondary } as const;

const Meter = styled.div<{ $value: number; $tone: keyof typeof METER_FILL }>`
  position: relative;
  height: 8px;
  flex: 1;
  border-radius: ${radius.full};
  background: ${semantic.background.secondary};
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: ${(p) => p.$value}%;
    border-radius: inherit;
    background: ${(p) => METER_FILL[p.$tone]};
  }
`;

const Chip = styled.span<{ $tone: keyof typeof CHIP_BG }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: ${radius.full};
  font-size: ${textScale.xs.fontSize};
  font-weight: ${fontWeight.medium};
  background: ${(p) => CHIP_BG[p.$tone]};
  color: ${(p) => CHIP_FG[p.$tone]};
`;

function DiagnoseMock() {
  return (
    <Mock data-panel-mock aria-hidden>
      <MockHead>
        Mention gap
        <span>last 30 days</span>
      </MockHead>
      <Row>
        <b>yourdomain.com</b>
        <Meter $value={21} $tone="brand" />
        <small>21</small>
      </Row>
      <Row>
        northwind.com
        <Meter $value={81} $tone="up" />
        <small>81</small>
      </Row>
      <Row>
        contoso.io
        <Meter $value={71} $tone="up" />
        <small>71</small>
      </Row>
      <Row>
        fabrikam.co
        <Meter $value={68} $tone="up" />
        <small>68</small>
      </Row>
      <MockHead style={{ marginTop: 8 }}>
        URLs the engines cite instead
      </MockHead>
      <Row>
        northwind.com/guides/ai-rank-tracking
        <small>4 engines</small>
      </Row>
      <Row>
        contoso.io/blog/seo-for-agencies
        <small>3 engines</small>
      </Row>
    </Mock>
  );
}

function FixMock() {
  return (
    <Mock data-panel-mock aria-hidden>
      <MockHead>
        Action list
        <span>sorted by impact</span>
      </MockHead>
      <Row>
        <Chip $tone="danger">Optimize</Chip>
        <b>/pricing</b>
        {' '}
        — add comparison table; cited by 0 of 5 engines
        <small>+18 visibility</small>
      </Row>
      <Row>
        <Chip $tone="neutral">Create</Chip>
        <b>“AI rank tracking for agencies”</b>
        {' '}
        — coverage gap, 3 competitors rank
        <small>+11</small>
      </Row>
      <Row>
        <Chip $tone="success">Publish</Chip>
        <b>/blog/content-score-explained</b>
        {' '}
        — score 91, ready for WordPress
        <small>today</small>
      </Row>
      <MockHead style={{ marginTop: 8 }}>
        Live guidelines
        <span>Content Score 91 / 100</span>
      </MockHead>
      <Row>
        <CheckCircle size={16} weight="fill" color="var(--koala-status-success)" />
        Terms: 38 / 42 used
        <Meter $value={90} $tone="up" />
      </Row>
      <Row>
        <CheckCircle size={16} weight="fill" color="var(--koala-status-success)" />
        Headings: 9 / 10
        <Meter $value={90} $tone="up" />
      </Row>
      <Row>
        <CheckCircle size={16} weight="fill" color="var(--koala-status-warning)" />
        Entities: 12 / 18
        <Meter $value={66} $tone="brand" />
      </Row>
    </Mock>
  );
}

function MonitorMock() {
  return (
    <Mock data-panel-mock aria-hidden>
      <MockHead>
        Inbox
        <span>unread only</span>
      </MockHead>
      <Row>
        <BellRinging size={16} weight="fill" color="var(--koala-status-danger)" />
        <div>
          <b>Rank drop detected</b>
          {' '}
          — yourdomain.com
          <br />
          5 pages dropped out of top 10 · no recovery in 7 days
        </div>
        <small>2m</small>
      </Row>
      <Row>
        <ArrowDown size={16} weight="bold" color="var(--koala-status-danger)" />
        <div>
          <b>AI mention lost</b>
          {' '}
          — ChatGPT stopped citing you for “best rank tracker”
        </div>
        <small>24m</small>
      </Row>
      <Row>
        <ArrowUp size={16} weight="bold" color="var(--koala-status-success)" />
        <div>
          <b>New recommendations ready</b>
          <br />
          2 quick wins detected on pages losing traffic
        </div>
        <small>1h</small>
      </Row>
      <Row>
        <CheckCircle size={16} weight="fill" color="var(--koala-status-success)" />
        <div>
          <b>Re-optimization shipped</b>
          {' '}
          — /guides/ai-visibility back in 5 of 5 engines
        </div>
        <small>yesterday</small>
      </Row>
    </Mock>
  );
}

const MOCKS: Record<string, () => JSX.Element> = {
  diagnose: DiagnoseMock,
  fix: FixMock,
  monitor: MonitorMock,
};

function StepBlock({ step }: { step: WorkflowStep }) {
  const [open, setOpen] = useState(0);
  const MockFor = MOCKS[step.id];

  return (
    <Step id={`workflow-${step.id}`} aria-labelledby={`workflow-${step.id}-title`}>
      <Left>
        <div data-reveal>
          <StepIndex $tone={step.tone}>
            {step.index}
            {' — '}
            {step.label}
          </StepIndex>
          <StepTitle id={`workflow-${step.id}-title`} style={{ marginTop: 12 }}>
            {step.heading}
            <span>{step.sub}</span>
          </StepTitle>
        </div>
        <Items data-reveal>
          {step.items.map((item, i) => {
            const isOpen = open === i;
            const panelId = `workflow-${step.id}-${i}`;
            return (
              <Item key={item.title} $open={isOpen} $tone={step.tone}>
                <ItemButton
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(i)}
                >
                  {item.title}
                  {isOpen ? <ArrowUp size={16} weight="bold" aria-hidden /> : <ArrowDown size={16} weight="bold" aria-hidden />}
                </ItemButton>
                <ItemBody id={panelId} $open={isOpen} role="region" aria-hidden={!isOpen}>
                  <div>
                    <p>{item.body}</p>
                  </div>
                </ItemBody>
              </Item>
            );
          })}
        </Items>
      </Left>
      <Right $tone={step.tone} data-panel>
        <MockFor />
      </Right>
    </Step>
  );
}

export function Workflow() {
  return (
    <Section id="workflow" $tone="secondary" aria-labelledby="workflow-title">
      <Container>
        <Loop>
          <SectionHead style={{ padding: '56px 24px 48px', marginBottom: 0 }} data-reveal>
            <Eyebrow>How it works</Eyebrow>
            <H2 id="workflow-title">One platform. One workflow. Full content loop.</H2>
          </SectionHead>
          {WORKFLOW.map((step) => <StepBlock key={step.id} step={step} />)}
        </Loop>
      </Container>
    </Section>
  );
}

export default Workflow;
