import React from 'react';
import styled from '@emotion/styled';
import { Buildings, PenNib, UsersThree } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Eyebrow, H2, Section } from '../../landing/primitives';
import { AUDIENCE } from '../content';

/* Figma 3:4929 — "Made for Marketers…" head + wide image + audience groups. */

const Wrap = styled(Section)`
  padding: 90px 0;
  ${BP.md} {
    padding: 54px 0;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 900px;
  margin: 0 auto 63px;
  text-align: center;
  ${BP.md} {
    margin-bottom: 36px;
  }
`;

const Media = styled.div`
  position: relative;
  aspect-ratio: 1216 / 500;
  border-radius: 27px;
  overflow: hidden;
  border: 1px solid ${semantic.border.primary};
  background:
    linear-gradient(115deg, color-mix(in srgb, var(--landing-blue) 10%, ${semantic.background.tertiary}), ${semantic.background.secondary});
  display: flex;
  align-items: center;
  justify-content: center;
  ${BP.md} {
    aspect-ratio: 4 / 3;
  }
`;

const Roles = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 24px;
`;

const Role = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-radius: 16px;
  border: 1px solid ${semantic.border.primary};
  background: color-mix(in srgb, ${semantic.background.primary} 88%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 16px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.brand};
  }
`;

const Copy = styled.p`
  max-width: 820px;
  margin: 63px auto 0;
  text-align: center;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.tertiary};
  b {
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    margin-top: 36px;
  }
`;

const ICON = [UsersThree, PenNib, Buildings];

export function AiAudience() {
  return (
    <Wrap aria-labelledby="audience-title">
      <Container>
        <Head data-reveal>
          <Eyebrow $tone="brand">{AUDIENCE.eyebrow}</Eyebrow>
          <H2 id="audience-title" $size={44.5}>
            {AUDIENCE.titleLines.map((l, i) => (
              <React.Fragment key={l}>
                {l}
                {i === 0 ? <br /> : null}
              </React.Fragment>
            ))}
          </H2>
        </Head>

        <Media data-reveal role="img" aria-label="Teams that use Ranksmile AI Tracker">
          <Roles>
            {AUDIENCE.groups.map((g, i) => {
              const IconComp = ICON[i];
              return (
                <Role key={g.label}>
                  <IconComp size={20} weight="fill" aria-hidden />
                  {g.label.replace(':', '')}
                </Role>
              );
            })}
          </Roles>
        </Media>

        <Copy data-reveal>
          {AUDIENCE.body}
          {' '}
          {AUDIENCE.groups.map((g) => (
            <React.Fragment key={g.label}>
              <b>{g.label}</b>
              {g.body}
              {' '}
            </React.Fragment>
          ))}
        </Copy>
      </Container>
    </Wrap>
  );
}

export default AiAudience;
