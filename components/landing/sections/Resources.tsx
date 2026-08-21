import React from 'react';
import styled from '@emotion/styled';
import { ArrowUpRight, BookOpen } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, CARD_SHADOW, Container, Section, Tag } from '../primitives';
import { RESOURCES_BOTTOM, RESOURCES_TOP } from '../content';

/* Figma 1:3545 — py 126, gap 54; cards p 27 radius 18; row 1 equal thirds, row 2 four × 339.8. */

const Wrap = styled(Section)`
  padding: 126px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Head = styled.div`
  max-width: 990px;
  padding: 0 27px;
  margin-bottom: 54px;
  h2 {
    margin: 27px 0 0;
    font-size: 45px;
    line-height: 54px;
    letter-spacing: -1.08px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    text-wrap: balance;
  }
  ${BP.md} {
    padding: 0;
    h2 {
      font-size: 32px;
      line-height: 38px;
    }
  }
`;

const Row = styled.div<{ $cols: 3 | 4 }>`
  display: grid;
  grid-template-columns: ${(p) => (p.$cols === 3 ? 'repeat(3, 1fr)' : 'repeat(4, minmax(0, 339.8px))')};
  justify-content: center;
  gap: 27px;
  & + & {
    margin-top: 27px;
  }
  ${BP.lg} {
    grid-template-columns: repeat(2, 1fr);
  }
  ${BP.sm} {
    grid-template-columns: 1fr;
  }
`;

const TONE_BG = {
  brand: 'var(--koala-bg-brand)',
  blue: 'var(--landing-blue)',
  photo: 'linear-gradient(160deg, var(--landing-blue) 0%, #1e2a5a 55%, var(--koala-bg-inverse) 100%)',
  plain: 'var(--koala-bg-primary)',
} as const;

const Card = styled.a<{ $tone: keyof typeof TONE_BG; $gap?: number }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 45}px;
  padding: 27px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid ${(p) => (p.$tone === 'plain' ? semantic.border.primary : 'transparent')};
  background: ${(p) => TONE_BG[p.$tone]};
  color: ${(p) => (p.$tone === 'brand' ? 'var(--koala-bg-inverse)' : p.$tone === 'plain' ? semantic.text.primary : '#fff')};
  text-decoration: none;
  transition: transform var(--motion-normal) var(--motion-ease-out), box-shadow var(--motion-normal) var(--motion-ease-out);
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${CARD_SHADOW};
  }
  &:focus-visible {
    outline: 2px solid ${semantic.border.focus};
    outline-offset: 3px;
  }
`;

const CardTop = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Label = styled.span<{ $muted?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px 7.2px;
  border-radius: 90px;
  border: 1px solid ${(p) => (p.$muted ? semantic.border.primary : 'transparent')};
  background: ${(p) => (p.$muted ? semantic.background.secondary : semantic.background.inverse)};
  color: ${(p) => (p.$muted ? semantic.text.primary : semantic.text.onInverse)};
  font-size: 15.8px;
  line-height: 18.9px;
  font-weight: ${fontWeight.medium};
  text-transform: uppercase;
`;

const ArrowBtn = styled.span`
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  border: 1px solid ${semantic.border.strong};
  background: ${semantic.background.inverse};
  color: ${semantic.text.onInverse};
`;

const Art = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 406.08 / 228.41;
`;

const Shot = styled.div<{ $inset: number; $top: number }>`
  position: absolute;
  left: ${(p) => p.$inset}px;
  right: ${(p) => p.$inset}px;
  top: ${(p) => p.$top}px;
  bottom: 0;
  overflow: hidden;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.35);
  background: ${semantic.background.primary};
  box-shadow: ${CARD_SHADOW};
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  color: ${semantic.text.primary};
  font-size: 12px;
  i {
    display: block;
    height: 8px;
    border-radius: 4px;
    background: ${semantic.background.secondary};
  }
  b {
    font-weight: ${fontWeight.bold};
    font-size: 14px;
  }
`;

const Text = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 13.5px;
  h3 {
    margin: 0;
    font-size: 22.5px;
    line-height: 27px;
    letter-spacing: -0.36px;
    font-weight: ${fontWeight.bold};
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    opacity: 0.92;
  }
`;

const MutedText = styled(Text)`
  p {
    color: ${semantic.text.secondary};
    opacity: 1;
  }
`;

const PhotoFade = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.75) 83%);
`;

const PhotoGrid = styled.div`
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 36px 36px;
`;

export function Resources() {
  return (
    <Wrap id="resources" aria-labelledby="resources-title">
      <Container>
        <Head data-reveal>
          <Tag style={{ fontWeight: 500, lineHeight: '20.25px' }}>Resources</Tag>
          <h2 id="resources-title">
            Explore, absorb and upskill with Ranksmile. Start now and supercharge the way you create content
            that ranks and gets cited.
          </h2>
        </Head>

        <Row $cols={3}>
          {RESOURCES_TOP.map((r) => (
            <Card key={r.tag} href={r.href} $tone={r.tone} data-reveal style={r.art === 'photo' ? { minHeight: 520, justifyContent: 'space-between' } : undefined}>
              {r.art === 'photo' ? (
                <>
                  <PhotoGrid aria-hidden />
                  <PhotoFade aria-hidden />
                </>
              ) : null}
              <CardTop>
                <Label>
                  <BookOpen size={22.5} weight="fill" aria-hidden />
                  {r.tag}
                </Label>
                <ArrowBtn aria-hidden><ArrowUpRight size={22.5} weight="bold" /></ArrowBtn>
              </CardTop>
              {r.art === 'stack' ? (
                <Art aria-hidden>
                  <Shot $inset={40.4} $top={-13.36}><i /><i style={{ width: '60%' }} /></Shot>
                  <Shot $inset={20.2} $top={-6.68}><i /><i style={{ width: '70%' }} /></Shot>
                  <Shot $inset={0} $top={0}>
                    <b>Publish to WordPress</b>
                    <i style={{ width: '80%' }} />
                    <i />
                    <i style={{ width: '55%' }} />
                    <i style={{ width: '90%' }} />
                  </Shot>
                </Art>
              ) : null}
              {r.art === 'image' ? (
                <Art aria-hidden>
                  <Shot $inset={0} $top={0}>
                    <b># Ranksmile</b>
                    <i style={{ width: '92%' }} />
                    <i style={{ width: '70%' }} />
                    <i style={{ width: '84%' }} />
                    <i style={{ width: '40%' }} />
                    <i style={{ width: '76%' }} />
                  </Shot>
                </Art>
              ) : null}
              <Text>
                {r.title ? <h3>{r.title}</h3> : null}
                <p>{r.body}</p>
              </Text>
            </Card>
          ))}
        </Row>

        <Row $cols={4}>
          {RESOURCES_BOTTOM.map((r) => (
            <Card key={r.tag} href={r.href} $tone="plain" $gap={r.gap} data-reveal>
              <CardTop>
                <Label $muted>
                  <BookOpen size={22.5} weight="fill" aria-hidden />
                  {r.tag}
                </Label>
                <ArrowBtn aria-hidden><ArrowUpRight size={22.5} weight="bold" /></ArrowBtn>
              </CardTop>
              <MutedText>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </MutedText>
            </Card>
          ))}
        </Row>
      </Container>
    </Wrap>
  );
}

export default Resources;
