import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  DataTable,
  DataTableBody,
  DataTableContent,
  DataTableEmpty,
  DataTableHeader,
  DataTableRow,
} from '../core';
import type { RankKeywordStatus, RankTrackingConfigRow, RankTrackingRow } from '../../lib/types/rankTracking';
import AddKeywordsModal from './AddKeywordsModal';
import Chart from '../common/Chart';

const FONT = 'var(--font-family-primary)';
const ACCENT = '#F29964';

function statusLabel(
  status: RankKeywordStatus | undefined,
  hasSnapshot: boolean,
  relative: string | null,
): { title: string; sub?: string } {
  if (status === 'failed') return { title: 'Failed', sub: 'Check failed' };
  if (status === 'paused') return { title: 'Paused' };
  if (status === 'queued') return { title: 'Queued', sub: 'Waiting for run' };
  if (status === 'running') return { title: 'Running', sub: 'Updating…' };
  if (!hasSnapshot) return { title: 'Queued', sub: 'Waiting for first check' };
  if (relative && status === 'active') return { title: relative };
  return { title: 'Active' };
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'Updated just now';
  if (h < 48) return `Updated ${h}h ago`;
  return `Updated ${Math.floor(h / 24)}d ago`;
}

const cellPad: React.CSSProperties = {
  padding: '12px',
  fontSize: 13,
  color: '#302E36',
  fontFamily: FONT,
  display: 'flex',
  alignItems: 'center',
  borderLeft: '1px solid #F4F4F5',
};

const headPad: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: '#6A6772',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontFamily: FONT,
  display: 'flex',
  alignItems: 'center',
};

type Props = {
  rows: RankTrackingRow[];
  total: number;
  limit: number;
  config: RankTrackingConfigRow | undefined;
  statusById: Map<number, RankKeywordStatus>;
  lastCheckedAt: string | null;
  loading?: boolean;
  onAdd: (keywords: string[]) => void;
  adding?: boolean;
  onArchive: (ids: number[]) => void;
  archiving?: boolean;
  onRefreshMetrics?: () => void;
  metricsBusy?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  exportHref: string | null;
  trendById: Map<number, Array<{ date: string; position: number | null }>>;
  onToggleTrend: (id: number) => void;
  expandedId: number | null;
};

