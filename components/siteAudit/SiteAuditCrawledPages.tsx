import React, { useMemo, useState } from 'react';
import {
  Button,
  CompactSelect,
  Pagination,
  getPaginationCaption,
} from '../core';
import {
  SentryEmptyState,
  SentryPanel,
  SentryPanelBody,
  SentryPanelHeader,
  SentryTable,
  SentryTableBody,
  SentryTableCell,
  SentryTableHead,
  SentryTableHeaderCell,
  SentryTableRow,
} from '../sentry-pages';
import CrawledPagesManageColumns, {
  DEFAULT_CRAWLED_PAGE_VISIBLE,
  type CrawledPageColumnKey,
} from './CrawledPagesManageColumns';
import { UrlCell } from './AuditUrlCell';
import { BotIcon, PRIMARY_BOTS } from './aiSearchBots';
import { scoreColor } from '../../lib/scoreColor';
import type { CrawledPageRow, CrawledPagesReport } from '../../lib/siteAudit/types';

type SortKey = 'score' | 'url' | 'title' | 'statusCode' | 'issues' | 'depth';

type Props = {
  report: CrawledPagesReport;
};

const PAGE_SIZE = 50;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={active ? 'sentry-crawled-pages-sort--active' : 'sentry-crawled-pages-sort'}>
      <path d="M13 3a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2h10ZM10 8a1 1 0 0 0-1-1H3a1 1 0 1 0 0 2h6a1 1 0 0 0 1-1ZM6 12a1 1 0 0 0-1-1H3a1 1 0 1 0 0 2h2a1 1 0 0 0 1-1Z" opacity={active && dir === 'asc' ? 0.35 : 1} />
    </svg>
  );
}

function statusTone(code: number | null, label: string): 'ok' | 'redirect' | 'error' | 'neutral' {
  if (code === 200) return 'ok';
  if (code !== null && code >= 300 && code < 400) return 'redirect';
  if (code !== null && code >= 400) return 'error';
  if (label.toLowerCase().includes('redirect')) return 'redirect';
  if (label.toLowerCase().includes('error') || label === '403' || label === '404') return 'error';
  return 'neutral';
}

function compareRows(a: CrawledPageRow, b: CrawledPageRow, key: SortKey, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'score':
      return sign * ((a.score ?? -1) - (b.score ?? -1));
    case 'url':
      return sign * a.url.localeCompare(b.url);
    case 'title':
      return sign * (a.title ?? '').localeCompare(b.title ?? '');
    case 'statusCode':
      return sign * ((a.statusCode ?? 999) - (b.statusCode ?? 999));
    case 'issues':
      return sign * (a.issueCount - b.issueCount);
    case 'depth':
      return sign * (a.depth - b.depth);
    default:
      return 0;
  }
}

function IssuesCell({ row }: { row: CrawledPageRow }) {
  if (row.issueCount <= 0) return <span className="sentry-crawled-pages-muted">0</span>;
  return (
    <div className="sentry-crawled-pages-issues">
      {row.issueErrors > 0 && (
        <span className="sentry-crawled-pages-issues-error">{row.issueErrors}</span>
      )}
      {row.issueWarnings > 0 && (
        <span className="sentry-crawled-pages-issues-warning">{row.issueWarnings}</span>
      )}
      {row.issueErrors === 0 && row.issueWarnings === 0 && (
        <span>{row.issueCount}</span>
      )}
    </div>
  );
}

function AiBotsCell({ row }: { row: CrawledPageRow }) {
  if (row.blockedAiBots > 0) {
    return (
      <span className="sentry-crawled-pages-ai-blocked">
        {row.blockedAiBots}
        /
        {row.totalAiBots}
        {' '}
        blocked
      </span>
    );
  }
  return (
    <div className="sentry-crawled-pages-ai-good" title="All AI bots allowed">
      {PRIMARY_BOTS.slice(0, 3).map((bot) => (
        <BotIcon key={bot.id} botId={bot.id} size={14} />
      ))}
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <SentryTableHeaderCell align={align} className={`sentry-crawled-pages-th ${className}`}>
      <button type="button" className="sentry-crawled-pages-th-btn" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <SortIcon active={active} dir={dir} />
      </button>
    </SentryTableHeaderCell>
  );
}

