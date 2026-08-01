import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContent,
  DataTableEmpty,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
} from '../koala/core';
import { Icon } from '../koala/icons';
import { KeywordDifficultyDot } from '../koala/product/helpers/KeywordDifficultyDot';
import { StatusBadge } from '../koala/primitives/StatusBadge';
import type { StatusTone } from '../koala/primitives/StatusBadge';
import { TablePattern } from '../koala/product';
import type { RankKeywordStatus, RankTrackingConfigRow, RankTrackingRow } from '../../lib/types/rankTracking';
import AddKeywordsModal from './AddKeywordsModal';
import Chart from '../common/Chart';

const FONT = 'var(--font-family-primary)';
const ACCENT = 'var(--koala-text-brand, #F84416)';

function rankStatusBadge(
  status: RankKeywordStatus | undefined,
  hasSnapshot: boolean,
): { tone: StatusTone; label?: string; sub?: string } | null {
  if (status === 'failed') return { tone: 'failed', label: 'Failed', sub: 'Check failed' };
  if (status === 'paused') return { tone: 'cancelled', label: 'Paused' };
  if (status === 'queued') return { tone: 'queued', sub: 'Waiting for run' };
  if (status === 'running') return { tone: 'running', sub: 'Updating…' };
  if (!hasSnapshot) return { tone: 'queued', label: 'Queued', sub: 'Waiting for first check' };
  return null;
}

function statusRelativeLabel(
  relative: string | null,
  status: RankKeywordStatus | undefined,
): string | null {
  if (relative && status === 'active') return relative;
  return null;
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

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.trackingKeywordId));
  const localeLabel = config
    ? `${config.language_code?.toUpperCase() || 'EN'} / ${config.location_name || config.language_code}`
    : '';
  const relative = formatRelative(lastCheckedAt);

  return (
    <TablePattern
      title="Tracked Keywords"
      titleMeta={`(${total}/${limit})`}
      toolbar={{
        searchValue: search,
        onSearchChange,
        searchPlaceholder: 'Search by keyword or URL',
        selectionCount: selected.size,
        selectionActions: (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={selected.size === 0 || archiving}
              busy={archiving}
              onClick={() => onArchive([...selected])}
              icon={<Icon name="Trash" size={16} />}
            >
              Delete
            </Button>
          </>
        ),
        actions: (
          <>
            {exportHref ? (
              <a href={exportHref} style={{ textDecoration: 'none' }}>
                <Button type="button" variant="secondary" size="sm" icon={<Icon name="Export" size={16} />}>
                  Export
                </Button>
              </a>
            ) : null}
            {onRefreshMetrics ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRefreshMetrics} busy={metricsBusy}>
                Update SEO Difficulty
              </Button>
            ) : null}
            <Button type="button" variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              + Add Keywords
            </Button>
          </>
        ),
      }}
    >
      <DataTable>
        <DataTableContent minWidth={960} aria-label="Tracked keywords">
          <DataTableHeader>
            <DataTableHeadCell width={44}>
              <Checkbox
                checked={allSelected}
                onChange={(checked) => {
                  if (checked) setSelected(new Set(rows.map((r) => r.trackingKeywordId)));
                  else setSelected(new Set());
                }}
              />
            </DataTableHeadCell>
            <DataTableHeadCell width={110}>Position</DataTableHeadCell>
            <DataTableHeadCell flex={1} minWidth={180}>Keyword</DataTableHeadCell>
            <DataTableHeadCell width={140}>Change</DataTableHeadCell>
            <DataTableHeadCell width={80}>Vol</DataTableHeadCell>
            <DataTableHeadCell width={100}>SEO Diff.</DataTableHeadCell>
            <DataTableHeadCell flex={1} minWidth={160}>URL</DataTableHeadCell>
            <DataTableHeadCell width={44} align="center" />
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
                const badge = rankStatusBadge(status, dev.hasSnapshot);
                const relativeLabel = statusRelativeLabel(relative, status);
                const selectedRow = selected.has(row.trackingKeywordId);
                const expanded = expandedId === row.trackingKeywordId;
                const trend = trendById.get(row.trackingKeywordId);

                return (
                  <React.Fragment key={row.trackingKeywordId}>
                    <DataTableRow selected={selectedRow} style={{ flexWrap: 'wrap' }}>
                      <DataTableCell width={44}>
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
                      </DataTableCell>
                      <DataTableCell width={110} stack>
                        {dev.hasSnapshot && dev.position != null ? (
                          <span style={{ fontWeight: 600 }}>{dev.position}</span>
                        ) : badge ? (
                          <>
                            <StatusBadge status={badge.tone} label={badge.label} />
                            {badge.sub ? (
                              <span style={{ fontSize: 12, color: 'var(--koala-text-secondary)' }}>{badge.sub}</span>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{relativeLabel ?? 'Active'}</span>
                        )}
                      </DataTableCell>
                      <DataTableCell flex={1} minWidth={180} stack>
                        <span style={{ color: ACCENT, fontWeight: 600 }}>{row.keyword}</span>
                        <span style={{ fontSize: 12, color: 'var(--koala-text-secondary)' }}>{localeLabel}</span>
                      </DataTableCell>
                      <DataTableCell width={140} stack style={{ gap: 6 }}>
                        {dev.hasSnapshot && dev.previousPosition != null && dev.position != null ? (
                          <>
                            <div style={{ display: 'flex', gap: 6, color: 'var(--koala-text-secondary)', fontSize: 14 }}>
                              <span>{dev.previousPosition}</span>
                              <span>→</span>
                              <span style={{ color: 'var(--koala-text-primary)', fontWeight: 600 }}>{dev.position}</span>
                            </div>
                            <Button
                              type="button"
                              variant={expanded ? 'primary' : 'secondary'}
                              size="xs"
                              onClick={() => onToggleTrend(row.trackingKeywordId)}
                              style={
                                expanded
                                  ? undefined
                                  : { borderColor: 'var(--koala-border-brand)', color: ACCENT }
                              }
                            >
                              See Trend
                            </Button>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell width={80}>
                        {row.searchVolume != null ? row.searchVolume.toLocaleString() : '—'}
                      </DataTableCell>
                      <DataTableCell width={100}>
                        <KeywordDifficultyDot kd={row.keywordDifficulty} />
                      </DataTableCell>
                      <DataTableCell flex={1} minWidth={160} style={{ overflow: 'hidden' }}>
                        {dev.rankingUrl ? (
                          <a
                            href={dev.rankingUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: ACCENT,
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              maxWidth: '100%',
                            }}
                            title={dev.rankingUrl}
                          >
                            {dev.rankingUrl}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell width={44} align="center">
                        <Icon name="Monitor" size={16} color="var(--koala-text-secondary)" />
                      </DataTableCell>
                      {expanded ? (
                        <div
                          style={{
                            width: '100%',
                            padding: 16,
                            background: 'var(--koala-bg-secondary)',
                            borderTop: '1px solid var(--koala-border-primary)',
                          }}
                        >
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
                              <div style={{ color: 'var(--koala-text-secondary)', fontSize: 13 }}>Loading trend…</div>
                            )}
                          </div>
                        </div>
                      ) : null}
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
    </TablePattern>
  );
}
