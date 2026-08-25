import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section, Tag } from '../../landing/primitives';
import { AUDIENCE } from '../content';

/* Figma 3:4929 — head py 126 (tag · 55.2 H2); 1466×810 photo r27; 35.8px paragraph py 180. */

const Wrap = styled(Section)`
  border-radius: 0 0 27px 27px;
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  padding: 126px 0;
  text-align: center;
  h2 {
    margin: 0;
    font-size: 55.2px;
    line-height: 60.67px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 72px 0 45px;
    h2 {
      font-size: 34px;
      line-height: 40px;
    }
  }
`;

const Photo = styled.div`
  width: min(1466.78px, 100%);
  margin: 0 auto;
  aspect-ratio: 1466.78 / 810.13;
  border-radius: 27px;
  overflow: hidden;
  background: ${semantic.background.secondary};
  img {
    display: block;
    width: 100%;
    height: 120.7%;
    margin-top: -9.32%;
    object-fit: cover;
  }
`;

const Body = styled.p`
  max-width: 1100px;
  margin: 0 auto;
  padding: 180px 0;
  text-align: center;
  font-size: 35.8px;
  line-height: 42.93px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.secondary};
  text-wrap: balance;
  b {
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 54px 0 72px;
    font-size: 22px;
    line-height: 30px;
  }
`;

export function AiAudience() {
  return (
    <Wrap aria-labelledby="audience-title">
      <Container>
        <Head data-reveal>
          <Tag>{AUDIENCE.eyebrow}</Tag>
          <h2 id="audience-title">
            {AUDIENCE.titleLines[0]}
            <br />
            {AUDIENCE.titleLines[1]}
          </h2>
        </Head>
      </Container>
      <Container style={{ maxWidth: 1520 }}>
        <Photo data-reveal>
          <img src="/ai-tracking/audience-team.png" alt="A marketing team working together at a table" loading="lazy" width={1466} height={810} />
        </Photo>
      </Container>
      <Container>
        <Body data-reveal>
          {AUDIENCE.body}
          {' '}
          {AUDIENCE.groups.map((g) => (
            <React.Fragment key={g.label}>
              <b>{g.label}</b>
              {g.body}
              {' '}
            </React.Fragment>
          ))}
        </Body>
      </Container>
    </Wrap>
  );
}

export default AiAudience;
