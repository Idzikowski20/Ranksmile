import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAddKeywords, useDeleteKeywords, useFetchKeywords } from '../../../services/keywords';
import { Button, Checkbox } from '../../core';
import type { OrganicKeyword, SearchIntent } from '../../../lib/organicResearch/types';
import { formatCompact } from './OrganicKpiRow';
import { DEFAULT_VISIBLE, OrganicColumnMenu, type ColumnId } from './OrganicColumnMenu';
import { ExpandedPanel } from './OrganicKeywordExpand';
import { absoluteUrl, SerpMiniIcon } from './organicSerp';

const FONT = 'var(--font-family-primary)';
/** Semrush Intergalactic text-link */
const LINK_COLOR = 'rgb(35, 95, 226)';

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
          <OrganicColumnMenu
            open={columnsOpen}
            onToggle={() => {
              setExportOpen(false);
              setColumnsOpen((o) => !o);
            }}
            menuRef={columnsMenuRef}
            visibleCols={visibleCols}
            onChange={setVisibleCols}
          />
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
