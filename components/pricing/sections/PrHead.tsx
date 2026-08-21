import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { HEAD, EXPERT_HREF } from '../content';

/* Figma 5:2648 — head 990: 35.8px H1 (strong + muted) · segmented toggle (radius 999, purple pill) · "Need more?" link. */

const Wrap = styled(Section)`
  margin-top: -92px;
  padding: 135px 0 0;
  ${BP.md} {
    margin-top: -73px;
    padding-top: 108px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 27px;
`;

const H1 = styled.h1`
  margin: 0;
  max-width: 990px;
  font-size: 35.8px;
  line-height: 42.93px;
  font-weight: ${fontWeight.bold};
  text-align: center;
  color: ${semantic.text.tertiary};
  strong {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    font-size: 28px;
    line-height: 34px;
  }
`;

const Toggle = styled.div`
  display: flex;
  padding: 4.5px;
  border-radius: 999px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
`;

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  width: 208.83px;
  padding: 12.5px 27px 13.94px;
  border: 0;
  border-radius: 999px;
  background: ${(p) => (p.$active ? 'var(--landing-blue)' : 'transparent')};
  color: ${(p) => (p.$active ? '#fff' : semantic.text.secondary)};
  font-family: inherit;
  font-size: 16.2px;
  line-height: 19.44px;
  font-weight: ${fontWeight.bold};
  cursor: var(--koala-cursor-pointing);
  transition: background var(--motion-fast) var(--motion-ease-standard), color var(--motion-fast) var(--motion-ease-standard);
  &:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
  ${BP.sm} {
    width: auto;
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
  }
`;

const NeedMore = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.secondary};
  a {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    text-decoration: none;
    &:hover {
      color: ${semantic.text.brand};
    }
  }
`;

export function PrHead({ tab, onTab }: { tab: number; onTab: (i: number) => void }) {
  return (
    <Wrap aria-labelledby="pricing-title">
      <Container>
        <Head data-reveal>
          <H1 id="pricing-title">
            <strong>{HEAD.titleStrong}</strong>
            {HEAD.titleMuted[0]}
            <br />
            {HEAD.titleMuted[1]}
          </H1>
          <Toggle role="tablist" aria-label="Pricing view">
            {HEAD.tabs.map((label, i) => (
              <Tab key={label} type="button" role="tab" aria-selected={tab === i} $active={tab === i} onClick={() => onTab(i)}>
                {label}
              </Tab>
            ))}
          </Toggle>
          <NeedMore>
            {HEAD.needMore}
            <a href={EXPERT_HREF}>{HEAD.expert}</a>
          </NeedMore>
        </Head>
      </Container>
    </Wrap>
  );
}

export default PrHead;
