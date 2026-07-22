import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAddKeywords, useDeleteKeywords, useFetchKeywords } from '../../../services/keywords';
import { ChartTooltip } from '../../charts/tooltip';
import { useChartHover, useChartStable } from '../../charts/chart-context';
import { Grid } from '../../charts/grid';
import { Line } from '../../charts/line';
import { LineChart } from '../../charts/line-chart';
import { LineSeriesTerminalMarker } from '../../charts/line-series-terminal-marker';
import { XAxis } from '../../charts/x-axis';
import { YAxis } from '../../charts/y-axis';
import { Button, Checkbox } from '../../core';
import type { OrganicKeyword, SearchIntent } from '../../../lib/organicResearch/types';
import { formatCompact } from './OrganicKpiRow';

const FONT = 'var(--font-family-primary)';
const POSITION_LINE = '#5B7CE8';
/** Semrush Intergalactic text-link */
const LINK_COLOR = 'rgb(35, 95, 226)';
/** Chart Y = RANK_CHART_BASE - position so rank 1 sits at the top of a normal scale. */
const RANK_CHART_BASE = 101;

const ALL_COLUMNS = [
  { id: 'keyword', label: 'Keyword', locked: true },
  { id: 'intent', label: 'Intent' },
  { id: 'position', label: 'Position', locked: true },
  { id: 'sf', label: 'SERP Features' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'trafficShare', label: 'Traffic %' },
  { id: 'volume', label: 'Volume' },
  { id: 'difficulty', label: 'KD %' },
  { id: 'url', label: 'URL' },
  { id: 'updatedAt', label: 'Last Update' },
  { id: 'topic', label: 'Topic' },
  { id: 'trend', label: 'Trend' },
  { id: 'opportunityScore', label: 'Opportunity' },
  { id: 'cpc', label: 'CPC' },
  { id: 'competition', label: 'Competitive Density' },
] as const;

type ColumnId = (typeof ALL_COLUMNS)[number]['id'];

const DEFAULT_VISIBLE: ColumnId[] = [
  'keyword', 'intent', 'position', 'sf', 'traffic', 'trafficShare', 'volume', 'difficulty', 'url', 'updatedAt',
];

const INTENT_META: Record<NonNullable<SearchIntent>, { letter: string; bg: string; color: string; title: string }> = {
  // Soft / faded Semrush-style intent chips
  informational: {
    letter: 'I',
    bg: '#a6b8f9',
    color: '#FFFFFF',
    title: 'Informational\nThe user wants to find an answer to a specific question',
  },
  commercial: {
    letter: 'C',
    bg: '#c9b0e8',
    color: '#FFFFFF',
    title: 'Commercial\nThe user wants to investigate brands or services',
  },
  transactional: {
    letter: 'T',
    bg: '#9dd4b8',
    color: '#FFFFFF',
    title: 'Transactional\nThe user wants to complete an action (conversion)',
  },
  navigational: {
    letter: 'N',
    bg: '#f5c89a',
    color: '#FFFFFF',
    title: 'Navigational\nThe user wants to find a specific page or site',
  },
};

const SERP_CATALOG: { key: string; label: string; match: string[] }[] = [
  { key: 'ai_overview', label: 'AI Overview', match: ['ai_overview', 'ai overview', 'sge'] },
  { key: 'reviews', label: 'Reviews', match: ['reviews', 'review'] },
  { key: 'images', label: 'Image', match: ['images', 'image', 'image_pack'] },
  { key: 'video', label: 'Video', match: ['video', 'videos'] },
  { key: 'video_carousel', label: 'Video carousel', match: ['video_carousel', 'video carousel'] },
  { key: 'people_also_ask', label: 'People also ask', match: ['people_also_ask', 'people also ask', 'paa'] },
  { key: 'knowledge_panel', label: 'Knowledge panel', match: ['knowledge_panel', 'knowledge graph', 'knowledge_graph'] },
  { key: 'related_searches', label: 'Related searches', match: ['related_searches', 'related searches'] },
  { key: 'featured_snippet', label: 'Featured snippet', match: ['featured_snippet', 'featured snippet', 'snippet'] },
  { key: 'sitelinks', label: 'Sitelinks', match: ['sitelinks', 'sitelink'] },
  { key: 'local_pack', label: 'Local pack', match: ['local_pack', 'local pack', 'map'] },
  { key: 'shopping', label: 'Shopping', match: ['shopping', 'product'] },
];

