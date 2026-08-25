import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../koala/tokens/semantic';
import { fontWeight } from '../../koala/tokens/typography';
import { BP, Container, Section } from '../../landing/primitives';
import { WORKFLOW, A, SIGN_UP_HREF } from '../content';

/* Figma 5:528 — pt 125: head (eyebrow · 44.5px H2 @ .5) gap 90 → 3 rows × (444 | 915) h 541 gap 27. */

const Wrap = styled(Section)`
  padding: 125px 0 0;
  ${BP.md} {
    padding-top: 72px;
  }
`;

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 26px;
  max-width: 990px;
  margin-bottom: 90px;
  p {
    margin: 0;
    font-size: 20.3px;
    line-height: 20.25px;
    font-weight: ${fontWeight.medium};
    text-transform: uppercase;
    color: ${semantic.text.brand};
  }
  h2 {
    margin: 0;
    font-size: 44.5px;
    line-height: 53.41px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
    opacity: 0.5;
  }
  ${BP.md} {
    padding: 0;
    margin-bottom: 45px;
    h2 {
      font-size: 30px;
      line-height: 36px;
    }
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 444.08px minmax(0, 1fr);
  grid-auto-rows: minmax(541px, auto);
  gap: 27px;
  ${BP.lg} {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  gap: 36px;
  min-width: 0;
  padding: 54px 36px 36px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 18px;
  background: ${semantic.background.secondary};
  h3 {
    margin: 0;
    font-size: 27px;
    line-height: 35.11px;
    letter-spacing: -0.72px;
    font-weight: ${fontWeight.bold};
    color: ${semantic.text.primary};
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  li {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 20.3px;
    line-height: 30.38px;
    color: ${semantic.text.primary};
    img {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }
  }
`;

const Btn = styled.a`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 13.5px 27px;
  border-radius: 13.5px;
  background: ${semantic.background.inverse};
  color: ${semantic.text.onInverse};
  text-decoration: none;
  font-size: 18px;
  line-height: 22.5px;
  font-weight: ${fontWeight.bold};
  box-shadow: inset 0px -1px 0px rgba(0,0,0,0.2), inset 0px 1px 0px rgba(255,255,255,0.25);
  img {
    width: 22.5px;
    height: 22.5px;
    filter: brightness(0) invert(1);
  }
`;

const ImgCard = styled.div`
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.secondary};
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const EditorCard = styled.div`
  position: relative;
  overflow: hidden;
  padding: 27px;
  border-radius: 18px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.secondary};
  .badge {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0 4.5px;
    padding: 36px 0;
    background: linear-gradient(to bottom, ${semantic.background.tertiary}, transparent);
    font-size: 18px;
    line-height: 27px;
    color: ${semantic.text.primary};
    z-index: 1;
    b {
      position: relative;
      font-weight: ${fontWeight.bold};
      img {
        position: absolute;
        left: -5%;
        right: -5%;
        top: -60%;
        width: 110%;
        height: 220%;
        mix-blend-mode: multiply;
      }
    }
  }
  .stack {
    position: relative;
    height: 484px;
    img {
      position: absolute;
      display: block;
      border-radius: 9px;
      border: 1px solid ${semantic.border.primary};
      object-fit: cover;
      object-position: top;
    }
    img.editor {
      left: 2.5%;
      right: 2.5%;
      top: 17.39%;
      width: 95%;
      height: 91%;
    }
    img.article {
      left: 0;
      top: 45%;
      width: 100%;
      height: 96%;
    }
  }
`;

export function CeWorkflow() {
  return (
    <Wrap id="workflow" aria-labelledby="workflow-title">
      <Container>
        <Head data-reveal>
          <p>{WORKFLOW.eyebrow}</p>
          <h2 id="workflow-title">
            {WORKFLOW.titleLines[0]}
            <br />
            {WORKFLOW.titleLines[1]}
          </h2>
        </Head>
        <Grid>
          <Card data-reveal>
            <h3>{WORKFLOW.discover.title}</h3>
            <List>
              <li><img src={`${A}/icon-discover-1.svg`} alt="" />{WORKFLOW.discover.items[0]}</li>
              <li><img src={`${A}/icon-discover-2.svg`} alt="" />{WORKFLOW.discover.items[1]}</li>
            </List>
            <Btn href={SIGN_UP_HREF}>
              {WORKFLOW.discover.cta}
              <img src={`${A}/icon-arrow.svg`} alt="" />
            </Btn>
          </Card>
          <ImgCard data-reveal>
            <img src={`${A}/workflow-discover.png`} alt="Topical Map clusters" width={915} height={540} loading="lazy" />
          </ImgCard>

          <EditorCard data-reveal style={{ gridColumn: '1 / 2' }}>
            <div className="badge">
              {WORKFLOW.badge.muted}
              <b>
                <img src={`${A}/workflow-badge.svg`} alt="" aria-hidden />
                {WORKFLOW.badge.strong}
              </b>
            </div>
            <div className="stack" aria-hidden>
              <img className="editor" src={`${A}/workflow-editor.png`} alt="" loading="lazy" />
              <img className="article" src={`${A}/workflow-article.png`} alt="" loading="lazy" />
            </div>
          </EditorCard>
          <Card data-reveal>
            <h3>{WORKFLOW.create.title}</h3>
            <List>
              <li><img src={`${A}/icon-create-1.svg`} alt="" />{WORKFLOW.create.items[0]}</li>
              <li><img src={`${A}/hero-star.svg`} alt="" />{WORKFLOW.create.items[1]}</li>
            </List>
            <Btn href="#write">
              {WORKFLOW.create.cta}
              <img src={`${A}/icon-arrow.svg`} alt="" />
            </Btn>
          </Card>

          <Card data-reveal>
            <h3>{WORKFLOW.audit.title}</h3>
            <List>
              <li><img src={`${A}/icon-audit-1.svg`} alt="" />{WORKFLOW.audit.items[0]}</li>
              <li><img src={`${A}/icon-audit-2.svg`} alt="" />{WORKFLOW.audit.items[1]}</li>
            </List>
            <Btn href={SIGN_UP_HREF}>
              {WORKFLOW.audit.cta}
              <img src={`${A}/icon-arrow.svg`} alt="" />
            </Btn>
          </Card>
          <ImgCard data-reveal>
            <img src={`${A}/workflow-audit.png`} alt="Content Audit top pages table" width={915} height={544} loading="lazy" />
          </ImgCard>
        </Grid>
      </Container>
    </Wrap>
  );
}

export default CeWorkflow;
