import React, { useId } from 'react';
import styled from '@emotion/styled';
import { TrendUp } from '@phosphor-icons/react';
import Gauge from '../../ranksmile/Gauge';
import { semantic } from '../../koala/tokens/semantic';
import { typeface, fontWeight } from '../../koala/tokens/typography';
import { BP } from '../primitives';

/**
 * HTML stand-in for the product stills in the reference (hero video poster, CTA
 * dashboard). Pure CSS so it ships no image bytes and renders in SSR.
 */

const Root = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 234px 1fr;
  font-family: ${typeface.body};
  color: ${semantic.text.primary};
  background: ${semantic.background.primary};
  ${BP.md} {
    grid-template-columns: 1fr;
  }
`;

const Side = styled.aside`
  border-right: 1px solid ${semantic.border.primary};
  background: ${semantic.background.secondary};
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  ${BP.md} {
    display: none;
  }
`;

const Org = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 10px 16px;
  font-size: 15px;
  font-weight: ${fontWeight.medium};
  span {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: ${semantic.border.secondary};
  }
`;

const Item = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 14px;
  color: ${(p) => (p.$active ? semantic.text.primary : semantic.text.secondary)};
  background: ${(p) => (p.$active ? semantic.background.primary : 'transparent')};
  font-weight: ${(p) => (p.$active ? fontWeight.medium : fontWeight.regular)};
  b {
    min-width: 22px;
    height: 18px;
    padding: 0 6px;
    border-radius: 6px;
    background: ${semantic.background.brand};
    color: ${semantic.text.onBrand};
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }
`;

const Group = styled.p`
  margin: 12px 10px 4px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${semantic.text.tertiary};
`;

const Main = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const Topbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 54px;
  padding: 0 27px;
  border-bottom: 1px solid ${semantic.border.primary};
  font-size: 13px;
  color: ${semantic.text.tertiary};
  span:first-of-type {
    width: 320px;
    max-width: 40%;
    height: 32px;
    border-radius: 9px;
    border: 1px solid ${semantic.border.primary};
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
  }
  i {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: ${semantic.border.secondary};
  }
`;

const Content = styled.div`
  padding: 36px 45px 0;
  ${BP.md} {
    padding: 24px 18px 0;
  }
`;

const Greeting = styled.p`
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;
`;

const Summary = styled.p`
  margin: 0 0 27px;
  max-width: 760px;
  font-size: 16.5px;
  line-height: 27px;
  color: ${semantic.text.secondary};
  b {
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  mark {
    background: ${semantic.background.secondary};
    color: ${semantic.text.primary};
    padding: 1px 7px;
    border-radius: 6px;
    font-weight: ${fontWeight.medium};
  }
`;

const Label = styled.p`
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.secondary};
`;

const Widgets = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: 1.4fr 1fr 1fr;
  ${BP.md} {
    grid-template-columns: 1fr;
  }
`;

const Widget = styled.div`
  border: 1px solid ${semantic.border.primary};
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  padding: 16px 18px 0;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${semantic.background.primary};
`;

const WLabel = styled.span`
  font-size: 12px;
  color: ${semantic.text.tertiary};
`;

const WValue = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: 24px;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;
  small {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.status.success};
  }
  i {
    font-style: normal;
    font-size: 12px;
    color: ${semantic.text.tertiary};
  }
`;

const GaugeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  span {
    font-size: 13px;
    color: ${semantic.text.secondary};
  }
`;

const SPARK = '0,52 30,48 60,50 90,40 120,42 150,34 180,30 210,24 240,26 270,18 300,14';

export function DashboardMock({ org = 'Northwind Inc.' }: { org?: string }) {
  // The mock mounts twice (hero + CTA); a per-instance id keeps each chart's
  // fill pointing at its own gradient rather than the first one in the document.
  const sparkId = `dash-spark-${useId().replace(/:/g, '')}`;
  return (
    <Root aria-hidden>
      <Side>
        <Org>
          <span />
          {org}
        </Org>
        <Item $active>Dashboard</Item>
        <Item>
          Recommendations
          <b>47</b>
        </Item>
        <Item>Content Editor</Item>
        <Item>Activity Log</Item>
        <Group>SEO</Group>
        <Item>Performance</Item>
        <Item>Content Audit</Item>
        <Item>Rank tracking</Item>
        <Group>AI Visibility</Group>
        <Item>Overview</Item>
        <Item>Sources</Item>
        <Item>Competitors</Item>
        <Item>Prompts</Item>
      </Side>
      <Main>
        <Topbar>
          <span>Search ⌘K</span>
          <i />
        </Topbar>
        <Content>
          <Greeting>Good morning, Alex!</Greeting>
          <Summary>
            Your site received
            {' '}
            <b>3,270 clicks</b>
            {' '}
            — a 19% increase vs last 30 days. Your AI Visibility is
            {' '}
            <mark>21</mark>
            , placing you
            {' '}
            <b>4th</b>
            {' '}
            behind
            {' '}
            <mark>Contoso 81</mark>
            ,
            {' '}
            <mark>Fabrikam 71</mark>
            , and
            {' '}
            <mark>Litware 68</mark>
            .
          </Summary>
          <Label>Brand performance</Label>
          <Widgets>
            <Widget>
              <WLabel>Clicks</WLabel>
              <WValue>
                3,270
                <small>
                  <TrendUp size={12} weight="bold" />
                  19%
                </small>
                <i>2,648 last 30d</i>
              </WValue>
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" width="100%" height="64">
                <defs>
                  <linearGradient id={sparkId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--koala-bg-brand)" stopOpacity="0.2" />
                    <stop offset="1" stopColor="var(--koala-bg-brand)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`0,60 ${SPARK} 300,60`} fill={`url(#${sparkId})`} />
                <polyline points={SPARK} fill="none" stroke="var(--koala-bg-brand)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </Widget>
            <Widget>
              <WLabel>AI Visibility</WLabel>
              <WValue>21</WValue>
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" width="100%" height="64">
                <polyline
                  points="0,56 60,56 120,54 180,52 220,40 260,28 300,16"
                  fill="none"
                  stroke="var(--koala-text-secondary)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </Widget>
            <Widget>
              <WLabel>Content Score · latest draft</WLabel>
              <GaugeRow>
                <Gauge score={91} size="sm" />
                <span>Ready to publish</span>
              </GaugeRow>
            </Widget>
          </Widgets>
        </Content>
      </Main>
    </Root>
  );
}

export default DashboardMock;