function kdDotColor(kd: number | null): string {
  if (kd == null) return '#DAD9DE';
  if (kd <= 14) return '#22C55E';
  if (kd <= 29) return '#84CC16';
  if (kd <= 49) return '#EAB308';
  if (kd <= 69) return '#F97316';
  if (kd <= 84) return '#EF4444';
  return '#DC2626';
}

function IntentBadge({ intent }: { intent: SearchIntent }) {
  if (!intent) return <span style={{ color: '#878490' }}>—</span>;
  const m = INTENT_META[intent];
  return (
    <span
      role="img"
      aria-label={m.title.replace('\n', ': ')}
      title={m.title}
      style={{
        display: 'inline-flex',
        width: 16,
        height: 16,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        background: m.bg,
        color: m.color,
        fontSize: 12,
        lineHeight: '16px',
        fontWeight: 700,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {m.letter}
    </span>
  );
}

function TrendCell({ kw }: { kw: OrganicKeyword }) {
  const ch = kw.change30d;
  if (ch == null || ch === 0) {
    return <span style={{ color: '#6A6772', fontSize: 12 }}>=</span>;
  }
  const up = ch > 0;
  return (
    <span style={{
      color: up ? '#008900' : '#D50000',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: FONT,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
    }}
    >
      {up ? '▲' : '▼'}{Math.abs(ch)}
    </span>
  );
}

function normalizeFeature(f: string): string {
  return f.toLowerCase().replace(/[\s-]+/g, '_');
}

function SerpIcons({ features }: { features: string[] }) {
  if (!features.length) return <span style={{ color: '#878490' }}>—</span>;
  const shown = features.slice(0, 4);
  const rest = features.length - shown.length;
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#6A6772' }}
      title={features.join(', ')}
    >
      {shown.map((f) => (
        <span
          key={f}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: '#F0F0F2',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SerpMiniIcon name={f} />
        </span>
      ))}
      {rest > 0 && (
        <span style={{ fontSize: 11, fontFamily: FONT, color: '#6A6772' }}>+{rest}</span>
      )}
    </span>
  );
}

function SerpMiniIcon({ name }: { name: string }) {
  const n = normalizeFeature(name);
  const stroke = '#6A6772';
  if (n.includes('ai') || n.includes('sge')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.5l1.2 2.4 2.6.4-1.9 1.9.5 2.6L6 7.6 3.6 8.8l.5-2.6-1.9-1.9 2.6-.4L6 1.5z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('image')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1.5" y="2" width="9" height="8" rx="1" stroke={stroke} strokeWidth="1" />
        <circle cx="4.2" cy="4.5" r="1" fill={stroke} />
        <path d="M1.8 8.5l2.4-2.2 1.6 1.4 2-2.1 2.4 2.9" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('video')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1.5" y="2.5" width="6.5" height="7" rx="1" stroke={stroke} strokeWidth="1" />
        <path d="M8.5 4.5l2-1.2v5.4l-2-1.2V4.5z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('people') || n.includes('paa') || n.includes('ask')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.2" stroke={stroke} strokeWidth="1" />
        <path d="M4.5 5h.01M6 5h.01M7.5 5h.01M4.8 7.2c.6.6 1.8.6 2.4 0" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  if (n.includes('review') || n.includes('star')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.8l1.1 2.2 2.4.4-1.7 1.7.4 2.4L6 7.4 3.8 8.5l.4-2.4L2.5 4.4l2.4-.4L6 1.8z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('knowledge') || n.includes('panel')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="2" y="1.5" width="8" height="9" rx="1" stroke={stroke} strokeWidth="1" />
        <path d="M4 4h4M4 6h4M4 8h2.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="3" stroke={stroke} strokeWidth="1" />
      <path d="M7.2 7.2L10 10" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function formatUpdated(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const hours = Math.floor((Date.now() - d.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day';
  if (days < 14) return `${days} days`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function pagePath(url: string | null): string {
  if (!url) return '—';
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL(`https://${url}`);
    const p = `${u.hostname.replace(/^www\./, '')}${u.pathname}`;
    return p.length > 36 ? `${p.slice(0, 34)}…` : p;
  } catch {
    return url.length > 36 ? `${url.slice(0, 34)}…` : url;
  }
}

function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `https://${url}`;
}

type HistoryPoint = {
  date: Date;
  label: string;
  position: number;
  /** Inverted for Bklit Y scale (higher = better rank = top). */
  rankChart: number;
};

/** Mock monthly position history for expand chart (no per-keyword history API yet). */
function mockPositionHistory(kw: OrganicKeyword): HistoryPoint[] {
  const end = kw.position ?? 50;
  const start = kw.previousPosition ?? Math.min(100, end + 20);
  const months = 8;
  const now = new Date();
  const points: HistoryPoint[] = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1 - i), 1));
    const t = i / Math.max(1, months - 1);
    const wobble = Math.sin(i * 1.3 + (kw.keyword.length % 5)) * 4;
    const raw = start + (end - start) * t + wobble;
    const position = Math.max(1, Math.min(100, Math.round(raw)));
    points.push({
      date: d,
      label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      position,
      rankChart: RANK_CHART_BASE - position,
    });
  }
  points[points.length - 1].position = end;
  points[points.length - 1].rankChart = RANK_CHART_BASE - end;
  return points;
}

/** Click hovered point → compare that position vs current. */
function PositionClickBridge({
  onPick,
}: {
  onPick: (position: number, index: number) => void;
}) {
  const { tooltipData } = useChartHover();
  const { containerRef } = useChartStable();
  const tooltipRef = useRef(tooltipData);
  tooltipRef.current = tooltipData;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const handler = () => {
      const t = tooltipRef.current;
      const pos = t?.point?.position;
      if (typeof pos === 'number' && t) onPick(pos, t.index);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [containerRef, onPick]);

  return null;
}

function PositionHistoryChart({
  points,
  onPickPosition,
}: {
  points: HistoryPoint[];
  onPickPosition: (position: number, index: number) => void;
}) {
  const data = useMemo(
    () => points.map((p) => ({
      date: p.date,
      position: p.position,
      rankChart: p.rankChart,
      label: p.label,
    })),
    [points],
  );

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <LineChart
        className="w-full"
        data={data}
        xDataKey="date"
        aspectRatio="2.6 / 1"
        margin={{ top: 12, right: 16, bottom: 32, left: 44 }}
        animationDuration={900}
        yDomainTween={false}
      >
        <Grid horizontal fadeHorizontal />
        <YAxis
          numTicks={6}
          formatLargeNumbers={false}
          formatValue={(v) => String(Math.max(1, Math.min(100, Math.round(RANK_CHART_BASE - v))))}
        />
        <Line
          dataKey="rankChart"
          stroke={POSITION_LINE}
          strokeWidth={2}
          fadeEdges={false}
          showHighlight
          showMarkers
          markers={{ radius: 3, fill: POSITION_LINE, stroke: POSITION_LINE, strokeWidth: 0 }}
        />
        <LineSeriesTerminalMarker
          dataKey="rankChart"
          stroke={POSITION_LINE}
          fill={POSITION_LINE}
          radius={4}
          strokeWidth={0}
        />
        <XAxis numTicks={5} tickMode="data" hideFirstLabel />
        <ChartTooltip
          showDatePill
          showDots
          rows={(point) => [{
            color: POSITION_LINE,
            label: 'Position',
            value: typeof point.position === 'number' ? point.position : '—',
          }]}
        />
        <PositionClickBridge onPick={onPickPosition} />
      </LineChart>
    </div>
  );
}

