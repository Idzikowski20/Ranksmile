import React from 'react';
import styled from '@emotion/styled';
import { Play } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CARD_SHADOW, Container, Section } from '../../landing/primitives';
import { FEATURES, A } from '../content';

/*
 * Figma 5:119 — pt 27 pb 108 gap 27:
 *   row 1: two 706px cards (factors list + ranking svg · integrations)
 *   row 2: grid 1fr/2fr h 777 (briefs · languages with flag pills + 886×526 shot)
 *   row 3: grid 55fr/1fr h 1012 (Smily assistant + prompt chip cluster · Topics with 390×684 shot)
 */

const Wrap = styled(Section)`
  padding: 27px 0 108px;
  display: flex;
  flex-direction: column;
  gap: 27px;
`;

const Row = styled.div`
  display: flex;
  gap: 27px;
  ${BP.lg} {
    flex-direction: column;
  }
`;

const Card = styled.article`
  position: relative;
  display: flex;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  border-radius: 13.5px;
  background: ${semantic.background.tertiary};
`;

const Text = styled.div<{ $pb?: number }>`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 672px;
  padding: 54px 27px ${(p) => p.$pb ?? 54}px;
  box-sizing: border-box;
  flex-shrink: 0;
  h4 {
    margin: 0;
    font-size: 27px;
    line-height: 35.11px;
    letter-spacing: -0.72px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.primary};
    span.muted {
      color: ${semantic.text.secondary};
    }
    u {
      text-underline-position: from-font;
    }
  }
  p.eyebrow {
    font-size: 15.8px;
    line-height: 18.9px;
    font-weight: ${fontWeight.bold};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  ${BP.md} {
    padding: 27px 18px;
  }
`;

const List = styled.ul`
  margin: 0;
  padding: 9px 0 9px 22.5px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 18px;
  line-height: 27px;
  color: ${semantic.text.primary};
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
`;

const Art = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 540px;
  img {
    display: block;
    max-width: 100%;
  }
`;

const Grid = styled.div<{ $cols: string; $h: number }>`
  display: grid;
  grid-template-columns: ${(p) => p.$cols};
  gap: 27px;
  min-height: ${(p) => p.$h}px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    min-height: 0;
  }
`;

const Col = styled(Card)`
  flex-direction: column;
`;

const Flags = styled.div`
  display: flex;
  gap: 8px;
  padding: 0 27px;
  overflow: hidden;
  span {
    display: inline-flex;
    align-items: center;
    gap: 13.5px;
    padding: 13.5px 27px 13.5px 13.5px;
    border-radius: 180px;
    border: 1px solid ${semantic.border.secondary};
    font-size: 18px;
    line-height: 18px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
    white-space: nowrap;
    img {
      width: 36px;
      height: 36px;
      border-radius: 999px;
    }
    &:first-of-type {
      border-color: ${semantic.text.primary};
    }
  }
`;

const Shot = styled.div`
  padding: 36px 27px 0;
  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 9px 9px 0 0;
  }
`;

const ExplainerBtn = styled.a`
  margin-top: 36px;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 27px;
  padding: 9px 27px 9px 9px;
  border-radius: 13.5px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  text-decoration: none;
  font-size: 19.8px;
  line-height: 19.8px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.tertiary};
  span {
    position: relative;
    width: 96px;
    height: 54px;
    overflow: hidden;
    border-radius: 9px;
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    i {
      position: absolute;
      left: 50%;
      top: 12px;
      width: 30px;
      height: 30px;
      transform: translateX(-50%);
      border-radius: 999px;
      background: ${semantic.background.primary};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${semantic.text.primary};
    }
  }
`;

/* Prompt chip cluster — 99px pills, three tones, placed from the card's centre+218px as in Figma. */
const Chips = styled.div`
  position: absolute;
  left: 27px;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 27px;
  padding: 0 0 27px 27px;
  ${BP.lg} {
    position: static;
    padding: 0 27px 27px;
    flex-wrap: wrap;
    flex-direction: row;
  }
`;

const ChipRow = styled.div<{ $indent?: boolean }>`
  display: flex;
  align-items: center;
  gap: 18px;
  padding-left: ${(p) => (p.$indent ? '18px' : '0')};
`;

const CHIP_BG = { a: semantic.background.secondary, b: semantic.background.primary, c: semantic.background.inverse } as const;
const CHIP_FG = { a: semantic.text.primary, b: semantic.text.primary, c: semantic.text.onInverse } as const;

const Chip = styled.div<{ $tone: keyof typeof CHIP_BG }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 99px;
  box-sizing: border-box;
  padding: 18px 36px;
  border-radius: 18px;
  border: 1px solid ${semantic.border.primary};
  background: ${(p) => CHIP_BG[p.$tone]};
  color: ${(p) => CHIP_FG[p.$tone]};
  box-shadow: ${CARD_SHADOW};
  font-size: 18px;
  line-height: 27px;
  white-space: nowrap;
  opacity: 0.9;
  span:first-of-type {
    opacity: 0.6;
  }
`;

const SmilyMark = styled.img`
  width: 99px;
  height: 99px;
  border-radius: 18px;
  object-fit: cover;
`;

const TopicsImg = styled.img`
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 390.55px;
  height: 684px;
  transform: translateX(-50%);
  object-fit: cover;
  object-position: top;
`;

/* ", " between items, " or " before the last, "." after it — the reference sentence punctuation. */
function sep(i: number, n: number): string {
  if (i === n - 1) return '.';
  if (i === n - 2) return ' or ';
  return ', ';
}

