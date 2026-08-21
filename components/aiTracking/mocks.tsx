import React from 'react';
import styled from '@emotion/styled';
import { ArrowUpRight, CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { semantic } from '../koala/tokens/semantic';
import { fontWeight } from '../koala/tokens/typography';
import { BP } from '../landing/primitives';

/** Product stand-ins for the AI Tracker screenshots — pure CSS, self-contained, SSR-safe. */

const Frame = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  border-radius: 27px;
  border: 1px solid ${semantic.border.primary};
  background: ${semantic.background.primary};
  box-shadow: 0px 24px 68px rgba(47,48,55,0.1);
  font-family: var(--font-family-primary);
  color: ${semantic.text.primary};
  ${BP.md} {
    min-height: 320px;
    border-radius: 18px;
  }
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid ${semantic.border.primary};
  background: ${semantic.background.tertiary};
  font-size: 13px;
  color: ${semantic.text.secondary};
  span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: ${semantic.border.secondary};
  }
  b {
    margin-left: 8px;
    font-weight: ${fontWeight.medium};
    color: ${semantic.text.primary};
  }
  em {
    margin-left: auto;
    font-style: normal;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid ${semantic.border.primary};
    border-radius: 8px;
    font-size: 12px;
  }
`;

const Body = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 12px;
  font-size: 14px;
  b {
    font-weight: ${fontWeight.medium};
  }
  small {
    margin-left: auto;
    display: inline-flex;
    gap: 10px;
    color: ${semantic.text.secondary};
    white-space: nowrap;
  }
`;

const Pills = styled.span`
  display: inline-flex;
  gap: 4px;
  i {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1.5px solid ${semantic.background.primary};
    box-shadow: 0 0 0 1px ${semantic.border.primary};
  }
`;

const Up = styled.small`
  color: ${semantic.status.success} !important;
`;

export function PromptsMock() {
  const rows = [
    { q: 'What are the best tools for content marketing in 2025?', pos: '4.3', rate: '44%', score: '90', up: true },
    { q: 'Best tools for a content audit and optimization?', pos: '67.8', rate: '67%', score: '80', up: true },
    { q: 'Best analytics tools for measuring content success?', pos: '35.5', rate: '35%', score: '70', up: false },
    { q: 'Which tools repurpose content for different platforms?', pos: '23.1', rate: '23%', score: '60', up: false },
  ];
  return (
    <Frame data-panel-mock aria-hidden>
      <Bar>
        <span />
        <span />
        <span />
        <b>Prompts</b>
        <em>
          <MagnifyingGlass size={12} weight="bold" />
          Manage
        </em>
      </Bar>
      <Body>
        {rows.map((r) => (
          <Row key={r.q}>
            <b>{r.q}</b>
            <small>
              <Pills>
                <i style={{ background: 'var(--koala-bg-brand)' }} />
                <i style={{ background: 'var(--landing-blue)' }} />
                <i style={{ background: 'var(--landing-green)' }} />
              </Pills>
              {r.up ? <Up>▲ {r.pos}</Up> : <span>▾ {r.pos}</span>}
              <span>{r.rate}</span>
              {r.up ? <Up>▲ {r.score}</Up> : <span>▾ {r.score}</span>}
            </small>
          </Row>
        ))}
      </Body>
    </Frame>
  );
}

