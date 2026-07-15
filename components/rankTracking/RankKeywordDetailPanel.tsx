import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Chart from '../common/Chart';
import { CompactSelect } from '../core';
import type { SelectOption } from '../core';
import { XIcon } from '../surfer/icons';
import useOnKey from '../../hooks/useOnKey';
import { useRankKeywordHistory } from '../../services/rankTracking';
import { generateTheChartData } from '../../utils/client/generateChartData';
import type { RankSnapshotRow, RankTrackingRow } from '../../lib/types/rankTracking';

const FONT = 'var(--font-family-primary)';

const PANEL_SHELL: React.CSSProperties = {
  position: 'fixed',
  top: 8,
  bottom: 8,
  right: 8,
  width: 480,
  maxWidth: 'calc(100vw - 16px)',
  zIndex: 301,
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)',
  border: '1px solid #E4E4E7',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

type SerpRawItem = {
  type?: string;
  rank_absolute?: number | null;
  rank_group?: number | null;
  title?: string | null;
  url?: string | null;
  domain?: string | null;
};

type Props = {
  row: RankTrackingRow | null;
  slug: string;
  configId: number | undefined;
  onClose: () => void;
};

const PERIOD_OPTIONS: SelectOption[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '360', label: '1 year' },
  { value: 'all', label: 'All time' },
];

function parseRawItems(raw: unknown): SerpRawItem[] {
  if (Array.isArray(raw)) return raw as SerpRawItem[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as SerpRawItem[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function itemPosition(item: SerpRawItem): number {
  return item.rank_absolute ?? item.rank_group ?? 0;
}

function snapshotsToHistory(snapshots: RankSnapshotRow[]): KeywordHistory {
  const history: KeywordHistory = {};
  for (const snap of snapshots) {
    const d = new Date(snap.checked_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    history[key] = snap.found && snap.position != null ? snap.position : 0;
  }
  return history;
}

const IconButton = ({ children, onClick, href, ariaLabel }: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  ariaLabel: string;
}) => {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#52525C',
    cursor: 'pointer',
    padding: 0,
    transition: 'opacity 150ms ease',
  };
  const hover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '0.7'; };
  const out = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '1'; };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} style={{ ...style, textDecoration: 'none' }} onMouseEnter={hover} onMouseLeave={out}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} style={style} onMouseEnter={hover} onMouseLeave={out}>
      {children}
    </button>
  );
};

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <g fillRule="evenodd" clipRule="evenodd">
      <path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" />
      <path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" />
    </g>
  </svg>
);

export default function RankKeywordDetailPanel({ row, slug, configId, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [chartTime, setChartTime] = useState('30');
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const historyQ = useRankKeywordHistory(
    slug || undefined,
    configId,
    row?.trackingKeywordId,
  );
  const snapshots = historyQ.data?.snapshots ?? [];
  const loading = historyQ.isLoading;

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 220);
  }, [onClose]);

  useOnKey('Escape', handleClose);

  useEffect(() => {
    if (row) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    return undefined;
  }, [row]);

  const d = row?.desktop;
  const position = d?.found && d.position != null ? d.position : 0;
  const notFoundLabel = position === 0 ? 'Not in top 100' : `Position ${position}`;

  const chartData = useMemo(() => {
    if (!snapshots.length) return { labels: [] as string[], series: [] as number[] };
    return generateTheChartData(snapshotsToHistory(snapshots), chartTime);
  }, [snapshots, chartTime]);

  const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const serpItems = useMemo(() => {
    const raw = parseRawItems(latestSnapshot?.raw_items);
    return raw
      .filter((item) => item.type === 'organic' && item.url && item.title)
      .map((item) => ({
        position: itemPosition(item),
        url: item.url as string,
        title: item.title as string,
      }))
      .sort((a, b) => a.position - b.position);
  }, [latestSnapshot]);

  useEffect(() => {
    const container = scrollRef.current;
    const target = highlightRef.current;
    if (!container || !target || position <= 0 || position >= 100) return;
    const top = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [serpItems, position]);

  if (!row) return null;

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(row.keyword)}`;

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.12)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
      <div
        style={{
          ...PANEL_SHELL,
          transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
          transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px 12px', gap: 12, flexShrink: 0 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Keyword
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 16 }}>
            <IconButton href={googleSearchUrl} ariaLabel="Open Google search">
              <ExternalLinkIcon />
            </IconButton>
          </div>
          <IconButton ariaLabel="Close" onClick={handleClose}>
            <XIcon />
          </IconButton>
        </div>

        <div
          ref={scrollRef}
          className="styled-scrollbar"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px 32px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: FONT, lineHeight: '24px', wordBreak: 'break-word' }}>
                {row.keyword}
              </h2>
              <span style={{
                alignSelf: 'flex-start',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT,
                background: position === 0 ? '#F4F4F5' : 'rgba(242,153,100,0.15)',
                color: position === 0 ? '#71717B' : '#C97D52',
              }}
              >
                {notFoundLabel}
              </span>
            </div>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>SERP History</h3>
                <CompactSelect
                  size="sm"
                  value={chartTime}
                  options={PERIOD_OPTIONS}
                  onChange={(opt) => setChartTime(String(opt.value))}
                  menuMinWidth={160}
                />
              </div>
              <div style={{ height: 200, border: '1px solid #E4E4E7', borderRadius: 12, padding: 12, background: '#FAFAFA', overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>
                    Loading history…
                  </div>
                ) : chartData.labels.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#9F9FA9', fontFamily: FONT, textAlign: 'center', padding: '0 12px' }}>
                    No position history yet. Run a rank check to collect data.
                  </div>
                ) : (
                  <Chart labels={chartData.labels} series={chartData.series} />
                )}
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #E4E4E7', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>
                  Google Search Result
                </h3>
                {latestSnapshot?.checked_at && (
                  <span style={{ fontSize: 12, color: '#71717B', fontFamily: FONT, flexShrink: 0 }}>
                    {dayjs(latestSnapshot.checked_at).format('MMMM D, YYYY')}
                  </span>
                )}
              </div>

              {serpItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>
                  {loading ? 'Loading SERP preview…' : 'No SERP snapshot available for this keyword.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {serpItems.map((item) => {
                    const isOurs = position > 0 && item.position === position;
                    return (
                      <div
                        key={`${item.position}-${item.url}`}
                        ref={isOurs ? highlightRef : undefined}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: isOurs ? '1px solid rgba(242,153,100,0.45)' : '1px solid #F4F4F5',
                          background: isOurs ? 'rgba(242,153,100,0.08)' : '#FFFFFF',
                        }}
                      >
                        <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4 }}>
                          <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'none' }}>
                            {item.position}. {item.title}
                          </a>
                        </h4>
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1AB25E', fontFamily: FONT, wordBreak: 'break-all' }}>
                          {item.url}
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
