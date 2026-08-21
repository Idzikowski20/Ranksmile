import React from 'react';
import styled from '@emotion/styled';
import { Plus } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { shadow } from '../../koala/tokens/effects';
import { BP, Container, Section } from '../../landing/primitives';
import { FAQ_LEFT, FAQ_RIGHT } from '../content';

/*
 * Figma 3:9658 — py 126, px 27; two blocks gap 108: sticky 360px title (35.8 / 45px) + list at 468px.
 * Items: 20.7/31 medium, 36px plus icon (rotated 45° when open), rows pt 22.5 pb 9, hairline borders.
 */

const Wrap = styled(Section)`
  padding: 126px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Block = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 468px minmax(0, 1fr);
  & + & {
    margin-top: 108px;
  }
  ${BP.lg} {
    grid-template-columns: 1fr;
    gap: 27px;
    & + & {
      margin-top: 72px;
    }
  }
`;

const Title = styled.h2<{ $big?: boolean }>`
  margin: 0;
  position: sticky;
  top: 120px;
  align-self: start;
  width: 360px;
  font-size: ${(p) => (p.$big ? '45px' : '35.8px')};
  line-height: ${(p) => (p.$big ? '54px' : '42.93px')};
  letter-spacing: ${(p) => (p.$big ? '-1.08px' : '0')};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.lg} {
    position: static;
    width: auto;
  }
  ${BP.md} {
    font-size: 28px;
    line-height: 34px;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.details`
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding: 22.5px 0 9px;
  &:first-of-type {
    padding-top: 0;
  }
  summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 36px;
    cursor: var(--koala-cursor-pointing);
    font-size: 20.7px;
    line-height: 31px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
    &::-webkit-details-marker {
      display: none;
    }
    &:focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: 8px;
    }
    svg {
      flex-shrink: 0;
      color: ${semantic.text.primary};
      transition: transform var(--motion-normal) var(--motion-ease-standard);
    }
  }
  &[open] summary {
    color: ${semantic.text.brand};
  }
  &[open] summary svg {
    transform: rotate(45deg);
    color: ${semantic.text.brand};
  }
  .answer {
    padding: 9px 0 18px;
    font-size: 18px;
    line-height: 32.41px;
    color: ${semantic.text.primary};
    p {
      margin: 0;
    }
    ul {
      margin: 9px 0 0;
      padding-left: 22.5px;
      display: flex;
      flex-direction: column;
      gap: 4.5px;
      li {
        font-size: 18px;
        line-height: 27px;
        b {
          font-weight: ${fontWeight.bold};
        }
      }
    }
  }
`;

type Faq = { q: string; a: string; bullets?: readonly { strong: string; rest: string }[] };

function FaqList({ items, openFirst }: { items: readonly Faq[]; openFirst?: boolean }) {
  return (
    <List>
      {items.map((item, i) => (
        <Item key={item.q} open={openFirst && i === 0}>
          <summary>
            <h3 style={{ margin: 0, font: 'inherit' }}>{item.q}</h3>
            <Plus size={36} weight="regular" aria-hidden />
          </summary>
          <div className="answer">
            <p>{item.a}</p>
            {item.bullets ? (
              <ul>
                {item.bullets.map((b) => (
                  <li key={b.strong}>
                    <b>{b.strong}</b>
                    {b.rest}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Item>
      ))}
    </List>
  );
}

export function AiFaq() {
  return (
    <Wrap id="faq" aria-labelledby="faq-title">
      <Container>
        <Block data-reveal>
          <Title id="faq-title">
            Frequently
            <br />
            Asked Questions
          </Title>
          <FaqList items={FAQ_LEFT} openFirst />
        </Block>
        <Block data-reveal>
          <Title $big>
            Features &amp;
            <br />
            Capabilities
          </Title>
          <FaqList items={FAQ_RIGHT} />
        </Block>
      </Container>
    </Wrap>
  );
}

export default AiFaq;
