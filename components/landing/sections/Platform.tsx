import React from 'react';
import styled from '@emotion/styled';
import { CheckCircle, Circle, Plus } from '@phosphor-icons/react';
import Gauge from '../../ranksmile/Gauge';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Body, Container, Eyebrow, H2, H3, Lead, Panel, Section } from '../primitives';
import { PILLARS, USE_CASES } from '../content';

const Head = styled.div`
  display: grid;
  gap: 24px;
  margin-bottom: 48px;
  ${media.lg} {
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: end;
    margin-bottom: 64px;
  }
`;

const Cards = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Mini = styled(Panel)`
  padding: 20px;
  min-height: 190px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-family: ${typeface.body};
  box-shadow: ${shadow.sm};
`;

const MiniTitle = styled.span`
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const ScoreRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
`;

const ScoreSide = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.tertiary};
`;

const BigGauge = styled.div`
  width: 120px;
  svg {
    width: 100%;
    height: auto;
  }
`;

const CheckList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
`;

const CheckItem = styled.li<{ $done?: boolean; $muted?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.sm};
  font-size: ${textScale.sm.fontSize};
  color: ${(p) => (p.$muted ? semantic.text.tertiary : semantic.text.primary)};
  svg {
    flex-shrink: 0;
    color: ${(p) => (p.$done ? semantic.status.success : semantic.border.secondary)};
  }
`;

const Pillars = styled.div`
  display: grid;
  gap: 24px;
  margin-top: 40px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    & > div + div {
      border-left: 1px solid ${semantic.border.primary};
      padding-left: 32px;
    }
  }
`;

const Pillar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
`;

const UseCases = styled.div`
  display: grid;
  gap: 16px;
  margin-top: 72px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: 1fr 1fr;
    margin-top: 96px;
  }
`;

const UseCase = styled(Panel)`
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: ${semantic.background.secondary};
  border-color: transparent;
  box-shadow: none;
`;

export function Platform() {
  return (
    <Section id="platform" $tone="primary" aria-labelledby="platform-title">
      <Container>
        <Head data-reveal>
          <div>
            <Eyebrow>Solution</Eyebrow>
            <H2 id="platform-title">Ranksmile: your SEO and AI search visibility OS.</H2>
          </div>
          <Lead>
            We spent years analyzing what makes content trusted — by Google, by AI, by people who actually make decisions
            online. Ranksmile decodes those signals and turns them into a repeatable operating system for content teams.
          </Lead>
        </Head>

        <Cards>
          <Mini data-reveal aria-label="Content Score widget">
            <MiniTitle>Content Score</MiniTitle>
            <ScoreRow>
              <ScoreSide>
                <Gauge score={86} size="sm" />
                SEO
              </ScoreSide>
              <BigGauge aria-hidden>
                <Gauge score={91} size="md" />
              </BigGauge>
              <ScoreSide>
                <Gauge score={84} size="sm" />
                AI search
              </ScoreSide>
            </ScoreRow>
          </Mini>

          <Mini data-reveal aria-label="Brand space setup">
            <MiniTitle>Northwind Inc.</MiniTitle>
            <CheckList>
              <CheckItem $done>
                <CheckCircle size={18} weight="fill" aria-hidden />
                Extracting brand details
              </CheckItem>
              <CheckItem $muted>
                <Circle size={18} weight="bold" aria-hidden />
                Competitors
              </CheckItem>
              <CheckItem $muted>
                <Circle size={18} weight="bold" aria-hidden />
                Brand voice
              </CheckItem>
            </CheckList>
          </Mini>

          <Mini data-reveal aria-label="Quick actions">
            <MiniTitle>Quick start</MiniTitle>
            <CheckList>
              <CheckItem $done>
                <CheckCircle size={18} weight="fill" aria-hidden />
                Add your first brand
              </CheckItem>
              <CheckItem>
                <Plus size={18} weight="bold" aria-hidden />
                Optimize your first page
              </CheckItem>
              <CheckItem>
                <Plus size={18} weight="bold" aria-hidden />
                Request a mention
              </CheckItem>
            </CheckList>
          </Mini>
        </Cards>

        <Pillars>
          {PILLARS.map((pillar) => (
            <Pillar key={pillar.title} data-reveal>
              <H3 as="h3">{pillar.title}</H3>
              <Body>{pillar.body}</Body>
            </Pillar>
          ))}
        </Pillars>

        <UseCases>
          {USE_CASES.map((useCase) => (
            <UseCase key={useCase.title} data-reveal>
              <Eyebrow as="span" style={{ marginBottom: 0 }}>{useCase.eyebrow}</Eyebrow>
              <H3>{useCase.title}</H3>
              <Body>{useCase.body}</Body>
            </UseCase>
          ))}
        </UseCases>
      </Container>
    </Section>
  );
}

export default Platform;
