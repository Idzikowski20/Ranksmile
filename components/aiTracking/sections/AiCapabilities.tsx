import React from 'react';
import styled from '@emotion/styled';
import { ChartLineUp, Crosshair, Megaphone, Target } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Eyebrow, H2, Section } from '../../landing/primitives';
import { CAPABILITIES } from '../content';

/* Figma 3:4896 — "What You Can Do With Ranksmile" + 4 icon cards. */

const Wrap = styled(Section)`
  padding: 179px 0 180px;
  ${BP.md} {
    padding: 72px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 27px;
  max-width: 990px;
  padding: 0 27px;
  margin-bottom: 90px;
  ${BP.md} {
    padding: 0;
    margin-bottom: 45px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
  ${BP.lg} {
    grid-template-columns: repeat(2, 1fr);
  }
  ${BP.sm} {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.article`
  min-height: 340px;
  padding: 45px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 13.5px;
  background: ${semantic.background.primary};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 40px;
  transition: transform var(--motion-normal) var(--motion-ease-out), box-shadow var(--motion-normal) var(--motion-ease-out);
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 24px 68px rgba(47,48,55,0.08);
  }
  ${BP.md} {
    min-height: 0;
    padding: 27px;
  }
`;

const IconBox = styled.span`
  width: 45px;
  height: 45px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--koala-bg-brand) 12%, transparent);
  color: ${semantic.text.brand};
`;

const Text = styled.p`
  margin: 0;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
  }
`;

const ICON = { target: Target, megaphone: Megaphone, chart: ChartLineUp, crosshair: Crosshair } as const;

export function AiCapabilities() {
  return (
    <Wrap aria-labelledby="capabilities-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tone="brand">{CAPABILITIES.eyebrow}</Eyebrow>
          <H2 id="capabilities-title" $size={55.2} $align="left">{CAPABILITIES.title}</H2>
        </Head>
        <Grid>
          {CAPABILITIES.cards.map((card) => {
            const IconComp = ICON[card.icon as keyof typeof ICON];
            return (
              <Card key={card.strong} data-reveal>
                <IconBox aria-hidden><IconComp size={26} weight="bold" /></IconBox>
                <Text>
                  <strong>{card.strong}</strong>
                  {card.body}
                </Text>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Wrap>
  );
}

export default AiCapabilities;