export default function SiteAuditCrawledPages({ report }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<CrawledPageColumnKey>>(
    () => new Set(DEFAULT_CRAWLED_PAGE_VISIBLE),
  );

  const showCol = (key: CrawledPageColumnKey) => visibleColumns.has(key);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sorted = useMemo(
    () => [...report.pages].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [report.pages, sortKey, sortDir],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="sentry-crawled-pages">
      <SentryPanel className="sentry-crawled-pages-filters-panel perf-3d-card">
        <SentryPanelBody className="sentry-crawled-pages-filters">
          <CompactSelect
            size="sm"
            align="left"
            menuMinWidth={220}
            options={[]}
            onChange={() => {}}
            triggerLabel="Blocked AI search bots"
            disabled
          />
          <CompactSelect
            size="sm"
            align="left"
            menuMinWidth={180}
            options={[]}
            onChange={() => {}}
            triggerLabel="Advanced filters"
            disabled
          />
        </SentryPanelBody>
      </SentryPanel>

      <SentryPanel noPadding className="sentry-crawled-pages-table-panel perf-3d-card">
        <SentryPanelHeader
          title="Crawled Pages"
          actions={<CrawledPagesManageColumns visible={visibleColumns} onChange={setVisibleColumns} />}
        />

        {sorted.length === 0 ? (
          <SentryPanelBody>
            <SentryEmptyState title="No matching pages" description="Try adjusting your filters." />
          </SentryPanelBody>
        ) : (
          <>
            <SentryTable className="sentry-crawled-pages-table">
              <SentryTableHead>
                <SentryTableRow>
                  {showCol('ilr') && (
                    <SortableTh label="ILR" sortKey="score" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="sentry-crawled-pages-th--score" />
                  )}
                  {showCol('url') && (
                    <SortableTh label="Page URL" sortKey="url" activeKey={sortKey} dir={sortDir} onSort={onSort} className="sentry-crawled-pages-th--url" />
                  )}
                  {showCol('title') && (
                    <SortableTh label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  )}
                  {showCol('statusCode') && (
                    <SortableTh label="Status Code" sortKey="statusCode" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  )}
                  {showCol('issues') && (
                    <SortableTh label="Issues" sortKey="issues" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  )}
                  {showCol('aiSearch') && (
                    <SentryTableHeaderCell className="sentry-crawled-pages-th">AI Search</SentryTableHeaderCell>
                  )}
                  {showCol('depth') && (
                    <SortableTh label="Depth" sortKey="depth" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  )}
                  {showCol('reaudit') && (
                    <SentryTableHeaderCell align="right" className="sentry-crawled-pages-th">Reaudit</SentryTableHeaderCell>
                  )}
                </SentryTableRow>
              </SentryTableHead>
              <SentryTableBody>
                {pageRows.map((row) => {
                  const tone = statusTone(row.statusCode, row.statusLabel);
                  return (
                    <SentryTableRow key={row.id}>
                      {showCol('ilr') && (
                        <SentryTableCell align="right" className="sentry-crawled-pages-cell--score">
                          {row.score !== null ? (
                            <span style={{ color: scoreColor(row.score), fontWeight: 600 }}>{row.score}</span>
                          ) : (
                            <span className="sentry-crawled-pages-muted">—</span>
                          )}
                        </SentryTableCell>
                      )}
                      {showCol('url') && (
                        <SentryTableCell className="sentry-crawled-pages-cell--url">
                          <UrlCell url={row.url} classPrefix="sentry-crawled-pages" />
                        </SentryTableCell>
                      )}
                      {showCol('title') && (
                        <SentryTableCell className="sentry-crawled-pages-cell--title">
                          {row.title ? (
                            <span className="sentry-crawled-pages-title" title={row.title}>{row.title}</span>
                          ) : (
                            <span className="sentry-crawled-pages-muted">—</span>
                          )}
                        </SentryTableCell>
                      )}
                      {showCol('statusCode') && (
                        <SentryTableCell>
                          <span className={`sentry-crawled-pages-status sentry-crawled-pages-status--${tone}`}>
                            {row.statusLabel}
                          </span>
                        </SentryTableCell>
                      )}
                      {showCol('issues') && (
                        <SentryTableCell align="right">
                          <IssuesCell row={row} />
                        </SentryTableCell>
                      )}
                      {showCol('aiSearch') && (
                        <SentryTableCell>
                          <AiBotsCell row={row} />
                        </SentryTableCell>
                      )}
                      {showCol('depth') && (
                        <SentryTableCell align="right">{row.depth}</SentryTableCell>
                      )}
                      {showCol('reaudit') && (
                        <SentryTableCell align="right">
                          <Button type="button" variant="secondary" size="sm" disabled>
                            Reaudit
                          </Button>
                        </SentryTableCell>
                      )}
                    </SentryTableRow>
                  );
                })}
              </SentryTableBody>
            </SentryTable>

            <div className="sentry-crawled-pages-pagination">
              <Pagination
                page={safePage}
                pageCount={pageCount}
                onPageChange={setPage}
                caption={getPaginationCaption({
                  page: safePage,
                  pageSize: PAGE_SIZE,
                  total: sorted.length,
                })}
              />
            </div>
          </>
        )}
      </SentryPanel>
    </div>
  );
}
