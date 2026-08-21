import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section, Tag } from '../../landing/primitives';
import { CAPABILITIES } from '../content';

/* Figma 3:4896 — px 27 head (tag · 55.2 H2, 990 wide); 4 cards 353×381 r13.5, icon 45 at (45,72), text at 236. */

const Wrap = styled(Section)`
  padding: 179px 0 180px;
  ${BP.md} {
    padding: 72px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 27px;
  max-width: 990px;
  padding: 0 27px;
  margin-bottom: 90px;
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 0;
    margin-bottom: 45px;
    h2 {
      font-size: 36px;
      line-height: 42px;
    }
  }
`;

const Grid = styled.div`
  display: flex;
  justify-content: center;
  gap: 9px;
  padding-top: 76px;
  ${BP.lg} {
    flex-wrap: wrap;
    padding-top: 0;
  }
`;

const Card = styled.article`
  position: relative;
  width: 353.3px;
  height: 381.16px;
  box-sizing: border-box;
  border: 1px solid ${semantic.border.primary};
  border-radius: 13.5px;
  background: ${semantic.background.tertiary};
  transition: transform var(--motion-normal) var(--motion-ease-out), box-shadow var(--motion-normal) var(--motion-ease-out);
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 24px 68px rgba(47,48,55,0.08);
  }
  ${BP.lg} {
    width: calc(50% - 4.5px);
  }
  ${BP.sm} {
    width: 100%;
    height: auto;
    min-height: 300px;
  }
`;

const Icon = styled.img`
  position: absolute;
  left: 45px;
  top: 72px;
  width: 45px;
  height: 45px;
`;

const Text = styled.p`
  position: absolute;
  left: 45px;
  right: 45px;
  top: 236px;
  margin: 0;
  font-size: 23.2px;
  line-height: 29px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  strong {
    color: ${semantic.text.primary};
  }
  ${BP.sm} {
    position: static;
    padding: 140px 27px 27px;
  }
`;

export function AiCapabilities() {
  return (
    <Wrap aria-labelledby="capabilities-title">
      <Container>
        <Head data-reveal>
          <Tag>{CAPABILITIES.eyebrow}</Tag>
          <h2 id="capabilities-title">{CAPABILITIES.title}</h2>
        </Head>
        <Grid>
          {CAPABILITIES.cards.map((card, i) => (
            <Card key={card.strong} data-reveal>
              <Icon src={`/ai-tracking/cap-icon-${i + 1}.svg`} alt="" width={45} height={45} />
              <Text>
                <strong>{card.strong}</strong>
                {card.body}
              </Text>
            </Card>
          ))}
        </Grid>
      </Container>
    </Wrap>
  );
}

export default AiCapabilities;
