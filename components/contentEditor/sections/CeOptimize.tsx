import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { OPTIMIZE, PUBLISH, A } from '../content';

/*
 * Figma 5:365 — 1893px rounded-27 white→#f4f4f5 panel, px 226 → 1440 column:
 *   Optimize: head (20.3 eyebrow · 45px H3) gap 108 → purple 864 card (27px H5 + 18 body + 810×438 shot)
 *             + 549 column of two white cards (Internal Links · Humanizer)
 *   Publish:  head → dark 706 card (Plagiarism + 280×259 art) + white 706 (Collab + 276×208 art)
 *             → full-width card (714×304 shot + two text columns)
 */

const Panel = styled.div`
  margin: 0 13.5px;
  overflow: hidden;
  border-radius: 27px;
  border: 1px solid ${semantic.border.primary};
  background: linear-gradient(to bottom, ${semantic.background.primary}, ${semantic.background.secondary});
`;

const Block = styled.div<{ $first?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 108px;
  padding: ${(p) => (p.$first ? '125px 0 126px' : '0 0 126px')};
  ${BP.md} {
    gap: 45px;
    padding: ${(p) => (p.$first ? '72px 0' : '0 0 72px')};
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 26px;
  max-width: 990px;
  padding: 0 27px;
  p {
    margin: 0;
    font-size: 20.3px;
    line-height: 20.25px;
    font-weight: ${fontWeight.medium};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  h3 {
    margin: 0;
    font-size: 45px;
    line-height: 54px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    padding: 0;
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
`;

const Row = styled.div`
  display: flex;
  gap: 27px;
  align-items: stretch;
  ${BP.lg} {
    flex-direction: column;
  }
`;

const CARD_BG = {
  blue: 'var(--landing-blue)',
  dark: semantic.background.tertiary,
  white: semantic.background.primary,
} as const;

const Card = styled.article<{ $tone?: keyof typeof CARD_BG; $w?: number }>`
  position: relative;
  display: flex;
  overflow: hidden;
  width: ${(p) => (p.$w ? `${p.$w}px` : 'auto')};
  max-width: 100%;
  flex: ${(p) => (p.$w ? '0 0 auto' : '1')};
  border-radius: 13.5px;
  border: 1px solid ${(p) => (p.$tone === 'blue' ? 'var(--landing-blue)' : semantic.border.primary)};
  background: ${(p) => CARD_BG[p.$tone ?? 'white']};
  color: ${(p) => (p.$tone === 'blue' ? '#fff' : semantic.text.primary)};
  ${BP.lg} {
    width: auto;
    flex: 1;
  }
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 672px;
  padding: 54px 27px;
  box-sizing: border-box;
  h5,
  h4 {
    margin: 0;
    font-size: 27px;
    line-height: 35.11px;
    letter-spacing: -0.72px;
    font-weight: ${fontWeight.bold};
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
  }
  p.muted {
    opacity: 0.6;
  }
  .more {
    font-size: 18px;
    line-height: 18px;
    font-weight: ${fontWeight.bold};
    color: inherit;
    text-decoration: none;
    white-space: nowrap;
  }
  ${BP.md} {
    padding: 27px 18px;
  }
`;

const Col = styled(Card)`
  flex-direction: column;
`;

const Shot = styled.div`
  display: flex;
  justify-content: center;
  max-height: 540px;
  img {
    display: block;
    width: 810px;
    max-width: 100%;
    height: auto;
    border-radius: 9px 9px 0 0;
  }
`;

const Art = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 27px 36px;
  img {
    display: block;
    max-width: 100%;
    height: auto;
  }
  ${BP.md} {
    padding: 0 18px 18px;
  }
`;

const Wide = styled(Card)`
  align-items: flex-end;
  gap: 9px;
  > img {
    width: 714.61px;
    max-width: 50%;
    height: auto;
    flex-shrink: 0;
  }
  ${BP.lg} {
    flex-direction: column;
    align-items: stretch;
    > img {
      max-width: 100%;
    }
  }
`;

export function CeOptimize() {
  return (
    <Section aria-label="Optimize and publish">
      <Panel>
        <Container>
          <Block $first>
            <Head data-reveal>
              <p>{OPTIMIZE.eyebrow}</p>
              <h3>
                {OPTIMIZE.titleLines[0]}
                <br />
                {OPTIMIZE.titleLines[1]}
              </h3>
            </Head>
            <Row>
              <Col $tone="blue" $w={864.14} data-reveal>
                <Text style={{ maxWidth: 672, minHeight: 331 }}>
                  <h5>
                    {OPTIMIZE.auto.title[0]}
                    <br />
                    {OPTIMIZE.auto.title[1]}
                  </h5>
                  <p>{OPTIMIZE.auto.body}</p>
                </Text>
                <Shot>
                  <img src={`${A}/auto-optimize.png`} alt="Auto-Optimize suggestions inside Content Editor" width={810} height={438} loading="lazy" />
                </Shot>
              </Col>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 27, width: 549, maxWidth: '100%', flex: '1 1 auto',
              }}
              >
                <Col $tone="white" data-reveal style={{ flex: 1, justifyContent: 'center' }}>
                  <Text>
                    <h4>{OPTIMIZE.links.title}</h4>
                    <p className="muted">{OPTIMIZE.links.body}</p>
                  </Text>
                </Col>
                <Col $tone="white" data-reveal style={{ flex: 1, justifyContent: 'center' }}>
                  <Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <h4>{OPTIMIZE.humanizer.title}</h4>
                      <a className="more" href="#write">{OPTIMIZE.humanizer.more}</a>
                    </div>
                    <p className="muted">{OPTIMIZE.humanizer.body}</p>
                  </Text>
                </Col>
              </div>
            </Row>
          </Block>

          <Block>
            <Head data-reveal>
              <p>{PUBLISH.eyebrow}</p>
              <h3>
                {PUBLISH.titleLines[0]}
                <br />
                {PUBLISH.titleLines[1]}
              </h3>
            </Head>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 27 }}>
              <Row>
                <Card $tone="dark" $w={706.61} data-reveal>
                  <Text>
                    <h4>{PUBLISH.confidence.title}</h4>
                    <p>{PUBLISH.confidence.body}</p>
                  </Text>
                  <Art aria-hidden>
                    <img src={`${A}/plagiarism.png`} alt="" width={280} height={259} loading="lazy" />
                  </Art>
                </Card>
                <Card $tone="white" $w={706.63} data-reveal>
                  <Text>
                    <h4>
                      {PUBLISH.collab.title[0]}
                      <br />
                      {PUBLISH.collab.title[1]}
                    </h4>
                    <p className="muted">{PUBLISH.collab.body}</p>
                  </Text>
                  <Art aria-hidden>
                    <img src={`${A}/collab-avatars.png`} alt="" width={276} height={208} loading="lazy" />
                  </Art>
                </Card>
              </Row>
              <Wide $tone="white" data-reveal>
                <img
                  src={`${A}/collab-wordpress.png`}
                  alt="Sharing and WordPress publishing controls in Content Editor"
                  width={715}
                  height={305}
                  loading="lazy"
                />
                <Text style={{ paddingBottom: 81 }}>
                  <h4>
                    {PUBLISH.wordpress.title[0]}
                    <br />
                    {PUBLISH.wordpress.title[1]}
                  </h4>
                  <p className="muted">{PUBLISH.wordpress.body}</p>
                </Text>
                <Text>
                  <h4>
                    {PUBLISH.share.title[0]}
                    <br />
                    {PUBLISH.share.title[1]}
                  </h4>
                  <p className="muted">{PUBLISH.share.body}</p>
                </Text>
              </Wide>
            </div>
          </Block>
        </Container>
      </Panel>
    </Section>
  );
}

export default CeOptimize;
