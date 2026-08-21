import React from 'react';
import styled from '@emotion/styled';
import { Plus } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { BP, Container, Section } from '../../landing/primitives';
import { FAQ_LEFT, FAQ_RIGHT } from '../content';

/* Figma 3:9658 — "Frequently Asked Questions" + "Features & Capabilities", both with a sticky
   left title and a right accordion list. */

const Wrap = styled(Section)`
  padding: 126px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Block = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 64px;
  & + & {
    margin-top: 90px;
  }
  ${BP.lg} {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const Title = styled.h2`
  margin: 0;
  align-self: start;
  font-size: 35.8px;
  line-height: 42.93px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.lg} {
    position: static;
  }
  ${BP.md} {
    font-size: 28px;
    line-height: 34px;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${semantic.border.primary};
`;

const Item = styled.details`
  border-bottom: 1px solid ${semantic.border.primary};
  summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 4px;
    cursor: var(--koala-cursor-pointing);
    font-size: 18px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
    &::-webkit-details-marker {
      display: none;
    }
    &:focus-visible {
      outline: none;
      box-shadow: ${shadow.focus};
      border-radius: ${radius.sm};
    }
    svg {
      flex-shrink: 0;
      color: ${semantic.text.tertiary};
      transition: transform var(--motion-normal) var(--motion-ease-standard);
    }
  }
  &[open] summary svg {
    transform: rotate(45deg);
  }
  &[open] summary {
    color: ${semantic.text.brand};
  }
  p {
    margin: 0;
    padding: 0 4px 22px;
    max-width: 640px;
    font-size: 16px;
    line-height: 25px;
    color: ${semantic.text.secondary};
  }
`;

function FaqList({ items, openFirst }: { items: readonly { q: string; a: string }[]; openFirst?: boolean }) {
  return (
    <List>
      {items.map((item, i) => (
        <Item key={item.q} open={openFirst && i === 0}>
          <summary>
            <h3 style={{ margin: 0, font: 'inherit' }}>{item.q}</h3>
            <Plus size={18} weight="bold" aria-hidden />
          </summary>
          <p>{item.a}</p>
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
          <Title>
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
