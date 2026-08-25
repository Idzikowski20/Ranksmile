import React from 'react';
import styled from '@emotion/styled';
import { ArrowRight, Buildings, CheckCircle, Circle, Plus, UsersThree } from '@phosphor-icons/react';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section, Tag } from '../primitives';
import { PILLARS, USE_CASES } from '../content';
import { ringGeometry } from './ringGeometry';

/* Figma 1:2884 (Solution) + 1:3034 (two cards). Both sit inside the white 27px frame. */

const SolutionWrap = styled(Section)`
  padding: 179px 0 90px;
  ${BP.md} {
    padding: 90px 0 54px;
  }
`;

const Head = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 697px) 1fr;
  gap: 27px;
  padding-left: 45px;
  margin-bottom: 90px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    padding-left: 0;
  }
  ${BP.md} {
    margin-bottom: 45px;
  }
`;

const HeadTag = styled(Tag)`
  grid-column: 1 / -1;
  margin-bottom: 18px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 44.5px;
  line-height: 53.41px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  ${BP.md} {
    font-size: 32px;
    line-height: 38px;
  }
`;

const Intro = styled.p`
  margin: 19px 0 0;
  font-size: 20.3px;
  line-height: 30.39px;
  color: ${semantic.text.secondary};
  strong {
    font-weight: ${fontWeight.regular};
    color: ${semantic.text.primary};
  }
  ${BP.lg} {
    margin-top: 0;
  }
`;

const Articles = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.5px 1fr 1.5px 1fr;
  ${BP.md} {
    grid-template-columns: 1fr;
    gap: 27px;
    & > i {
      display: none;
    }
  }
`;

const VDivider = styled.i`
  background: linear-gradient(to bottom, transparent, ${semantic.border.primary} 20%, ${semantic.border.primary} 80%, transparent);
`;

const Article = styled.article`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const WidgetBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 63px 36px;
  box-sizing: border-box;
  ${BP.md} {
    min-height: 0;
    padding: 27px 18px;
  }
`;

const Widget = styled.div`
  width: 100%;
  max-width: 410px;
  min-height: 234px;
  box-sizing: border-box;
  padding: 2.25px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 18px;
  background: ${semantic.background.secondary};
  display: flex;
  flex-direction: column;
`;

type WRowProps = { $first?: boolean; $last?: boolean; $dim?: boolean; $plain?: boolean };
function rowRadius(p: WRowProps): string {
  if (p.$first) return '15.75px 15.75px 0 0';
  if (p.$last) return '0 0 15.75px 15.75px';
  return '0';
}

const WRow = styled.div<WRowProps>`
  display: flex;
  align-items: center;
  gap: 13.5px;
  height: 56.9px;
  padding: 0 18px;
  box-sizing: border-box;
  background: ${(p) => (p.$plain ? 'transparent' : semantic.background.primary)};
  border: 1px solid ${(p) => (p.$first && !p.$plain ? semantic.border.primary : 'transparent')};
  border-radius: ${(p) => rowRadius(p)};
  font-size: 18px;
  line-height: 27px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  > span {
    flex: 1;
    opacity: ${(p) => (p.$dim ? 0.3 : 1)};
  }
  svg {
    flex-shrink: 0;
  }
`;

const ScoreBody = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  padding: 12px 36px;
  background: ${semantic.background.primary};
  border-radius: 0 0 15.75px 15.75px;
`;

const ScoreCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6.36px;
  font-size: 14.7px;
  line-height: 17.64px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const dotsContent = (p: { $dots?: boolean }) => (p.$dots ? "''" : 'none');

const HDivider = styled.div<{ $dots?: boolean }>`
  position: relative;
  height: 1.5px;
  background: ${(p) => (p.$dots
    ? semantic.border.primary
    : `linear-gradient(to left, transparent, ${semantic.border.primary} 30%, ${semantic.border.primary} 70%, transparent)`)};
  &::before,
  &::after {
    content: ${dotsContent};
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    transform: translateY(-50%);
    border-radius: 9999px;
    border: 1.5px solid ${semantic.border.secondary};
    background: ${semantic.background.primary};
    box-sizing: border-box;
  }
  &::before {
    left: -4.95px;
  }
  &::after {
    right: -4.95px;
  }