export function CeFeatures() {
  const { factors, integrations, briefs, languages, smily, topics } = FEATURES;
  const chips = smily.prompts;
  return (
    <Wrap aria-label="Content Editor features">
      <Container>
        <Row>
          <Card data-reveal style={{ width: 706.61, maxWidth: '100%' }}>
            <Text>
              <h4>
                {factors.title[0]}
                <br />
                {factors.title[1]}
              </h4>
              <List>
                {factors.items.map((i) => <li key={i}>{i}</li>)}
              </List>
            </Text>
            <Art aria-hidden>
              <img loading="lazy" decoding="async" src={`${A}/ranking-factors.svg`} alt="" width={385} height={385} />
            </Art>
          </Card>
          <Card data-reveal style={{ width: 706.63, maxWidth: '100%' }}>
            <Text>
              <h4>{integrations.title}</h4>
              <p>
                <span className="muted">{integrations.lead}</span>
                {integrations.links.map((l, i) => (
                  <React.Fragment key={l}>
                    <u>{l}</u>
                    {sep(i, integrations.links.length)}
                  </React.Fragment>
                ))}
              </p>
              <p><span className="muted">{integrations.muted}</span></p>
            </Text>
            <Art aria-hidden style={{ flexWrap: 'wrap', gap: 18, padding: 36 }}>
              {['engine-chatgpt.svg', 'engine-google.png', 'engine-gemini.png', 'engine-perplexity.svg', 'engine-aioverview.svg'].map((f) => (
                <img loading="lazy" decoding="async"
                  key={f}
                  src={`/ai-tracking/${f}`}
                  alt=""
                  width={54}
                  height={54}
                  style={{
                    padding: 12,
                    borderRadius: 999,
                    border: `1px solid ${semantic.border.primary}`,
                    background: semantic.background.primary,
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </Art>
          </Card>
        </Row>

        <Grid $cols="minmax(0, 1fr) minmax(0, 2fr)" $h={777.44} style={{ marginTop: 27 }}>
          <Col data-reveal>
            <Text $pb={170}>
              <h4>
                {briefs.title[0]}
                <br />
                {briefs.title[1]}
              </h4>
              <p>{briefs.body}</p>
            </Text>
            <Art style={{ padding: '36px 36px 0', alignItems: 'flex-end' }} aria-hidden>
              <img loading="lazy" decoding="async" src={`${A}/briefs.png`} alt="" width={437} height={364} />
            </Art>
          </Col>
          <Col data-reveal>
            <Text>
              <h4>{languages.title}</h4>
              <p>{languages.body}</p>
            </Text>
            <Flags aria-hidden>
              {languages.flags.map((f) => (
                <span key={f.code}>
                  <img loading="lazy" decoding="async" src={`${A}/flag-${f.code}.png`} alt="" width={36} height={36} />
                  {f.label}
                </span>
              ))}
            </Flags>
            <Shot>
              <img src={`${A}/languages.png`} alt="Content Editor guidelines in English" width={886} height={526} loading="lazy" />
            </Shot>
          </Col>
        </Grid>

        <Grid $cols="minmax(0, 1fr) 444.08px" $h={1012} style={{ marginTop: 27 }}>
          <Col data-reveal>
            <Text>
              <p className="eyebrow">{smily.eyebrow}</p>
              <h4>{smily.title}</h4>
              {smily.paras.map((para, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <p key={i}>
                  {para.map((seg, j) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <span key={j} className={'s' in seg && seg.s ? undefined : 'muted'}>{seg.t}</span>
                  ))}
                </p>
              ))}
              <ExplainerBtn href="#write">
                <span>
                  <img loading="lazy" decoding="async" src={`${A}/surfy-ce.png`} alt="" width={96} height={54} />
                  <i aria-hidden><Play size={14} weight="fill" /></i>
                </span>
                {smily.cta}
              </ExplainerBtn>
            </Text>
            <div style={{ position: 'relative', height: 504, maxHeight: 540, overflow: 'hidden' }}>
              <Chips aria-hidden>
                <ChipRow>
                  <Chip $tone="a"><span>/AskSmily</span><span>{chips[0]}</span></Chip>
                  <Chip $tone="b"><span>/AskSmily</span><span>{chips[1]}</span></Chip>
                </ChipRow>
                <ChipRow $indent>
                  <Chip $tone="a"><span>/AskSmily</span><span>{chips[2]}</span></Chip>
                  <Chip $tone="b" style={{ width: 455 }}><span /></Chip>
                </ChipRow>
                <ChipRow>
                  <SmilyMark src="/favicon.svg" alt="" />
                  <Chip $tone="c"><span>/AskSmily</span><span>{chips[3]}</span></Chip>
                  <Chip $tone="b"><span>/AskSmily</span><span>{chips[4]}</span></Chip>
                </ChipRow>
                <ChipRow $indent>
                  <Chip $tone="b"><span>/AskSmily</span><span>{chips[5]}</span></Chip>
                  <Chip $tone="a"><span>/AskSmily</span><span>{chips[6]}</span></Chip>
                </ChipRow>
              </Chips>
            </div>
          </Col>
          <Col data-reveal style={{ position: 'relative' }}>
            <Text $pb={218}>
              <p className="eyebrow">{topics.eyebrow}</p>
              <h4>{topics.title}</h4>
              <p>
                {topics.lead}
                <span className="muted">{topics.muted}</span>
              </p>
            </Text>
            <div style={{ position: 'relative', height: 540 }}>
              <TopicsImg src={`${A}/topics.png`} alt="" loading="lazy" aria-hidden />
            </div>
          </Col>
        </Grid>
      </Container>
    </Wrap>
  );
}

export default CeFeatures;