export function AnalyticsMock() {
  return (
    <Frame data-panel-mock aria-hidden>
      <Bar>
        <span />
        <span />
        <span />
        <b>Share of Voice</b>
        <em>
          Last 6 weeks
          <CaretDown size={12} weight="bold" />
        </em>
      </Bar>
      <Body>
        <svg viewBox="0 0 560 220" preserveAspectRatio="none" width="100%" height="200" style={{ overflow: 'visible' }}>
          {[40, 80, 120, 160, 200].map((y) => (
            <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="var(--koala-border-primary)" strokeWidth="1" />
          ))}
          <polyline
            points="0,180 80,168 140,172 210,150 260,120 320,132 380,96 440,104 500,60 560,44"
            fill="none"
            stroke="var(--koala-bg-brand)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            data-chart-line
          />
          <polyline
            points="0,196 80,190 140,186 210,180 260,176 320,168 380,158 440,150 500,140 560,128"
            fill="none"
            stroke="var(--landing-blue)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeDasharray="4 4"
          />
        </svg>
        <Row style={{ background: semantic.background.inverse, color: semantic.text.onInverse, borderColor: 'transparent' }}>
          <b>You are pulling ahead</b>
          <small style={{ color: 'inherit' }}>Share of Voice · +18% this week</small>
        </Row>
      </Body>
    </Frame>
  );
}

function Donut({ pct, color }: { pct: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--koala-border-primary)" strokeWidth="10" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 32 32)"
        data-ring
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight={700}
        fill="var(--koala-text-primary)"
        fontFamily="var(--font-family-primary)"
      >
        {pct}
      </text>
    </svg>
  );
}

export function OutreachMock() {
  return (
    <Frame data-panel-mock aria-hidden>
      <Bar>
        <span />
        <span />
        <span />
        <b>Mention gap</b>
        <em>248 sources</em>
      </Bar>
      <Body>
        <div style={{ display: 'flex', gap: 12 }}>
          <Row style={{ flex: 1, justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: semantic.text.tertiary }}>ChatGPT · 5 sources</div>
              <b style={{ fontSize: 20 }}>52 SoV</b>
            </div>
            <Donut pct={52} color="var(--koala-bg-brand)" />
          </Row>
          <Row style={{ flex: 1, justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: semantic.text.tertiary }}>Claude · 5 sources</div>
              <b style={{ fontSize: 20 }}>34 SoV</b>
            </div>
            <Donut pct={34} color="var(--landing-blue)" />
          </Row>
        </div>
        <Row>
          <b>Outreach list ready</b>
          <small><Up>▲ 14 new sources to earn a mention</Up></small>
        </Row>
        <Row>
          northwind.com/guides/ai-rank-tracking
          <small>4 engines</small>
        </Row>
        <Row>
          contoso.io/blog/seo-for-agencies
          <small>3 engines</small>
        </Row>
      </Body>
    </Frame>
  );
}

const Cluster = styled.div`
  position: relative;
  flex: 1;
  min-height: 260px;
`;

const Node = styled.i<{ $x: string; $y: string; $accent?: boolean }>`
  position: absolute;
  left: ${(p) => p.$x};
  top: ${(p) => p.$y};
  width: 46px;
  height: 46px;
  transform: translate(-50%, -50%);
  border-radius: 12px;
  border: 1px solid ${semantic.border.primary};
  background: ${(p) => (p.$accent ? 'var(--koala-bg-brand)' : semantic.background.primary)};
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
`;

export function StrategyMock() {
  const nodes = [
    ['50%', '50%', true], ['24%', '30%'], ['76%', '28%'], ['20%', '70%'],
    ['80%', '72%'], ['50%', '18%'], ['48%', '84%'], ['12%', '50%'], ['88%', '52%'],
  ] as const;
  return (
    <Frame data-panel-mock aria-hidden>
      <Bar>
        <span />
        <span />
        <span />
        <b>Topical Map</b>
        <em>
          Fanout queries
          <ArrowUpRight size={12} weight="bold" />
        </em>
      </Bar>
      <Cluster>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden>
          {nodes.slice(1).map(([x, y]) => (
            <line key={`${x}-${y}`} x1="50%" y1="50%" x2={x} y2={y} stroke="var(--koala-border-primary)" strokeWidth="1.5" />
          ))}
        </svg>
        {nodes.map(([x, y, accent]) => <Node key={`${x}-${y}`} $x={x} $y={y} $accent={accent as boolean | undefined} />)}
      </Cluster>
    </Frame>
  );
}