`;

const Pillar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 44px 36px 45px;
  text-align: center;
  h3 {
    margin: 0;
    font-size: 20.3px;
    line-height: 30.39px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  p {
    margin: 0;
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.secondary};
    strong {
      font-weight: ${fontWeight.regular};
      color: ${semantic.text.primary};
    }
  }
`;

/* Ring gauges — 68.58 side / 130.63 centre (Figma 1:2907 / 1:2921). */
function Ring({ value, size, stroke, fontSize }: { value: number; size: number; stroke: number; fontSize: number }) {
  const { r, c, offset } = ringGeometry(value, size, stroke);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${value}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--koala-border-primary)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--landing-green)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        data-ring
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={700}
        fill="var(--koala-text-primary)"
        fontFamily="var(--font-family-primary)"
      >
        {value}
      </text>
    </svg>
  );
}

/* ── Two cards (Figma 1:3040 / 1:3060): 717.86 wide, p 54, radius 9, gap 4.49 ── */

const CardsWrap = styled(Section)`
  padding: 126px 0 180px;
  ${BP.md} {
    padding: 54px 0 90px;
  }
`;

const Cards = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4.49px;
  ${BP.md} {
    grid-template-columns: 1fr;
    gap: 18px;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  gap: 27px;
  min-height: 450px;
  box-sizing: border-box;
  padding: 54px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 9px;
  background: ${semantic.background.primary};
  ${BP.md} {
    padding: 27px;
    min-height: 0;
  }
`;

const CardTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 27px;
  font-size: 18px;
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  svg {
    color: ${semantic.text.brand};
  }
`;

const Quote = styled.p`
  margin: 0;
  min-height: 95px;
  font-size: 28.8px;
  line-height: 31.67px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.tertiary};
  text-wrap: pretty;
  strong {
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  ${BP.md} {
    font-size: 22px;
    line-height: 26px;
  }
`;

const Author = styled.div`
  margin-top: auto;
  padding-top: 54px;
  display: flex;
  align-items: flex-end;
  gap: 27px;
  i {
    width: 54px;
    height: 54px;
    flex-shrink: 0;
    border-radius: 13.5px;
    background: ${semantic.background.secondary};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${semantic.text.primary};
  }
  b {
    display: block;
    font-size: 18px;
    line-height: 27px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
  span {
    font-size: 15.8px;
    line-height: 23.63px;
    color: ${semantic.text.secondary};
  }
  a {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6.75px;
    font-size: 16.9px;
    letter-spacing: -0.174px;
    color: ${semantic.text.secondary};
    text-decoration: none;
    white-space: nowrap;
    svg {
      color: ${semantic.text.primary};
    }
  }
`;

/* Figma 1:3036 / 1:3038 — the reference side art (302×180) floating off both edges. */
const SideArt = styled.img<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: ${(p) => (p.$side === 'left' ? 'calc(50% + 225px)' : 'calc(50% - 189px)')};
  ${(p) => (p.$side === 'left' ? 'right: 100%; margin-right: 20px;' : 'left: 100%; margin-left: 20px;')}
  width: 302px;
  height: 180px;
  object-fit: cover;
  pointer-events: none;
  ${BP.lg} {
    display: none;
  }
`;

export function Solution() {
  return (
    <>
      <SolutionWrap id="platform" aria-labelledby="solution-title">
        <Container>
          <Head data-reveal>
            <HeadTag>Solution</HeadTag>
            <Title id="solution-title">
              Ranksmile: Your AI Search
              <br />
              Visibility OS
            </Title>
            <Intro>
              We spent years analyzing what makes content trusted — by Google, by AI, by people who actually make
              decisions online.
              {' '}
              <strong>We&apos;re decoding the signals and turned it all into a repeatable, AI Search Operating System:</strong>
            </Intro>
          </Head>

          <Articles>
            <Article data-reveal>
              <WidgetBox>
                <Widget aria-label="Content Score widget">
                  <WRow $first><span>Content Score</span></WRow>
                  <ScoreBody>
                    <ScoreCol>
                      SEO
                      <Ring value={86} size={68.58} stroke={6} fontSize={15} />
                    </ScoreCol>
                    <ScoreCol>
                      <Ring value={91} size={130.63} stroke={10} fontSize={36} />
                    </ScoreCol>
                    <ScoreCol>
                      AI Search
                      <Ring value={96} size={68.58} stroke={6} fontSize={15} />
                    </ScoreCol>
                  </ScoreBody>
                </Widget>
              </WidgetBox>
              <HDivider />
              <Pillar>
                <h3>{PILLARS[0].title}</h3>
                <p>
                  <strong>{PILLARS[0].strong}</strong>
                  {PILLARS[0].body}
                </p>
              </Pillar>
            </Article>

            <VDivider aria-hidden />

            <Article data-reveal>
              <WidgetBox>
                <Widget aria-label="Brand setup widget">
                  <WRow $plain>
                    <Buildings size={22.5} weight="bold" aria-hidden />
                    <span>Northwind Inc.</span>
                  </WRow>
                  <WRow $first $dim>
                    <span>Extracting Brand Details...</span>
                    <Circle size={22.5} weight="bold" color="var(--koala-border-secondary)" aria-hidden />
                  </WRow>
                  <WRow $dim>
                    <span>Competitors</span>
                    <Circle size={22.5} weight="bold" color="var(--koala-border-secondary)" aria-hidden />
                  </WRow>
                  <WRow $last $dim>
                    <span>Brand Voice</span>
                    <Circle size={22.5} weight="bold" color="var(--koala-border-secondary)" aria-hidden />
                  </WRow>
                </Widget>
              </WidgetBox>
              <HDivider $dots />
              <Pillar>
                <h3>{PILLARS[1].title}</h3>
                <p>
                  <strong>{PILLARS[1].strong}</strong>
                  {PILLARS[1].body}
                </p>
              </Pillar>
            </Article>

            <VDivider aria-hidden />

            <Article data-reveal>
              <WidgetBox>
                <Widget aria-label="Quick start widget">
                  <WRow $first>
                    <CheckCircle size={22.5} weight="fill" color="var(--landing-green)" aria-hidden />
                    <span>Add your first brand</span>
                  </WRow>
                  <WRow>
                    <Plus size={22.5} weight="bold" aria-hidden />
                    <span>Optimize your first page</span>
                  </WRow>
                  <WRow>
                    <Plus size={22.5} weight="bold" aria-hidden />
                    <span>Create new content</span>
                  </WRow>
                  <WRow $last>
                    <Plus size={22.5} weight="bold" aria-hidden />
                    <span>Request a mention</span>
                  </WRow>
                </Widget>
              </WidgetBox>
              <HDivider />
              <Pillar>
                <h3>{PILLARS[2].title}</h3>
                <p>
                  <strong>{PILLARS[2].strong}</strong>
                  {PILLARS[2].body}
                </p>
              </Pillar>
            </Article>
          </Articles>
        </Container>
      </SolutionWrap>

      <CardsWrap id="solution" aria-label="Who Ranksmile is built for">
        <Container>
          <Cards>
            <SideArt $side="left" src="/landing/loop-testimonial-bg.png" alt="" loading="lazy" aria-hidden />
            <SideArt $side="right" src="/landing/loop-testimonial-bg.png" alt="" loading="lazy" aria-hidden />
            {USE_CASES.map((u, i) => (
              <Card key={u.tag} data-reveal>
                <CardTag>
                  {i === 0 ? <UsersThree size={27} weight="fill" aria-hidden /> : <Buildings size={27} weight="fill" aria-hidden />}
                  {u.tag}
                </CardTag>
                <Quote>
                  {u.muted}
                  <strong>{u.strong}</strong>
                  {u.tail}
                </Quote>
                <Author>
                  <i aria-hidden><img src="/favicon.svg" alt="" width={28} height={28} /></i>
                  <div>
                    <b>{u.name}</b>
                    <span>{u.role}</span>
                  </div>
                  {'link' in u && u.link ? (
                    <a href={u.link.href}>
                      {u.link.label}
                      <ArrowRight size={16} weight="bold" aria-hidden />
                    </a>
                  ) : null}
                </Author>
              </Card>
            ))}
          </Cards>
        </Container>
      </CardsWrap>
    </>
  );
}

export default Solution;
