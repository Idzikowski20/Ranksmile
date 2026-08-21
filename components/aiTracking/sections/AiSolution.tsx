import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section, Tag } from '../../landing/primitives';
import { SOLUTION } from '../content';

/* Figma 3:4675 — py 180, gap 90; head 990 wide (tag · 55.2 H2 · 24.7 sub); 3 cards 426×511 r27 + caption. */

const Wrap = styled(Section)`
  padding: 180px 0;
  border-radius: 27px 27px 0 0;
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
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p {
    margin: 0;
    font-size: 24.7px;
    line-height: 37px;
    color: ${semantic.text.secondary};
  }
  ${BP.md} {
    margin-bottom: 45px;
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
    p {
      font-size: 18px;
      line-height: 28px;
    }
  }
`;

const Grid = styled.div`
  display: flex;
  justify-content: center;
  gap: 0;
  ${BP.md} {
    flex-direction: column;
    gap: 36px;
  }
`;

const Card = styled.article`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 49px;
  padding: 27px 27px 0;
  ${BP.md} {
    padding: 0;
    gap: 27px;
  }
`;

const Art = styled.div`
  aspect-ratio: 426.08 / 511.28;
  border-radius: 27px;
  overflow: hidden;
  background: ${semantic.background.secondary};
  border: 1px solid ${semantic.border.primary};
  img {
    display: block;
    width: 100%;
    height: 102.18%;
    margin-top: -1.09%;
    object-fit: cover;
  }
`;

const Caption = styled.p`
  margin: 0;
  padding: 36px 27px;
  text-align: center;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 0;
  }
`;

const IMAGES = ['/ai-tracking/solution-01.png', '/ai-tracking/solution-02.png', '/ai-tracking/solution-03.png'];

export function AiSolution() {
  return (
    <Wrap id="solution" aria-labelledby="ai-solution-title">
      <Container>
        <Head data-reveal>
          <Tag>{SOLUTION.eyebrow}</Tag>
          <h2 id="ai-solution-title">
            {SOLUTION.titleLines[0]}
            <br />
            {SOLUTION.titleLines[1]}
          </h2>
          <p>{SOLUTION.sub}</p>
        </Head>

        <Grid>
          {SOLUTION.cards.map((card, i) => (
            <Card key={card.strong} data-reveal>
              <Art>
                <img src={IMAGES[i]} alt="" loading="lazy" width={426} height={511} />
              </Art>
              <Caption>
                <strong>{card.strong}</strong>
                {card.body}
              </Caption>
            </Card>
          ))}
        </Grid>
      </Container>
    </Wrap>
  );
}

export default AiSolution;