const TRACKER_DEVICE = 'desktop';

const ghostIconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
};

const dropdownPanel: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  background: '#fff',
  border: '1px solid #DAD9DE',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  zIndex: 30,
  fontFamily: FONT,
};

const exportLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  fontSize: 13,
  color: '#302E36',
  textDecoration: 'none',
  fontFamily: FONT,
};

function trackerEntryKey(keyword: string, country: string, device = TRACKER_DEVICE): string {
  return `${keyword.trim().toLowerCase()}:${country.toUpperCase().slice(0, 2)}:${device}`;
}

function FilledIcon({
  size = 16,
  width,
  height,
  viewBox = '0 0 16 16',
  children,
}: {
  size?: number;
  width?: number;
  height?: number;
  viewBox?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={width ?? size}
      height={height ?? size}
      viewBox={viewBox}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Semrush MathPlusAlt — circle + plus next to keyword. */
function IconPlusAlt() {
  return (
    <FilledIcon>
      <path d="M8 12a1 1 0 0 1-1-1V9H5a1 1 0 0 1 0-2h2V5a1 1 0 0 1 2 0v2h2a1 1 0 1 1 0 2H9v2a1 1 0 0 1-1 1Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-2 0A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z"
      />
    </FilledIcon>
  );
}

/** Semrush CheckAlt — keyword already in tracker. */
function IconCheckAlt() {
  return (
    <FilledIcon>
      <path d="M12.207 6.707a1 1 0 0 0-1.414-1.414L7 9.086 5.207 7.293a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4.5-4.5Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z"
      />
    </FilledIcon>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M5 2.5H2.5A1 1 0 001.5 3.5v6A1 1 0 002.5 10.5h6a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 1.5h3.5V5M10.5 1.5L5.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Semrush Keyword Overview trigger (Kow). */
function IconOverview() {
  return (
    <FilledIcon width={14} height={13} viewBox="0 0 14 13">
      <path
        clipRule="evenodd"
        fillRule="evenodd"
        d="M13.5 1.5C13.5 0.947715 13.0523 0.5 12.5 0.5H1.5C0.947715 0.5 0.5 0.947716 0.5 1.5V11.5C0.5 12.0523 0.947715 12.5 1.5 12.5H12.5C13.0523 12.5 13.5 12.0523 13.5 11.5V1.5ZM2.5 2.5H9.5C8.94771 2.5 8.5 2.94772 8.5 3.5C8.5 4.05228 8.94771 4.5 9.5 4.5H2.5V2.5ZM9.5 4.5C10.0523 4.5 10.5 4.05228 10.5 3.5C10.5 2.94772 10.0523 2.5 9.5 2.5H11.5V4.5H9.5ZM2.5 6.5H11.5V10.5H2.5V6.5Z"
      />
    </FilledIcon>
  );
}

/** Semrush Settings — gear with center hole. */
function IconSettings() {
  return (
    <FilledIcon>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.667 0a1 1 0 0 0-.962.726l-.4 1.402-.112.062-1.383-.575a1 1 0 0 0-1.175.311L.961 4.09a1 1 0 0 0-.017 1.2l.889 1.218-.059.342-1.235.641a1 1 0 0 0-.52 1.084l.515 2.563a1 1 0 0 0 .889.8l1.47.135.139.2-.17 1.474a1 1 0 0 0 .55 1.012l2.297 1.136a1 1 0 0 0 1.18-.22l.928-1.013h.365l.927 1.012a1 1 0 0 0 1.18.221l2.298-1.136a1 1 0 0 0 .55-1.012l-.17-1.473.14-.2 1.47-.137a1 1 0 0 0 .889-.799l.514-2.563a1 1 0 0 0-.52-1.085l-1.236-.64-.058-.34.888-1.218a1 1 0 0 0-.017-1.202l-1.675-2.165a1 1 0 0 0-1.175-.311l-1.383.575-.113-.062-.4-1.402A1 1 0 0 0 9.33 0H6.667Zm.447 3.08L7.422 2h1.153l.308 1.08a1 1 0 0 0 .483.604l.902.491a1 1 0 0 0 .862.045l1.118-.465.748.966-.695.953a1 1 0 0 0-.178.758l.214 1.248a1 1 0 0 0 .526.719l1.008.522-.22 1.095-1.19.11a1 1 0 0 0-.728.423l-.623.892a1 1 0 0 0-.174.688l.133 1.15-.993.492-.716-.784a1 1 0 0 0-.738-.324H7.377a1 1 0 0 0-.738.325l-.717.783-.993-.492.133-1.15a1 1 0 0 0-.173-.687l-.622-.893a1 1 0 0 0-.728-.423l-1.19-.11-.22-1.096 1.008-.523a1 1 0 0 0 .524-.718l.215-1.248a1 1 0 0 0-.178-.76l-.695-.952.746-.964 1.118.465a1 1 0 0 0 .862-.045l.901-.49a1 1 0 0 0 .484-.605Z"
      />
    </FilledIcon>
  );
}

function IconExport() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5v7M4.5 4L7 1.5 9.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 9.5v2a1 1 0 001 1h7a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrackerToggleButton({
  tracked,
  busy,
  onToggle,
}: {
  tracked: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const label = tracked ? 'Remove keyword from tracker' : 'Add keyword to tracker';
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        ...ghostIconBtn,
        cursor: busy ? 'default' : 'pointer',
        color: tracked ? '#2E7D4F' : '#6A6772',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {tracked ? <IconCheckAlt /> : <IconPlusAlt />}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }}
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="#6A6772" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  rows: OrganicKeyword[];
  total: number;
  domain: string;
  trackerCountry?: string;
  topicLabel: (topicId: string | null) => string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onFilterKeyword?: (keyword: string) => void;
  exportCsvHref?: string;
  exportJsonHref?: string;
  updatedAtLabel?: string | null;
  footer?: React.ReactNode;
};

function Th({
  label, sortKey, active, dir, onSort, align = 'left',
}: {
  label: string;
  sortKey?: string;
  active?: boolean;
  dir?: 'asc' | 'desc';
  onSort?: (k: string) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const clickable = !!sortKey && !!onSort;
  return (
    <th
      onClick={clickable ? () => onSort!(sortKey!) : undefined}
      style={{
        textAlign: align,
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 600,
        color: '#6A6772',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '1px solid #DAD9DE',
        fontFamily: FONT,
        cursor: clickable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        background: '#fff',
      }}
    >
      {label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );
}

function ExpandedPanel({
  kw,
  onFilterKeyword,
}: {
  kw: OrganicKeyword;
  onFilterKeyword?: (keyword: string) => void;
}) {
  const history = useMemo(() => mockPositionHistory(kw), [kw]);
  const href = absoluteUrl(kw.url);
  const curr = kw.position;
  const defaultThen = useMemo(() => {
    if (history.length >= 2) return history[history.length - 2].position;
    if (kw.previousPosition != null) return kw.previousPosition;
    return history[0]?.position ?? null;
  }, [history, kw.previousPosition]);

  const [compareFrom, setCompareFrom] = useState<number | null>(defaultThen);

  // Reset compare when expanding another keyword / history changes
  useEffect(() => {
    setCompareFrom(defaultThen);
  }, [defaultThen, kw.id]);

  const activeSet = useMemo(() => {
    const s = new Set(kw.serpFeatures.map(normalizeFeature));
    return s;
  }, [kw.serpFeatures]);

  const isFeatureOn = (match: string[]) => match.some((m) => {
    const n = normalizeFeature(m);
    for (const f of activeSet) {
      if (f.includes(n) || n.includes(f)) return true;
    }
    return false;
  });

  const thenPos = compareFrom;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(260px, 0.85fr)',
      gap: 24,
      padding: '16px 20px 20px 48px',
      background: '#F7F9FC',
      borderBottom: '1px solid #DAD9DE',
    }}
    >
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: '#181225', fontFamily: FONT }}>
            Ranked URLs (month by month)
          </div>
          {onFilterKeyword && (
            <button
              type="button"
              onClick={() => onFilterKeyword(kw.keyword)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#E07D42',
                fontSize: 12,
                fontFamily: FONT,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Filter by: <span style={{ fontWeight: 600 }}>{kw.keyword}</span>
            </button>
          )}
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #DAD9DE',
          borderRadius: 8,
          padding: '8px 8px 4px',
        }}
        >
          <PositionHistoryChart
            points={history}
            onPickPosition={(position) => setCompareFrom(position)}
          />
          <div style={{
            fontSize: 11,
            color: '#878490',
            fontFamily: FONT,
            padding: '0 8px 8px',
          }}
          >
            Click a point to compare then → now · mock history for now
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 13 }}>
          <span style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: '#5B7CE8',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M2 5.2l2 2 4-4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ color: '#302E36' }}>
            <strong style={{ color: '#181225' }}>{thenPos != null ? thenPos : '—'}</strong>
            <span style={{ margin: '0 6px', color: '#6A6772' }}>→</span>
            <strong style={{ color: '#181225' }}>{curr != null ? curr : '—'}</strong>
          </span>
        </div>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              color: LINK_COLOR,
              fontFamily: 'inherit',
              fontSize: 13,
              textDecoration: 'none',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {href}
          </a>
        ) : (
          <span style={{ color: '#878490', fontSize: 13, fontFamily: FONT }}>No ranking URL</span>
        )}

        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#6A6772',
            fontFamily: FONT,
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
          >
            SERP Features
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 16px',
          }}
          >
            {SERP_CATALOG.map((item) => {
              const on = isFeatureOn(item.match);
              return (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontFamily: FONT,
                    color: on ? '#302E36' : '#A29FAA',
                  }}
                >
                  <span style={{
                    width: 16,
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: on ? 1 : 0.45,
                  }}
                  >
                    <SerpMiniIcon name={item.key} />
                  </span>
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganicKeywordsTable({
  rows,
  total,
  domain,
  trackerCountry = 'US',
  topicLabel,
  sortKey,
  sortDir,
  onSort,
  onFilterKeyword,
  exportCsvHref,
  exportJsonHref,
  updatedAtLabel,
  footer,
}: Props) {
  const router = useRouter();
  const country = trackerCountry.toUpperCase().slice(0, 2);
  const { keywordsData } = useFetchKeywords(router, domain);
  const clearSelectionAfterAddRef = useRef(false);
  const { mutate: addKeywords, isLoading: isAdding } = useAddKeywords(() => {
    if (clearSelectionAfterAddRef.current) {
      setSelected(new Set());
      clearSelectionAfterAddRef.current = false;
    }
  });
  const { mutate: deleteKeywords, isLoading: isRemoving } = useDeleteKeywords(() => {});

  const { trackedKeys, trackedIdByKey } = useMemo(() => {
    const keys = new Set<string>();
    const idByKey = new Map<string, number>();
    for (const k of keywordsData?.keywords ?? []) {
      const key = trackerEntryKey(k.keyword, k.country, k.device);
      keys.add(key);
      idByKey.set(key, k.ID);
    }
    return { trackedKeys: keys, trackedIdByKey: idByKey };
  }, [keywordsData]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [visibleCols, setVisibleCols] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [mockNote, setMockNote] = useState<string | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => new Set(visibleCols), [visibleCols]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));
  const trackerBusy = isAdding || isRemoving;

  useEffect(() => {
    if (!columnsOpen && !exportOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (columnsOpen && columnsMenuRef.current && !columnsMenuRef.current.contains(target)) {
        setColumnsOpen(false);
      }
      if (exportOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setColumnsOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [columnsOpen, exportOpen]);

  const isKeywordTracked = (keyword: string) => trackedKeys.has(trackerEntryKey(keyword, country));

  const addKeywordsToTracker = (keywordTexts: string[], opts?: { clearSelection?: boolean }) => {
    if (!domain) {
      toast.error('Domain is required to add keywords to tracker');
      return;
    }
    const toAdd = keywordTexts
      .map((k) => k.trim())
      .filter((k) => k && !isKeywordTracked(k));
    if (!toAdd.length) {
      toast('Selected keywords are already in the tracker', { icon: 'ℹ️' });
      return;
    }
    clearSelectionAfterAddRef.current = opts?.clearSelection === true;
    addKeywords(toAdd.map((keyword) => ({
      keyword,
      device: TRACKER_DEVICE,
      country,
      domain,
      tags: '',
    })));
  };

  const removeKeywordFromTracker = (keyword: string) => {
    const id = trackedIdByKey.get(trackerEntryKey(keyword, country));
    if (id) deleteKeywords([id]);
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const showMock = (msg: string) => {
    setMockNote(msg);
    window.setTimeout(() => setMockNote(null), 2800);
  };

  const colCount = 2 + visibleCols.length;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #DAD9DE',
      borderRadius: 8,
      overflow: 'hidden',
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid #DAD9DE',
        gap: 12,
        flexWrap: 'wrap',
      }}
      >
        <div style={{ fontSize: 15, color: '#181225', fontFamily: FONT }}>
          <span style={{ fontWeight: 400 }}>Organic Search Positions:</span>
          {' '}
          <span style={{ fontWeight: 700 }}>{total.toLocaleString()}</span>
          {updatedAtLabel && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#6A6772' }}>
              {updatedAtLabel}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<IconPlus />}
            disabled={trackerBusy}
            onClick={() => {
              if (!selected.size) {
                toast.error('Select keywords first');
                return;
              }
              const keywords = rows.filter((r) => selected.has(r.id)).map((r) => r.keyword);
              addKeywordsToTracker(keywords, { clearSelection: true });
            }}
          >
            Add keyword to tracker
          </Button>
          <div ref={columnsMenuRef} style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<IconSettings />}
              aria-expanded={columnsOpen}
              aria-haspopup="menu"
              onClick={() => {
                setExportOpen(false);
                setColumnsOpen((o) => !o);
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Manage columns
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 36,
                  height: 18,
                  padding: '0 6px',
                  borderRadius: 999,
                  background: '#F0F0F2',
                  color: '#6A6772',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: FONT,
                  lineHeight: 1,
                }}
                >
                  {`${visibleCols.length}/${ALL_COLUMNS.length}`}
                </span>
              </span>
            </Button>
            {columnsOpen && (
              <div
                role="menu"
                aria-label="Show table columns"
                style={{
                  ...dropdownPanel,
                  top: 'calc(100% + 6px)',
                  width: 240,
                  maxHeight: 'min(420px, 70vh)',
                  overflowY: 'auto',
                  padding: '12px 0 8px',
                }}
              >
                <div style={{
                  padding: '0 14px 6px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#181225',
                }}
                >
                  Show table columns
                </div>
                <button
                  type="button"
                  onClick={() => setVisibleCols([...DEFAULT_VISIBLE])}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '0 14px 10px',
                    margin: 0,
                    fontSize: 13,
                    color: LINK_COLOR,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  Reset to default
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {ALL_COLUMNS.map((col) => {
                    const on = visibleCols.includes(col.id);
                    const locked = 'locked' in col && col.locked === true;
                    return (
                      <label
                        key={col.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '7px 14px',
                          fontSize: 13,
                          color: locked ? '#878490' : '#302E36',
                          cursor: locked ? 'default' : 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <Checkbox
                          size="sm"
                          checked={on}
                          disabled={locked}
                          onChange={(checked) => {
                            if (locked) return;
                            setVisibleCols((prev) => {
                              if (checked) {
                                return ALL_COLUMNS.map((c) => c.id).filter(
                                  (id) => prev.includes(id) || id === col.id,
                                );
                              }
                              return prev.filter((id) => id !== col.id);
                            });
                          }}
                        />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<IconExport />}
              onClick={() => {
                setColumnsOpen(false);
                setExportOpen((o) => !o);
              }}
            >
              Export
            </Button>
            {exportOpen && (
              <div style={{
                ...dropdownPanel,
                top: '110%',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                zIndex: 20,
                minWidth: 160,
                padding: 4,
              }}
              >
                {exportCsvHref && (
                  <a
                    href={exportCsvHref}
                    style={exportLinkStyle}
                    onClick={() => setExportOpen(false)}
                  >
                    CSV
                  </a>
                )}
                {exportJsonHref && (
                  <a
                    href={exportJsonHref}
                    style={exportLinkStyle}
                    onClick={() => setExportOpen(false)}
                  >
                    JSON
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {mockNote && (
        <div style={{
          padding: '8px 16px',
          background: '#FFF8F3',
          borderBottom: '1px solid #DAD9DE',
          fontSize: 12,
          color: '#E07D42',
          fontFamily: FONT,
        }}
        >
          {mockNote}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, width: 44, paddingLeft: 12 }}>
                <span style={{ display: 'inline-block', width: 12 }} />
              </th>
              <th style={{ ...thBase, width: 36, paddingRight: 4 }}>
                <Checkbox
                  size="sm"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onChange={toggleAll}
                />
              </th>
              {visible.has('keyword') && (
                <Th label="Keyword" sortKey="keyword" active={sortKey === 'keyword'} dir={sortDir} onSort={onSort} />
              )}
              {visible.has('intent') && <Th label="Intent" align="center" />}
              {visible.has('position') && (
                <Th label="Pos." sortKey="position" active={sortKey === 'position'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('sf') && <Th label="SF" align="center" />}
              {visible.has('traffic') && (
                <Th label="Traffic" sortKey="traffic" active={sortKey === 'traffic'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('trafficShare') && (
                <Th label="Traffic %" sortKey="trafficShare" active={sortKey === 'trafficShare'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('volume') && (
                <Th label="Volume" sortKey="volume" active={sortKey === 'volume'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('difficulty') && (
                <Th label="KD %" sortKey="difficulty" active={sortKey === 'difficulty'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('url') && <Th label="URL" />}
              {visible.has('updatedAt') && (
                <Th label="Updated" sortKey="updatedAt" active={sortKey === 'updatedAt'} dir={sortDir} onSort={onSort} />
              )}
              {visible.has('topic') && <Th label="Topic" />}
              {visible.has('trend') && <Th label="Trend" align="center" />}
              {visible.has('opportunityScore') && (
                <Th label="Opp." sortKey="opportunityScore" active={sortKey === 'opportunityScore'} dir={sortDir} onSort={onSort} align="right" />
              )}
              {visible.has('cpc') && <Th label="CPC" align="right" />}
              {visible.has('competition') && <Th label="Competition" align="right" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => {
              const open = expandedId === k.id;
              const href = absoluteUrl(k.url);
              const tracked = isKeywordTracked(k.keyword);
              return (
                <React.Fragment key={k.id}>
                  <tr className="si-organic-row" style={{ background: open ? '#F8F8F9' : undefined }}>
                    <td style={{ ...td, width: 44, paddingLeft: 12 }}>
                      <button
                        type="button"
                        aria-label={open ? 'Collapse row' : 'Expand row'}
                        aria-expanded={open}
                        onClick={() => setExpandedId(open ? null : k.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 4,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Chevron open={open} />
                      </button>
                    </td>
                    <td style={{ ...td, width: 36, paddingRight: 4 }}>
                      <Checkbox
                        size="sm"
                        checked={selected.has(k.id)}
                        onChange={() => toggleRow(k.id)}
                      />
                    </td>
                    {visible.has('keyword') && (
                      <td
                        onClick={() => setExpandedId(open ? null : k.id)}
                        style={{
                          ...td,
                          fontWeight: 600,
                          color: LINK_COLOR,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <TrackerToggleButton
                            tracked={tracked}
                            busy={trackerBusy}
                            onToggle={() => {
                              if (tracked) removeKeywordFromTracker(k.keyword);
                              else addKeywordsToTracker([k.keyword]);
                            }}
                          />
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              title="Open ranking URL"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: LINK_COLOR, fontFamily: 'inherit', textDecoration: 'none' }}
                            >
                              {k.keyword}
                            </a>
                          ) : (
                            <span style={{ color: LINK_COLOR, fontFamily: 'inherit' }}>{k.keyword}</span>
                          )}
                          <button
                            type="button"
                            title="Open overview"
                            aria-label="Open overview"
                            data-testid="kow-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              showMock(`Mock: open overview for “${k.keyword}”`);
                            }}
                            style={{ ...ghostIconBtn, color: '#6A6772' }}
                          >
                            <IconOverview />
                          </button>
                        </span>
                      </td>
                    )}
                    {visible.has('intent') && (
                      <td style={{ ...td, textAlign: 'center' }}><IntentBadge intent={k.intent} /></td>
                    )}
                    {visible.has('position') && (
                      <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{k.position ?? '—'}</td>
                    )}
                    {visible.has('sf') && (
                      <td style={{ ...td, textAlign: 'center' }}><SerpIcons features={k.serpFeatures} /></td>
                    )}
                    {visible.has('traffic') && (
                      <td style={{ ...td, textAlign: 'right' }}>{k.traffic != null ? formatCompact(k.traffic) : '—'}</td>
                    )}
                    {visible.has('trafficShare') && (
                      <td style={{ ...td, textAlign: 'right' }}>{k.trafficShare != null ? k.trafficShare.toFixed(2) : '—'}</td>
                    )}
                    {visible.has('volume') && (
                      <td style={{ ...td, textAlign: 'right' }}>{k.volume != null ? formatCompact(k.volume) : '—'}</td>
                    )}
                    {visible.has('difficulty') && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        {k.difficulty != null ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: kdDotColor(k.difficulty),
                              flexShrink: 0,
                            }}
                            />
                            {k.difficulty}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {visible.has('url') && (
                      <td style={td}>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: LINK_COLOR,
                              fontFamily: 'inherit',
                              textDecoration: 'none',
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              maxWidth: 220,
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pagePath(k.url)}
                            </span>
                            <IconExternal />
                          </a>
                        ) : '—'}
                      </td>
                    )}
                    {visible.has('updatedAt') && (
                      <td style={{ ...td, color: '#6A6772', fontSize: 12 }}>{formatUpdated(k.updatedAt)}</td>
                    )}
                    {visible.has('topic') && (
                      <td style={td}>{topicLabel(k.topicId)}</td>
                    )}
                    {visible.has('trend') && (
                      <td style={{ ...td, textAlign: 'center' }}><TrendCell kw={k} /></td>
                    )}
                    {visible.has('opportunityScore') && (
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#E07D42' }}>
                        {k.opportunityScore ?? '—'}
                      </td>
                    )}
                    {visible.has('cpc') && (
                      <td style={{ ...td, textAlign: 'right', color: '#878490' }}>—</td>
                    )}
                    {visible.has('competition') && (
                      <td style={{ ...td, textAlign: 'right', color: '#878490' }}>—</td>
                    )}
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={colCount} style={{ padding: 0, borderBottom: 'none' }}>
                        <ExpandedPanel kw={k} onFilterKeyword={onFilterKeyword} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={colCount} style={{ ...td, textAlign: 'center', color: '#6A6772', padding: 32 }}>
                  No keywords match current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #DAD9DE',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
        >
          {footer}
        </div>
      )}

    </div>
  );
}

const thBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6A6772',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #DAD9DE',
  fontFamily: FONT,
  background: '#fff',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #F0F0F2',
  fontSize: 13,
  color: '#302E36',
  verticalAlign: 'middle',
};
