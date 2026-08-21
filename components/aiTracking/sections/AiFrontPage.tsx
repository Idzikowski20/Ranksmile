import React from 'react';
import styled from '@emotion/styled';
import { FacebookLogo, Globe, GoogleLogo, RedditLogo, Rss, ShoppingBagOpen, YoutubeLogo } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CARD_SHADOW, Container, Section, Tag } from '../../landing/primitives';
import { FRONTPAGE, STATS } from '../content';

/*
 * Figma 3:4518 — px 27 column; head grid (1fr / 1.1fr, gap 90, pt 180 pb 126, pl 99);
 * prompt chip row (54px memoji + shadow chip); three 442×526 cards; icon row right-aligned;
 * centred quote (35.8px, highlight bars) + author grid. White in the reference already.
 */

const Head = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  grid-template-rows: 24.3px auto;
  column-gap: 90px;
  row-gap: 27px;
  padding: 180px 27px 126px 99px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    padding: 90px 0 54px;
  }
`;

const HeadTag = styled(Tag)`
  grid-column: 1 / -1;
`;

const Title = styled.h2`
  margin: 0;
  align-self: start;
  font-size: 55.2px;
  line-height: 60.67px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 36px;
    line-height: 42px;
  }
`;

const Sub = styled.p`
  margin: 0;
  align-self: end;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  span {
    background: linear-gradient(90deg, ${semantic.text.primary}, transparent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  ${BP.md} {
    font-size: 18px;
    line-height: 26px;
  }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 90px;
  ${BP.md} {
    gap: 45px;
  }
`;

const PromptRow = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 27px;
  img {
    width: 54px;
    height: 54px;
    border-radius: 27px;
    object-fit: cover;
  }
  ${BP.md} {
    padding: 0;
  }
`;

const PromptChip = styled.div`
  padding: 8.7px 18px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 13.5px;
  background: ${semantic.background.primary};
  box-shadow: ${CARD_SHADOW};
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
  white-space: nowrap;
  b {
    font-weight: ${fontWeight.bold};
    font-style: italic;
    color: ${semantic.text.primary};
  }
  ${BP.sm} {
    white-space: normal;
    font-size: 16px;
    line-height: 24px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 27px;
  min-height: 526.77px;
  ${BP.md} {
    grid-template-columns: 1fr;
    min-height: 0;
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
  border-bottom: 1px solid ${semantic.background.secondary};
  background:
    radial-gradient(ellipse 55% 40% at 50% 50%, rgba(0,0,0,0.145) 0, rgba(0,0,0,0) 3.5%),
    ${semantic.background.primary};
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

/* The reference area is a purple SVG; masking it lets the fill follow the theme accent. */
const AreaImg = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 48.7%;
  background: var(--landing-blue);
  mask: url('/ai-tracking/frontpage-area.svg') center / 100% 100% no-repeat;
  -webkit-mask: url('/ai-tracking/frontpage-area.svg') center / 100% 100% no-repeat;
  transform-origin: bottom;
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
    background: ${semantic.background.primary};
    box-shadow: 0px 3.08px 4.62px rgba(0,0,0,0.04), 0px 37px 105px rgba(47,48,55,0.05), 0px 6.17px 9.25px rgba(34,42,53,0.04);
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

const Src = styled.p`
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
  justify-content: flex-end;
  span {
    width: 54px;
    height: 54px;
    margin-right: -13.5px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 1px solid ${semantic.border.primary};
    background: ${semantic.background.primary};
    color: ${semantic.text.primary};
  }
  span:last-of-type {
    margin-right: 0;
  }
`;

const QuoteWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 90px;
  padding: 180px 0;
  ${BP.md} {
    gap: 45px;
    padding: 72px 0;
  }
`;

const Quote = styled.blockquote`
  margin: 0;
  max-width: 990px;
  text-align: center;
  font-size: 35.8px;
  line-height: 42.93px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  text-wrap: balance;
  mark {
    background: ${semantic.background.brand};
    color: ${semantic.text.primary};
    padding: 2px 6px;
    border-radius: 8.94px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  ${BP.md} {
    font-size: 24px;
    line-height: 32px;
  }
`;

const Author = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  column-gap: 27px;
  align-items: center;
  img {
    width: 90px;
    height: 90px;
    border-radius: 18px;
    object-fit: cover;
  }
  b {
    display: block;
    font-size: 18px;
    line-height: 27px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  span {
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.secondary};
  }
`;

const ICONS = [ShoppingBagOpen, Rss, RedditLogo, YoutubeLogo, FacebookLogo, GoogleLogo, Globe];

export function AiFrontPage() {
  return (
    <Section aria-labelledby="frontpage-title">
      <Container>
        <Head data-reveal>
          <HeadTag>{FRONTPAGE.eyebrow}</HeadTag>
          <Title id="frontpage-title">
            {FRONTPAGE.titleLines[0]}
            <br />
            {FRONTPAGE.titleLines[1]}
          </Title>
          <Sub>
            {FRONTPAGE.sub}
            <span>{FRONTPAGE.subMuted}</span>
          </Sub>
        </Head>

        <Body>
          <PromptRow data-reveal>
            <img src="/ai-tracking/frontpage-memoji.png" alt="" width={54} height={54} />
            <PromptChip>
              {FRONTPAGE.promptChip.muted}
              <b>{FRONTPAGE.promptChip.strong}</b>
              {FRONTPAGE.promptChip.rest}
            </PromptChip>
          </PromptRow>

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
                        <Big style={{ left: 36, top: 36 }} {...count}>{label}</Big>
                        {'from' in stat ? <From>{stat.from}</From> : null}
                        <AreaImg data-grow />
                      </>
                    ) : null}
                    {stat.shape === 'bar' ? (
                      <>
                        <Bar data-grow-x />
                        <Big style={{ left: '58%', top: '50%', transform: 'translateY(-50%)' }} {...count}>{label}</Big>
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
                          <span style={{ width: 171 }} />
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
                    <Src>
                      Source:
                      {' '}
                      <a href={stat.source.href} target="_blank" rel="noopener noreferrer">{stat.source.label}</a>
                    </Src>
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
        </Body>

        <QuoteWrap data-reveal>
          <Quote>
            {FRONTPAGE.quote.lead}
            <mark>{FRONTPAGE.quote.highlight}</mark>
          </Quote>
          <Author>
            <img src="/ai-tracking/frontpage-memoji.png" alt="" width={90} height={90} />
            <div>
              <b>{FRONTPAGE.quote.name}</b>
              <span>{FRONTPAGE.quote.role}</span>
            </div>
          </Author>
        </QuoteWrap>
      </Container>
    </Section>
  );
}

export default AiFrontPage;
