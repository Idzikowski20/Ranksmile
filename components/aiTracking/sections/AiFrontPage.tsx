import React from 'react';
import styled from '@emotion/styled';
import { Quotes } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CARD_SHADOW, Container, Eyebrow, Section } from '../../landing/primitives';
import { FRONTPAGE, STATS } from '../content';

/* Figma 3:4518 — "AI is the new Front Page": left head + right sub, prompt chip, 3 stat cards, quote. */

const Wrap = styled(Section)`
  padding: 90px 0 126px;
  ${BP.md} {
    padding: 54px 0 72px;
  }
`;

const Head = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
  padding: 0 27px;
  ${BP.md} {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 0;
  }
`;

const Title = styled.h2`
  margin: 0;
  font-size: 44.5px;
  line-height: 53.41px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 32px;
    line-height: 38px;
  }
`;

const Sub = styled.p`
  margin: 0;
  align-self: end;
  max-width: 420px;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.primary};
  span {
    color: ${semantic.text.tertiary};
  }
`;

const PromptChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 13.5px;
  margin: 45px 27px 0;
  padding: 9px 18px 9px 9px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9999px;
  background: ${semantic.background.primary};
  box-shadow: ${CARD_SHADOW};
  font-size: 18px;
  color: ${semantic.text.primary};
  i {
    width: 30px;
    height: 30px;
    border-radius: 9999px;
    background: var(--landing-blue);
    flex-shrink: 0;
  }
  b {
    font-weight: ${fontWeight.bold};
  }
  span {
    color: ${semantic.text.secondary};
  }
  ${BP.md} {
    margin: 24px 0 0;
    font-size: 15px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 25px;
  margin-top: 45px;
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
  height: 240px;
  overflow: hidden;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
`;

const Big = styled.span`
  position: absolute;
  font-size: 62px;
  line-height: 68px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const From = styled.span`
  position: absolute;
  left: 30px;
  bottom: 46px;
  font-size: 20px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.tertiary};
`;

const Area = styled.svg`
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  width: 100%;
  height: 50%;
`;

const Bar = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: -1px;
  width: 43%;
  border-radius: 12px 12px 12px 0;
  background: ${semantic.background.brand};
`;

const Keys = styled.div<{ $top: string }>`
  position: absolute;
  left: 50%;
  top: ${(p) => p.$top};
  transform: translate(-50%, -50%);
  display: flex;
  gap: 12px;
  span {
    height: 112px;
    border-radius: 22px;
    border: 1px solid ${semantic.border.primary};
    background: ${semantic.background.secondary};
  }
`;

const Text = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 45px 30px 38px;
  text-align: center;
`;

const Claim = styled.h3`
  margin: 0;
  font-size: 20.3px;
  line-height: 26px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
  }
`;

const Src = styled.p`
  margin: 0;
  font-size: 15.8px;
  color: ${semantic.text.secondary};
  a {
    color: ${semantic.text.primary};
    text-decoration: underline;
  }
`;

const Quote = styled.blockquote`
  margin: 90px auto 0;
  max-width: 820px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 27px;
  svg {
    color: ${semantic.text.brand};
  }
  p {
    margin: 0;
    font-size: 33px;
    line-height: 42px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    text-wrap: balance;
  }
  mark {
    background: ${semantic.background.brand};
    color: ${semantic.text.onBrand};
    padding: 0 6px;
    border-radius: 6px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  ${BP.md} {
    margin-top: 45px;
    p {
      font-size: 24px;
      line-height: 32px;
    }
  }
`;

const Cite = styled.figcaption`
  display: flex;
  align-items: center;
  gap: 13.5px;
  font-style: normal;
  i {
    width: 45px;
    height: 45px;
    border-radius: 9999px;
    background: ${semantic.background.secondary};
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  b {
    display: block;
    font-size: 16px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    text-align: left;
  }
  span {
    font-size: 14px;
    color: ${semantic.text.secondary};
  }
`;

export function AiFrontPage() {
  return (
    <Wrap aria-labelledby="frontpage-title">
      <Container>
        <Head data-reveal>
          <div>
            <Eyebrow $tone="brand" style={{ marginBottom: 18 }}>{FRONTPAGE.eyebrow}</Eyebrow>
            <Title id="frontpage-title">
              {FRONTPAGE.titleLines.map((l, i) => (
                <React.Fragment key={l}>
                  {l}
                  {i === 0 ? <br /> : null}
                </React.Fragment>
              ))}
            </Title>
          </div>
          <Sub>
            {FRONTPAGE.sub}
            <span>{FRONTPAGE.subMuted}</span>
          </Sub>
        </Head>

        <PromptChip data-reveal>
          <i aria-hidden />
          {FRONTPAGE.promptChip.muted}
          <b>{FRONTPAGE.promptChip.strong}</b>
          {FRONTPAGE.promptChip.rest}
        </PromptChip>

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
                      <Big style={{ left: 30, top: 56 }} {...count}>{label}</Big>
                      {'from' in stat ? <From>{stat.from}</From> : null}
                      <Area viewBox="0 0 400 120" preserveAspectRatio="none">
                        <polygon points="0,120 0,92 84,92 400,4 400,120" fill="var(--landing-blue)" data-grow />
                      </Area>
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
                      <Keys $top="calc(50% - 122px)">
                        <span style={{ width: 130 }} />
                        <span style={{ width: 130 }} />
                        <span style={{ width: 80 }} />
                      </Keys>
                      <Keys $top="calc(50% + 122px)">
                        <span style={{ width: 130 }} />
                        <span style={{ width: 130 }} />
                        <span style={{ width: 80 }} />
                      </Keys>
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

        <Quote data-reveal>
          <Quotes size={40} weight="fill" aria-hidden />
          <p>
            {FRONTPAGE.quote.lead}
            <mark>{FRONTPAGE.quote.highlight}</mark>
          </p>
          <Cite>
            <i aria-hidden><img src="/favicon.svg" alt="" width={26} height={26} /></i>
            <div>
              <b>{FRONTPAGE.quote.name}</b>
              <span>{FRONTPAGE.quote.role}</span>
            </div>
          </Cite>
        </Quote>
      </Container>
    </Wrap>
  );
}

export default AiFrontPage;
