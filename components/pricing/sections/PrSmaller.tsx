import React from 'react';
import styled from '@emotion/styled';
import { Check, Sparkle } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { SMALLER, SIGN_UP_HREF, EXPERT_HREF } from '../content';

/* Figma 5:3075 — head with border-bottom · grid 1fr/2fr h634: Discovery (light) + Enterprise (dark, wide, 2-col features). */

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
  margin-bottom: 45px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  h2 {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.secondary};
    strong {
      color: ${semantic.text.primary};
    }
  }
  p {
    margin: 0;
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.secondary};
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 9px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const Card = styled.article<{ $dark?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 13.5px;
  border: 1px solid ${(p) => (p.$dark ? semantic.border.strong : semantic.border.primary)};
  background: ${(p) => (p.$dark ? semantic.background.inverse : semantic.background.tertiary)};
  color: ${(p) => (p.$dark ? '#fff' : semantic.text.primary)};
`;

const Body = styled.div<{ $dark?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 45px;
  padding: 36px;
  border-bottom: 1px solid ${(p) => (p.$dark ? 'transparent' : 'rgba(0,0,0,0.05)')};
  background: ${(p) => (p.$dark ? 'transparent' : semantic.background.primary)};
  ${BP.md} {
    padding: 27px;
  }
`;

const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  h3 {
    margin: 0;
    font-size: 23.2px;
    line-height: 29px;
    font-weight: ${fontWeight.bold};
  }
`;

const Price = styled.p`
  margin: 0;
  font-size: 18px;
  line-height: 27px;
  span {
    opacity: 0.5;
    margin-left: 5.4px;
  }
`;

const Chip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4.5px;
  font-size: 15.8px;
  line-height: 23.63px;
  svg {
    color: var(--landing-blue);
  }
`;

const Billing = styled.div`
  display: flex;
  align-items: center;
  gap: 5.9px;
  font-size: 15.8px;
  line-height: 15.75px;
  i {
    width: 31.5px;
    height: 18px;
    border-radius: 18px;
    background: var(--landing-blue);
    position: relative;
    &::after {
      content: '';
      position: absolute;
      top: 2.25px;
      left: 16.19px;
      width: 13.5px;
      height: 13.5px;
      border-radius: 6.75px;
      background: #fff;
    }
  }
`;

const Saving = styled.span`
  margin-left: 3.6px;
  padding: 4.5px 11.25px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 9999px;
  font-size: 13.5px;
  line-height: 13.5px;
`;

const Desc = styled.p`
  margin: 0;
  min-height: 47px;
  font-size: 15.8px;
  line-height: 23.63px;
  opacity: 0.55;
`;

const Ctas = styled.div`
  display: flex;
  gap: 16px;
  ${BP.sm} {
    flex-direction: column;
  }
`;

const Cta = styled.a<{ $ghost?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13.5px 27px;
  border-radius: 13.5px;
  background: ${(p) => (p.$ghost ? 'rgba(255,255,255,0.1)' : semantic.background.primary)};
  color: ${(p) => (p.$ghost ? '#fff' : semantic.text.primary)};
  backdrop-filter: ${(p) => (p.$ghost ? 'blur(18px)' : 'none')};
  text-decoration: none;
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  box-shadow: ${(p) => (p.$ghost ? 'none' : 'inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25)')};
  &:hover {
    filter: brightness(0.96);
  }
`;

const Features = styled.div<{ $cols?: number; $dark?: boolean }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols ?? 1}, minmax(0, 1fr));
  gap: 18px;
  padding: 36px 36px 9px;
  border-top: 1px solid ${(p) => (p.$dark ? 'rgba(255,255,255,0.05)' : 'transparent')};
  ${BP.md} {
    grid-template-columns: 1fr;
    padding: 27px 27px 9px;
  }
`;

const Feat = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 15.8px;
  line-height: 23.63px;
  svg {
    flex-shrink: 0;
    margin-top: 3.9px;
    color: var(--landing-blue);
  }
`;

const Foot = styled.div`
  padding: 18px;
  text-align: center;
  font-size: 15.8px;
  line-height: 23.63px;
  opacity: 0.5;
`;

export function PrSmaller() {
  const { head, sub, discovery, enterprise } = SMALLER;
  return (
    <Wrap aria-label="Discovery and Enterprise">
      <Container>
        <Head data-reveal>
          <h2>
            <strong>{head.strong}</strong>
            {head.muted}
          </h2>
          <p>{sub}</p>
        </Head>
        <Grid>
          <Card data-reveal>
            <Body>
              <Top>
                <h3>{discovery.name}</h3>
                <Price>
                  {`${discovery.price} USD`}
                  <span>per month</span>
                </Price>
                <Billing>
                  <i aria-hidden />
                  Billed yearly
                  <Saving>{`Saving $${discovery.yearlySaving}`}</Saving>
                </Billing>
                <Desc>{discovery.desc}</Desc>
                <Cta href={`${SIGN_UP_HREF}?plan=discovery`}>{discovery.cta}</Cta>
              </Top>
            </Body>
            <Features>
              {discovery.features.map((f) => (
                <Feat key={f}>
                  <Check size={15.75} weight="bold" aria-hidden />
                  <span>{f}</span>
                </Feat>
              ))}
            </Features>
            <Foot>{discovery.footer}</Foot>
          </Card>

          <Card $dark data-reveal>
            <Body $dark>
              <Top>
                <h3>{enterprise.name}</h3>
                <Price>
                  {`${enterprise.price} USD`}
                  <span>per month</span>
                </Price>
                <Chip>
                  <Sparkle size={18} weight="fill" aria-hidden />
                  {enterprise.tag}
                </Chip>
                <Desc style={{ maxWidth: 450 }}>{enterprise.desc}</Desc>
                <Ctas>
                  <Cta href={EXPERT_HREF}>{enterprise.cta1}</Cta>
                  <Cta $ghost href={EXPERT_HREF}>{enterprise.cta2}</Cta>
                </Ctas>
              </Top>
            </Body>
            <Features $cols={2} $dark>
              {enterprise.features.map((f) => (
                <Feat key={f}>
                  <Check size={15.75} weight="bold" aria-hidden />
                  <span>{f}</span>
                </Feat>
              ))}
            </Features>
            <Foot>{enterprise.footer}</Foot>
          </Card>
        </Grid>
      </Container>
    </Wrap>
  );
}

export default PrSmaller;
