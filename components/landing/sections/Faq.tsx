import React from 'react';
import styled from '@emotion/styled';
import { Plus } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../../koala/tokens/typography';
import { radius, shadow } from '../../koala/tokens/effects';
import { media } from '../../koala/tokens/breakpoints';
import { Container, Eyebrow, H2, Lead, Section, TextLink } from '../primitives';
import { FAQ, SUPPORT_EMAIL } from '../content';

const Grid = styled.div`
  display: grid;
  gap: 40px;
  ${media.lg} {
    grid-template-columns: 1fr 1.6fr;
    gap: 64px;
  }
`;

const Sticky = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: flex-start;
  ${media.lg} {
    position: sticky;
    top: 96px;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${semantic.border.primary};
`;

/* Native <details>: keyboard + screen-reader support for free, zero JS. */
const Item = styled.details`
  border-bottom: 1px solid ${semantic.border.primary};
  font-family: ${typeface.body};
  summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 4px;
    font-size: ${textScale.lg.fontSize};
    font-weight: ${fontWeight.medium};
    letter-spacing: -0.01em;
    color: ${semantic.text.primary};
    cursor: var(--koala-cursor-pointing);
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
  p {
    margin: 0;
    padding: 0 4px 24px;
    max-width: 640px;
    font-size: ${textScale.base.fontSize};
    line-height: ${textScale.base.lineHeight};
    color: ${semantic.text.secondary};
  }
`;

export function Faq() {
  return (
    <Section id="faq" $tone="secondary" aria-labelledby="faq-title">
      <Container>
        <Grid>
          <Sticky data-reveal>
            <Eyebrow>FAQ</Eyebrow>
            <H2 id="faq-title">Questions teams ask before they switch.</H2>
            <Lead>
              Not covered here? Write to
              {' '}
              <TextLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</TextLink>
              {' '}
              and a human answers within one business day.
            </Lead>
          </Sticky>
          <List data-reveal>
            {FAQ.map((item, i) => (
              <Item key={item.q} open={i === 0}>
                <summary>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{item.q}</h3>
                  <Plus size={18} weight="bold" aria-hidden />
                </summary>
                <p>{item.a}</p>
              </Item>
            ))}
          </List>
        </Grid>
      </Container>
    </Section>
  );
}

export default Faq;
