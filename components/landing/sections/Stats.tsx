import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { palette } from '../../koala/tokens/colors';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, Eyebrow, H2, Lead, Panel, Section, SectionHead, TextLink } from '../primitives';
import { STATS } from '../content';

const Title = styled(H2)`
  span {
    color: ${semantic.text.brand};
  }
`;

const Grid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Card = styled(Panel)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: ${typeface.body};
`;

const Viz = styled.div`
  position: relative;
  height: 210px;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  overflow: hidden;
`;

const Big = styled.span`
  position: absolute;
  z-index: 1;
  font-size: 56px;
  line-height: 1;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.04em;
  color: ${semantic.text.primary};
  font-variant-numeric: tabular-nums;
`;

const From = styled.span`
  position: absolute;
  left: 24px;
  bottom: 48px;
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
`;

const Area = styled.svg`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 120px;
`;

const Bar = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 42%;
  background: ${semantic.background.brand};
  border-top-right-radius: ${radius.card.default};
`;

const Keys = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  padding: 8px;
  span {
    border: 1px solid ${semantic.border.primary};
    border-radius: ${radius.card.sm};
    background: ${semantic.background.primary};
  }
`;

const Text = styled.div`
  padding: 24px 24px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
`;

const Claim = styled.p`
  margin: 0;
  font-size: ${textScale.lg.fontSize};
  line-height: 1.4;
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
    font-weight: ${fontWeight.medium};
  }
`;

const SourceLine = styled.p`
  margin: 0;
  font-size: ${textScale.sm.fontSize};
  color: ${semantic.text.tertiary};
`;

export function Stats() {
  return (
    <Section id="why" aria-labelledby="why-title">
      <Container>
        <SectionHead data-reveal>
          <Eyebrow>Search isn&apos;t just Google anymore</Eyebrow>
          <Title id="why-title">
            Welcome to the era of
            {' '}
            <span>artificial influence.</span>
          </Title>
          <Lead>
            Search has always been about trust. But today, buyers ask ChatGPT before they Google, and check AI Overviews
            before they ever click a link. LLMs don&apos;t rank on old-school keyword density — they cite based on structure,
            depth, and credibility.
          </Lead>
        </SectionHead>

        <Grid>
          {STATS.map((stat) => {
            const decimals = 'decimals' in stat ? stat.decimals : 0;
            const label = `${stat.value.toFixed(decimals)}${stat.suffix}`;
            return (
              <Card key={stat.strong} data-reveal>
                <Viz aria-hidden>
                  {stat.shape === 'area' ? (
                    <>
                      <Big style={{ left: 24, top: 28 }} data-count={stat.value} data-decimals={decimals} data-suffix={stat.suffix}>
                        {label}
                      </Big>
                      {'from' in stat ? <From>{stat.from}</From> : null}
                      <Area viewBox="0 0 300 120" preserveAspectRatio="none">
                        <polygon points="0,120 0,96 60,96 300,30 300,120" fill={palette.blue[600]} data-grow />
                      </Area>
                    </>
                  ) : null}
                  {stat.shape === 'bar' ? (
                    <>
                      <Bar data-grow />
                      <Big
                        style={{ right: 24, top: '50%', transform: 'translateY(-50%)' }}
                        data-count={stat.value}
                        data-decimals={decimals}
                        data-suffix={stat.suffix}
                      >
                        {label}
                      </Big>
                    </>
                  ) : null}
                  {stat.shape === 'grid' ? (
                    <>
                      <Keys>
                        {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ opacity: i === 4 ? 0 : 1 }} />)}
                      </Keys>
                      <Big
                        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                        data-count={stat.value}
                        data-decimals={decimals}
                        data-suffix={stat.suffix}
                      >
                        {label}
                      </Big>
                    </>
                  ) : null}
                </Viz>
                <Text>
                  <Claim>
                    {stat.lead}
                    <strong>{stat.strong}</strong>
                    {stat.tail}
                  </Claim>
                  <SourceLine>
                    Source:
                    {' '}
                    <TextLink href={stat.source.href} target="_blank" rel="noopener noreferrer">{stat.source.label}</TextLink>
                  </SourceLine>
                </Text>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}

export default Stats;