export default function TrackedKeywordsTable({
  rows,
  total,
  limit,
  config,
  statusById,
  lastCheckedAt,
  loading,
  onAdd,
  adding,
  onArchive,
  archiving,
  onRefreshMetrics,
  metricsBusy,
  search,
  onSearchChange,
  exportHref,
  trendById,
  onToggleTrend,
  expandedId,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.trackingKeywordId));
  const localeLabel = config
    ? `${config.language_code?.toUpperCase() || 'EN'} / ${config.location_name || config.language_code}`
    : '';
  const relative = formatRelative(lastCheckedAt);

  return (
    <div>
      <h3 style={{ margin: '32px 0 0', fontFamily: FONT, fontSize: 18, color: '#181225', fontWeight: 600 }}>
        Tracked Keywords
        <span style={{ fontSize: 16, color: 'rgba(32,32,32,0.5)', marginLeft: 4, fontWeight: 400 }}>
          ({total}/{limit})
        </span>
      </h3>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '20px 0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Button type="button" variant="primary" onClick={() => setAddOpen(true)}>
            + Add Keywords
          </Button>
          {exportHref && (
            <a href={exportHref} style={{ textDecoration: 'none' }}>
              <Button type="button" variant="primary">
                Export to CSV
              </Button>
            </a>
          )}
          {onRefreshMetrics && (
            <Button type="button" variant="secondary" onClick={onRefreshMetrics} busy={metricsBusy}>
              Update SEO Difficulty
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={selected.size === 0 || archiving}
            busy={archiving}
            onClick={() => onArchive([...selected])}
          >
            Delete
          </Button>
          <span style={{ fontSize: 14, color: '#D1D7D9', fontFamily: FONT }}>
            {selected.size} of {rows.length} Selected
          </span>
        </div>
        <Button type="button" variant="transparent" onClick={() => setFiltersOpen((v) => !v)}>
          Filters
        </Button>
      </div>

      {filtersOpen && (
        <div style={{ padding: '12px 0 20px', borderBottom: '1px solid #bebebe', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#6A6772', marginBottom: 6, fontFamily: FONT }}>Search by keyword or URL</div>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Enter a keyword or URL"
            style={{
              width: '100%',
              maxWidth: 420,
              height: 40,
              border: '1px solid #bebebe',
              borderRadius: 8,
              padding: '0 12px',
              fontFamily: FONT,
              fontSize: 14,
            }}
          />
        </div>
      )}

      <DataTable style={{ borderColor: '#bebebe' }}>
        <DataTableContent minWidth={960} aria-label="Tracked keywords" style={{ overflow: 'visible' }}>
            <DataTableHeader style={{ position: 'static' }}>
              <div style={{ ...headPad, width: 44, borderLeft: 'none' }}>
                <Checkbox
                  checked={allSelected}
                  onChange={(checked) => {
                    if (checked) setSelected(new Set(rows.map((r) => r.trackingKeywordId)));
                    else setSelected(new Set());
                  }}
                />
              </div>
              <div style={{ ...headPad, width: 110 }}>Position</div>
              <div style={{ ...headPad, flex: 1, minWidth: 180 }}>Keyword</div>
              <div style={{ ...headPad, width: 140 }}>Change</div>
              <div style={{ ...headPad, width: 80 }}>Vol</div>
              <div style={{ ...headPad, width: 100 }}>SEO Diff.</div>
              <div style={{ ...headPad, flex: 1, minWidth: 160 }}>URL</div>
              <div style={{ ...headPad, width: 40 }} />
            </DataTableHeader>

            <DataTableBody>
              {loading && rows.length === 0 ? (
                <DataTableEmpty>Loading…</DataTableEmpty>
              ) : rows.length === 0 ? (
                <DataTableEmpty>
                  No tracked keywords yet. Add keywords from Keyword list or use Add Keywords.
                </DataTableEmpty>
              ) : (
                rows.map((row) => {
                  const status = statusById.get(row.trackingKeywordId);
                  const dev = row.desktop;
                  const posLabel = statusLabel(status, dev.hasSnapshot, relative);
                  const selectedRow = selected.has(row.trackingKeywordId);
                  const expanded = expandedId === row.trackingKeywordId;
                  const trend = trendById.get(row.trackingKeywordId);

                  return (
                    <React.Fragment key={row.trackingKeywordId}>
                      <DataTableRow selected={selectedRow} style={{ minHeight: 56, flexWrap: 'wrap' }}>
                        <div style={{ ...cellPad, width: 44, borderLeft: 'none' }}>
                          <Checkbox
                            checked={selectedRow}
                            onChange={(checked) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(row.trackingKeywordId);
                                else next.delete(row.trackingKeywordId);
                                return next;
                              });
                            }}
                          />
                        </div>
                        <div style={{ ...cellPad, width: 110, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          {dev.hasSnapshot && dev.position != null ? (
                            <span style={{ fontWeight: 600 }}>{dev.position}</span>
                          ) : (
                            <>
                              <span style={{ fontWeight: 600 }}>{posLabel.title}</span>
                              {posLabel.sub && <span style={{ fontSize: 12, color: '#A3B0B3' }}>{posLabel.sub}</span>}
                            </>
                          )}
                        </div>
                        <div style={{ ...cellPad, flex: 1, minWidth: 180, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ color: ACCENT, fontWeight: 600 }}>{row.keyword}</span>
                          <span style={{ fontSize: 12, color: '#6A6772' }}>{localeLabel}</span>
                        </div>
                        <div style={{ ...cellPad, width: 140, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                          {dev.hasSnapshot && dev.previousPosition != null && dev.position != null ? (
                            <>
                              <div style={{ display: 'flex', gap: 6, color: '#A3B0B3', fontSize: 14 }}>
                                <span>{dev.previousPosition}</span>
                                <span>→</span>
                                <span style={{ color: '#181225', fontWeight: 600 }}>{dev.position}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onToggleTrend(row.trackingKeywordId)}
                                style={{
                                  border: '1px solid #c97e52',
                                  background: expanded ? ACCENT : '#fff',
                                  color: expanded ? '#fff' : ACCENT,
                                  borderRadius: 6,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  fontFamily: FONT,
                                }}
                              >
                                See Trend
                              </button>
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        <div style={{ ...cellPad, width: 80 }}>
                          {row.searchVolume != null ? row.searchVolume.toLocaleString() : '—'}
                        </div>
                        <div style={{ ...cellPad, width: 100 }}>
                          {row.keywordDifficulty != null ? row.keywordDifficulty : '—'}
                        </div>
                        <div style={{ ...cellPad, flex: 1, minWidth: 160, overflow: 'hidden' }}>
                          {dev.rankingUrl ? (
                            <a
                              href={dev.rankingUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: ACCENT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}
                              title={dev.rankingUrl}
                            >
                              {dev.rankingUrl}
                            </a>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        <div style={{ ...cellPad, width: 40, justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Desktop">
                            <path d="M1.5.5h13c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1h-13c-.55 0-1-.45-1-1v-10c0-.55.45-1 1-1z" stroke="#444" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M.5 9.5h15M3.5 15.5h9M6.5 12.5v3M9.5 12.5v3" stroke="#444" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        {expanded && (
                          <div style={{ width: '100%', padding: 16, background: '#fafaf8', borderTop: '1px solid #bebebe' }}>
                            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                              History of {row.keyword}
                            </div>
                            <div style={{ height: 160 }}>
                              {trend && trend.length > 0 ? (
                                <Chart
                                  labels={trend.map((p) => p.date)}
                                  series={trend.map((p) => p.position ?? 0)}
                                  reverse
                                />
                              ) : (
                                <div style={{ color: '#6A6772', fontSize: 13 }}>Loading trend…</div>
                              )}
                            </div>
                          </div>
                        )}
                      </DataTableRow>
                    </React.Fragment>
                  );
                })
              )}
            </DataTableBody>
        </DataTableContent>
      </DataTable>

      <AddKeywordsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAdd}
        loading={adding}
      />
    </div>
  );
}
