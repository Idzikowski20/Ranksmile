import React from 'react';
import styled from '@emotion/styled';
import { Check, Minus } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { COMPARE, COMPARE_COLS, COMPARE_HEAD, SIGN_UP_HREF, EXPERT_HREF } from '../content';

/* Figma 5:7750 — "Compare Full AI SEO Plans": sticky 4-column header + grouped feature rows. */

const Wrap = styled(Section)`
  padding: 90px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 27px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  h2 {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 15.8px;
    color: ${semantic.text.secondary};
    text-decoration: none;
    b {
      font-weight: ${fontWeight.bold};
      color: ${semantic.text.primary};
    }
  }
`;

const Scroll = styled.div`
  overflow-x: auto;
`;

const Table = styled.div`
  min-width: 900px;
`;

const COLS = 'minmax(280px, 1.4fr) repeat(4, minmax(150px, 1fr))';

const HeadRow = styled.div`
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: ${COLS};
  gap: 9px;
  padding: 18px 0;
  background: ${semantic.background.primary};
  border-bottom: 1px solid ${semantic.border.primary};
`;

const ColHead = styled.div<{ $rec?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: ${(p) => (p.$rec ? 'color-mix(in srgb, var(--landing-blue) 8%, var(--koala-bg-primary))' : 'transparent')};
  b {
    font-size: 18px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  span {
    font-size: 13.5px;
    color: ${semantic.text.secondary};
  }
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 9px;
    border-radius: 10px;
    background: ${(p) => (p.$rec ? 'var(--landing-blue)' : semantic.background.inverse)};
    color: #fff;
    text-decoration: none;
    font-size: 14px;
    font-weight: ${fontWeight.bold};
  }
`;

const Group = styled.div`
  margin-top: 36px;
  padding: 18px 0 9px;
  font-size: 20.3px;
  line-height: 24.3px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${COLS};
  gap: 9px;
  align-items: center;
  padding: 13.5px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  font-size: 15.8px;
  line-height: 23.63px;
  color: ${semantic.text.primary};
`;

const Cell = styled.div`
  padding: 0 12px;
  color: ${semantic.text.secondary};
  svg {
    color: var(--landing-blue);
  }
  svg.no {
    color: ${semantic.border.strong};
  }
`;

function CmpCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} weight="bold" aria-label="Included" />;
  if (value === false) return <Minus size={18} weight="bold" className="no" aria-label="Not included" />;
  return <>{value}</>;
}

export function PrCompare() {
  return (
    <Wrap id="compare" aria-labelledby="compare-title">
      <Container>
        <Head data-reveal>
          <h2 id="compare-title">{COMPARE_HEAD.title}</h2>
          <a href={EXPERT_HREF}>
            <b>Need more?</b>
            {' '}
            Talk to a Ranksmile Expert
          </a>
        </Head>
        <Scroll data-reveal>
          <Table>
            <HeadRow>
              <div />
              {COMPARE_COLS.map((c) => (
                <ColHead key={c.name} $rec={c.name === 'Pro'}>
                  <b>{c.name}</b>
                  <span>{`$${c.price} /mo billed yearly`}</span>
                  <a href={`${SIGN_UP_HREF}?plan=${c.name.toLowerCase().replace(/\s+/g, '-')}`}>Start for Free</a>
                </ColHead>
              ))}
            </HeadRow>

            {COMPARE.map((section) => (
              <div key={section.title}>
                <Group>{section.title}</Group>
                {section.rows.map((r) => (
                  <Row key={r.label}>
                    <Cell style={{ color: 'var(--koala-text-primary)' }}>{r.label}</Cell>
                    {r.cells.map((cell, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <Cell key={i}>
                        <CmpCell value={cell} />
                      </Cell>
                    ))}
                  </Row>
                ))}
              </div>
            ))}
          </Table>
        </Scroll>
        <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--koala-text-tertiary)' }}>{COMPARE_HEAD.fair}</p>
      </Container>
    </Wrap>
  );
}

export default PrCompare;
