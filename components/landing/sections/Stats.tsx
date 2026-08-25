import React from 'react';
import styled from '@emotion/styled';
import { FacebookLogo, Globe, GoogleLogo, RedditLogo, Rss, ShoppingBagOpen, YoutubeLogo } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CARD_SHADOW, Container, Eyebrow, H2, Lead, Section } from '../primitives';
import { STATS } from '../content';

/* Figma 1:3717 — pb 180, column gap 90; head 972 wide gap 25.8; cards 463 × 526.77, radius 27. */

const Wrap = styled(Section)`
  padding: 90px 0 180px;
  ${BP.md} {
    padding: 54px 0 90px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 25.8px;
  max-width: 972px;
  margin: 0 auto 90px;
  text-align: center;
  h2 em {
    font-style: normal;
    color: ${semantic.text.brand};
    display: block;
  }
  p {
    max-width: 792px;
    padding: 0 8px;
  }
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 25px;
  ${BP.md} {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 27px;
  background: ${semantic.background.primary};
  box-shadow: ${CARD_SHADOW};
`;

const Viz = styled.div`
  position: relative;
  height: 288px;
  overflow: hidden;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  background-image: radial-gradient(ellipse 60% 45% at 50% 50%, color-mix(in srgb, ${semantic.border.secondary} 45%, transparent), transparent 70%);
`;

const Big = styled.span`
  position: absolute;
  font-size: 69.1px;
  line-height: 75.99px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const From = styled.span`
  position: absolute;
  left: 36px;
  bottom: 52.9px;
  font-size: 22.5px;
  line-height: 33.76px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.tertiary};
`;

const Area = styled.svg`
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  width: 100%;
  height: 50.66%;
`;

const Bar = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: -1px;
  width: 43%;
  border-radius: 13.5px 13.5px 13.5px 0;
  background: ${semantic.background.brand};
`;

const KeyRow = styled.div<{ $top: string }>`
  position: absolute;
  left: 50%;
  top: ${(p) => p.$top};
  transform: translate(-50%, -50%);
  display: flex;
  gap: 13.5px;
  span {
    height: 135px;
    flex-shrink: 0;
    border-radius: 27px;
    border: 1px solid ${semantic.border.primary};
    background: ${semantic.background.secondary};
    box-shadow: 0px 3px 4.6px rgba(0,0,0,0.04), 0px 1.5px 1.5px rgba(0,0,0,0.05);
  }
`;

const Text = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 54px 36px 44.8px;
  text-align: center;
`;

const Claim = styled.h3`
  margin: 0;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  text-wrap: balance;
  strong {
    color: ${semantic.text.primary};
  }
`;

const Source = styled.p`
  margin: 0;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.secondary};
  a {
    color: ${semantic.text.primary};
    text-decoration: underline;
    text-underline-position: from-font;
  }
`;

const Icons = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 45px;
  span {
    width: 54px;
    height: 54px;
    margin-right: -13.5px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 1px solid ${semantic.border.secondary};
    background: ${semantic.background.primary};
    color: ${semantic.text.primary};
  }
  span:last-of-type {
    margin-right: 0;
  }
`;

const ICONS = [ShoppingBagOpen, Rss, RedditLogo, YoutubeLogo, FacebookLogo, GoogleLogo, Globe];

export function Stats() {
  return (
    <Wrap id="why" aria-labelledby="why-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tracking={2.025} style={{ fontWeight: 500, lineHeight: '20.25px' }}>Search isn&apos;t just Google anymore</Eyebrow>
          <H2 id="why-title" $size={55.2}>
            Welcome to The Era of
            <em>Artificial Influence.</em>
          </H2>
          <Lead $size={18}>
            Search has always been about trust. But today, buyers ask ChatGPT before they Google, and check AI Overviews
            before they ever click a link. LLMs don&apos;t rank based on old-school keyword density — they cite based on
            structure, depth, and credibility.
          </Lead>
        </Head>

        <Grid>
          {STATS.map((stat) => {
            const decimals = 'decimals' in stat ? stat.decimals : 0;
            const label = `${stat.value.toFixed(decimals)}${stat.suffix}`;
            const count = { 'data-count': stat.value, 'data-decimals': decimals, 'data-suffix': stat.suffix };
            return (
              <Card key={stat.strong} data-reveal>
                <Viz aria-hidden>
                  {stat.shape === 'area' ? (
                    <>
                      <Big style={{ left: 36, top: 70 }} {...count}>{label}</Big>
                      {'from' in stat ? <From>{stat.from}</From> : null}
                      <Area viewBox="0 0 460 146" preserveAspectRatio="none">
                        <polygon points="0,146 0,112 96,112 460,4 460,146" fill="var(--koala-bg-brand)" data-grow />
                      </Area>
                    </>
                  ) : null}
                  {stat.shape === 'bar' ? (
                    <>
                      <Bar data-grow-x />
                      <Big style={{ left: '59.6%', top: '50%', transform: 'translateY(-50%)' }} {...count}>{label}</Big>
                    </>
                  ) : null}
                  {stat.shape === 'grid' ? (
                    <>
                      <KeyRow $top="calc(50% - 148.5px)">
                        <span style={{ width: 270 }} />
                        <span style={{ width: 171 }} />
                        <span style={{ width: 171 }} />
                        <span style={{ width: 99 }} />
                      </KeyRow>
                      <KeyRow $top="50%">
                        <span style={{ width: 270 }} />
                        <span style={{ width: 195, visibility: 'hidden' }} />
                        <span style={{ width: 270 }} />
                      </KeyRow>
                      <KeyRow $top="calc(50% + 148.5px)">
                        <span style={{ width: 171 }} />
                        <span style={{ width: 270 }} />
                        <span style={{ width: 99 }} />
                      </KeyRow>
                      <Big style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} {...count}>{label}</Big>
                    </>
                  ) : null}
                </Viz>
                <Text>
                  <Claim>
                    {stat.lead}
                    <strong>{stat.strong}</strong>
                    {stat.tail}
                  </Claim>
                  <Source>
                    Source:
                    {' '}
                    <a href={stat.source.href} target="_blank" rel="noopener noreferrer">{stat.source.label}</a>
                  </Source>
                </Text>
              </Card>
            );
          })}
        </Grid>

        <Icons data-reveal aria-hidden>
          {ICONS.map((IconComp, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i}><IconComp size={22.5} weight="fill" /></span>
          ))}
        </Icons>
      </Container>
    </Wrap>
  );
}

export default Stats;
