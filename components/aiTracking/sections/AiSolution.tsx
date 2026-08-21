import React from 'react';
import styled from '@emotion/styled';
import { ChartBar, Megaphone, Target } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Eyebrow, H2, Lead, Section } from '../../landing/primitives';
import { SOLUTION } from '../content';

/* Figma 3:4675 — Solution head + 3 image cards with captions. */

const Wrap = styled(Section)`
  padding: 180px 0;
  ${BP.md} {
    padding: 72px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  max-width: 990px;
  margin: 0 auto 90px;
  text-align: center;
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 27px;
  ${BP.md} {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  gap: 36px;
`;

const Art = styled.div`
  aspect-ratio: 426 / 511;
  border-radius: 27px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background:
    radial-gradient(120% 80% at 30% 20%, color-mix(in srgb, var(--landing-blue) 14%, transparent), transparent 60%),
    ${semantic.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  box-sizing: border-box;
`;

const Caption = styled.p`
  margin: 0;
  padding: 0 27px;
  text-align: center;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
  }
`;

/* ── Per-card CSS art ──────────────────────────────────────────────────────── */

const Panel = styled.div`
  width: 100%;
  max-width: 300px;
  border-radius: 18px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
  color: ${semantic.text.primary};
`;

const Bar = styled.div<{ $w: number; $c: string }>`
  display: flex;
  align-items: center;
  gap: 10px;
  span:first-of-type {
    width: 64px;
    color: ${semantic.text.secondary};
  }
  i {
    flex: 1;
    height: 10px;
    border-radius: 999px;
    background: ${semantic.background.secondary};
    overflow: hidden;
    position: relative;
    &::after {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: ${(p) => p.$w}%;
      border-radius: inherit;
      background: ${(p) => p.$c};
    }
  }
  b {
    width: 30px;
    text-align: right;
    font-weight: ${fontWeight.medium};
  }
`;

const CHIP_BG = { good: semantic.status.successBg, bad: semantic.status.dangerBg, neutral: semantic.background.secondary } as const;
const CHIP_FG = { good: semantic.status.success, bad: semantic.status.danger, neutral: semantic.text.secondary } as const;

const Chip = styled.span<{ $tone: keyof typeof CHIP_BG }>`
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: ${fontWeight.medium};
  background: ${(p) => CHIP_BG[p.$tone]};
  color: ${(p) => CHIP_FG[p.$tone]};
`;

function ShareArt() {
  return (
    <Panel>
      <b style={{ fontWeight: 700 }}>AI Share of Voice</b>
      <Bar $w={62} $c="var(--koala-bg-brand)"><span>You</span><i /><b>62</b></Bar>
      <Bar $w={48} $c="var(--landing-blue)"><span>Contoso</span><i /><b>48</b></Bar>
      <Bar $w={31} $c="var(--landing-green)"><span>Fabrikam</span><i /><b>31</b></Bar>
      <Bar $w={22} $c={semantic.text.tertiary}><span>Litware</span><i /><b>22</b></Bar>
    </Panel>
  );
}

function NarrativeArt() {
  return (
    <Panel>
      <b style={{ fontWeight: 700 }}>Brand sentiment</b>
      <Chip $tone="good">Positive · 68%</Chip>
      <Chip $tone="neutral">Neutral · 24%</Chip>
      <Chip $tone="bad">Off-brand · 8%</Chip>
      <div style={{ marginTop: 4, color: semantic.text.secondary, lineHeight: '18px' }}>
        “Ranksmile is described as the go-to for AI visibility.”
      </div>
    </Panel>
  );
}

function ActionArt() {
  return (
    <Panel>
      <b style={{ fontWeight: 700 }}>Daily report · actions</b>
      <Chip $tone="bad">Optimize /pricing — +18</Chip>
      <Chip $tone="neutral">Outreach 14 sources</Chip>
      <Chip $tone="good">Published — score 91</Chip>
      <div style={{ marginTop: 4, color: semantic.text.secondary }}>3 tasks queued for this week</div>
    </Panel>
  );
}

const ART = { share: ShareArt, narrative: NarrativeArt, action: ActionArt } as const;
const ICON = { share: ChartBar, narrative: Megaphone, action: Target } as const;

export function AiSolution() {
  return (
    <Wrap id="solution" aria-labelledby="ai-solution-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tone="brand">{SOLUTION.eyebrow}</Eyebrow>
          <H2 id="ai-solution-title" $size={55.2}>
            {SOLUTION.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </H2>
          <Lead>{SOLUTION.sub}</Lead>
        </Head>

        <Grid>
          {SOLUTION.cards.map((card) => {
            const ArtFor = ART[card.art];
            const IconComp = ICON[card.art];
            return (
              <Card key={card.strong} data-reveal>
                <Art aria-hidden>
                  <ArtFor />
                </Art>
                <Caption>
                  <IconComp size={22} weight="fill" aria-hidden style={{ color: 'var(--koala-text-brand)', verticalAlign: '-3px', marginRight: 6 }} />
                  <strong>{card.strong}</strong>
                  {card.body}
                </Caption>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Wrap>
  );
}

export default AiSolution;
