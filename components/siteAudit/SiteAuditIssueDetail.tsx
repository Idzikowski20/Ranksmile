import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Pagination,
  SearchBar,
  SegmentedControl,
  getPaginationCaption,
} from '../koala/core';
import {
  KoalaDetailLayout,
  KoalaEmptyState,
  KoalaPanel,
  KoalaPanelBody,
  KoalaPanelHeader,
} from '../koala/layout';
import {
  SentryTable,
  SentryTableBody,
  SentryTableCell,
  SentryTableHead,
  SentryTableHeaderCell,
  SentryTableRow,
} from '../koala/layout';
import type { IssueDetailLayout, IssueInstance, SiteAuditIssueDetailPayload } from '../../lib/siteAudit/types';
import { UrlCell } from './AuditUrlCell';
import IssueHelpContent from './IssueHelpContent';

type Props = {
  data: SiteAuditIssueDetailPayload;
  onBack: () => void;
};

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'info'> = {
  error: 'danger',
  warning: 'warning',
  notice: 'info',
};

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M6.707 12.707a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 1.414L4.414 7H14a1 1 0 1 1 0 2H4.414l2.293 2.293a1 1 0 0 1 0 1.414Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11.707 1.293a1 1 0 1 0-1.414 1.414L12.586 5H7a6 6 0 0 0-6 6v3a1 1 0 1 0 2 0v-3a4 4 0 0 1 4-4h5.586l-2.293 2.293a1 1 0 1 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414l-4-4Z" />
    </svg>
  );
}

function SitemapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M14 9H9V7h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v2H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3h2v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1ZM5 5V3h6v2H5Zm0 8H3v-2h2v2Zm8 0h-2v-2h2v2Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="m15.946 8.333.003-.008a1.008 1.008 0 0 0-.003-.652 8.4 8.4 0 0 0-15.89 0 .98.98 0 0 0-.054.273L0 7.961a.982.982 0 0 0 .055.372 8.45 8.45 0 0 0 7.95 5.67 8.45 8.45 0 0 0 7.94-5.67ZM4.28 10.807a6.4 6.4 0 0 1-2.21-2.804 6.4 6.4 0 0 1 11.863 0 6.4 6.4 0 0 1-9.653 2.804Zm2.609-1.141A2 2 0 1 0 9.11 6.34a2 2 0 0 0-2.22 3.326Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M2.853 2.146a.5.5 0 0 0-.708.708l2.06 2.06C2.74 5.88 1.47 7.2.054 8.333a1.008 1.008 0 0 0 0 .652 8.4 8.4 0 0 0 15.89 0 .98.98 0 0 0 .054-.273l.003-.008a.982.982 0 0 0-.055-.372 8.45 8.45 0 0 0-2.21-2.804 6.4 6.4 0 0 0-1.141 1.141l-1.06-1.06a.5.5 0 0 0-.708 0l-1.06 1.06a6.4 6.4 0 0 0-2.21 2.804 6.4 6.4 0 0 0 9.653-2.804 6.4 6.4 0 0 0-2.22-3.326 2 2 0 1 0-2.83 2.83 2 2 0 0 0 2.22 3.326 6.4 6.4 0 0 0-9.653 2.804ZM8 5.34a2 2 0 0 0-1.11 3.326 2 2 0 0 0 3.326-1.11A2 2 0 0 0 8 5.34Z" />
      <path d="m1.146 1.146 14.708 14.708" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IssueVisibilityButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="koala-issue-hide-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function formatDiscovered(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PageUrlCell({ row }: { row: IssueInstance }) {
  return (
    <div className="koala-issue-page-url">
      {row.title && <div className="koala-issue-page-title">{row.title}</div>}
      <UrlCell url={row.url} />
    </div>
  );
}

type ColDef = { key: string; label: string; render: (row: IssueInstance) => React.ReactNode };

function columnsForLayout(layout: IssueDetailLayout): ColDef[] {
  const discovered: ColDef = {
    key: 'discovered',
    label: 'Discovered',
    render: (row) => (
      <div className="koala-issue-discovered">
        <span>{formatDiscovered(row.discoveredAt)}</span>
        {row.isNew && <Badge variant="new">New</Badge>}
      </div>
    ),
  };

  if (layout === 'sitemap') {
    return [
      { key: 'sitemap', label: 'Sitemap URL', render: (row) => <UrlCell url={row.sitemapUrl ?? '—'} /> },
      { key: 'link', label: 'Link URL', render: (row) => <UrlCell url={row.url} /> },
      { key: 'type', label: 'Issue Type', render: (row) => row.issueType ?? '—' },
      discovered,
    ];
  }
  if (layout === 'malformedUrl') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      {
        key: 'malformed',
        label: 'Malformed URL',
        render: (row) => <code className="koala-issue-mono">{row.secondaryUrl ?? '—'}</code>,
      },
      discovered,
    ];
  }
  if (layout === 'textRatio') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      { key: 'ratio', label: 'Ratio', render: (row) => (row.ratio != null ? row.ratio.toFixed(2) : '—') },
      discovered,
    ];
  }
  if (layout === 'permanentRedirect') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <UrlCell url={row.url} /> },
      { key: 'target', label: 'Redirect URL', render: (row) => <UrlCell url={row.secondaryUrl ?? '—'} /> },
      discovered,
    ];
  }
  if (layout === 'linkIssue') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      { key: 'link', label: 'Link URL', render: (row) => <UrlCell url={row.secondaryUrl ?? '—'} /> },
      { key: 'anchor', label: 'Anchor', render: (row) => row.anchor || '—' },
      discovered,
    ];
  }
  if (layout === 'incomingLinks') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      { key: 'incoming', label: 'Incoming links', render: (row) => String(row.incomingCount ?? 1) },
      discovered,
    ];
  }
  if (layout === 'hsts') {
    return [
      { key: 'subdomain', label: 'Subdomain', render: (row) => row.subdomain ?? row.url },
      discovered,
    ];
  }
  if (layout === 'external403') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      { key: 'external', label: 'External URL', render: (row) => <UrlCell url={row.secondaryUrl ?? '—'} /> },
      discovered,
    ];
  }
  if (layout === 'titleLength') {
    return [
      { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
      { key: 'len', label: 'Title length', render: (row) => String(row.titleLength ?? '—') },
      discovered,
    ];
  }
  return [
    { key: 'page', label: 'Page URL', render: (row) => <PageUrlCell row={row} /> },
    discovered,
  ];
}

function IssueDetailAside({ issueId }: { issueId: string }) {
  return <IssueHelpContent issueId={issueId} />;
}

function StatsBar({ failed, successful }: { failed: number; successful: number }) {
  const total = failed + successful;
  const failPct = total ? (failed / total) * 100 : 0;
  return (
    <div className="koala-issue-stats">
      <span>
        Failed:
        {' '}
        <strong className="koala-issue-stats-failed">{failed}</strong>
      </span>
      <span>
        Successful:
        {' '}
        <strong className="koala-issue-stats-ok">{successful}</strong>
      </span>
      <div className="koala-issue-stats-bar" aria-hidden="true">
        <div className="koala-issue-stats-bar-fail" style={{ width: `${failPct}%` }} />
        <div className="koala-issue-stats-bar-ok" />
      </div>
    </div>
  );
}

function SelectionBar({
  count,
  mode,
  onDeselectAll,
  onAction,
}: {
  count: number;
  mode: 'hide' | 'unhide';
  onDeselectAll: () => void;
  onAction: () => void;
}) {
  const label = count === 1 ? 'row selected' : 'rows selected';
  const actionLabel = mode === 'hide' ? 'Hide' : 'Unhide';
  const actionIcon = mode === 'hide' ? <EyeOffIcon /> : <EyeIcon />;
  return (
    <div className="koala-issue-selection-bar" role="region" aria-label="Selected rows actions">
      <span className="koala-issue-selection-count" data-test-id="selected-rows-text">
        <strong>{count}</strong>
        {' '}
        {label}
      </span>
      <div className="koala-issue-selection-actions">
        <Button variant="link" size="sm" onClick={onDeselectAll} data-test-id="button-deselect-all">
          Deselect all
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={onAction}
          icon={actionIcon}
          data-test-id={mode === 'hide' ? 'button-toggle-selected' : 'button-unhide-selected'}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export default function SiteAuditIssueDetail({ data, onBack }: Props) {
  const { issue, failed, successful, instances, layout } = data;
  const cols = useMemo(() => columnsForLayout(layout), [layout]);
  const [tab, setTab] = useState<'issues' | 'hidden'>('issues');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const visibleInstances = useMemo(
    () => instances.filter((r) => !hidden.has(r.id)),
    [instances, hidden],
  );
  const hiddenInstances = useMemo(
    () => instances.filter((r) => hidden.has(r.id)),
    [instances, hidden],
  );
  const tabInstances = tab === 'issues' ? visibleInstances : hiddenInstances;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabInstances;
    return tabInstances.filter((r) => {
      const hay = [r.url, r.title, r.secondaryUrl, r.sitemapUrl, r.subdomain, r.anchor]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tabInstances, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedCount = selected.size;
  const pageSelectedCount = pageRows.filter((r) => selected.has(r.id)).length;
  const allPageSelected = pageRows.length > 0 && pageSelectedCount === pageRows.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const headerChecked: boolean | 'indeterminate' = allPageSelected
    ? true
    : somePageSelected
      ? 'indeterminate'
      : false;

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRows.forEach((r) => next.delete(r.id));
      } else {
        pageRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const deselectAll = () => setSelected(new Set());

  const hideRows = (ids: Iterable<string>) => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setPage(1);
  };

  const unhideRows = (ids: Iterable<string>) => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    setPage(1);
  };

  const hideSelected = () => hideRows(selected);
  const hideRow = (id: string) => hideRows([id]);
  const unhideSelected = () => unhideRows(selected);
  const unhideRow = (id: string) => unhideRows([id]);

  const severityVariant = SEVERITY_BADGE[issue.severity] ?? 'info';

  const headerActions = (
    <>
      <Button variant="secondary" size="sm" disabled icon={<ShareIcon />}>
        Send to...
      </Button>
      <Button variant="secondary" size="sm" disabled icon={<SitemapIcon />}>
        Site Structure
      </Button>
      <Button variant="secondary" size="sm" disabled icon={<EyeIcon />}>
        Exclude check
      </Button>
    </>
  );

  const filterTabs = (
    <div className="koala-issue-toolbar">
      <SegmentedControl
        value={tab}
        size="sm"
        onChange={(v) => { setTab(v); setPage(1); deselectAll(); }}
        name="issue-detail-tab"
        options={[
          { value: 'issues', label: <>Issues <span className="koala-issue-tab-count">{visibleInstances.length}</span></> },
          { value: 'hidden', label: <>Hidden <span className="koala-issue-tab-count">{hiddenInstances.length}</span></> },
        ]}
      />
      <SearchBar
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search"
        width="100%"
      />
      <Button variant="secondary" size="sm" disabled>
        Advanced filters
      </Button>
    </div>
  );

  const tableContent = (
    <>
      {selectedCount > 0 && (
        <SelectionBar
          count={selectedCount}
          mode={tab === 'issues' ? 'hide' : 'unhide'}
          onDeselectAll={deselectAll}
          onAction={tab === 'issues' ? hideSelected : unhideSelected}
        />
      )}
      <SentryTable>
        <SentryTableHead>
          <SentryTableRow>
            <SentryTableHeaderCell style={{ width: 44 }}>
              <Checkbox checked={headerChecked} onChange={togglePageSelection} />
            </SentryTableHeaderCell>
            {cols.map((col) => (
              <SentryTableHeaderCell key={col.key}>{col.label}</SentryTableHeaderCell>
            ))}
            <SentryTableHeaderCell style={{ width: 48 }}>{' '}</SentryTableHeaderCell>
          </SentryTableRow>
        </SentryTableHead>
        <SentryTableBody>
          {pageRows.length === 0 ? (
            <SentryTableRow>
              <SentryTableCell colSpan={cols.length + 2}>
                <KoalaEmptyState
                  title={tab === 'issues' ? 'No matching URLs' : 'No hidden issues'}
                  description={tab === 'issues' ? 'Try adjusting your search query.' : 'Issues you hide will appear here.'}
                />
              </SentryTableCell>
            </SentryTableRow>
          ) : (
            pageRows.map((row) => (
              <SentryTableRow key={row.id}>
                <SentryTableCell>
                  <Checkbox checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                </SentryTableCell>
                {cols.map((col) => (
                  <SentryTableCell key={col.key}>{col.render(row)}</SentryTableCell>
                ))}
                <SentryTableCell align="right">
                  {tab === 'issues' ? (
                    <IssueVisibilityButton label={`Hide ${row.url}`} onClick={() => hideRow(row.id)}>
                      <EyeOffIcon />
                    </IssueVisibilityButton>
                  ) : (
                    <IssueVisibilityButton label={`Unhide ${row.url}`} onClick={() => unhideRow(row.id)}>
                      <EyeIcon />
                    </IssueVisibilityButton>
                  )}
                </SentryTableCell>
              </SentryTableRow>
            ))
          )}
        </SentryTableBody>
      </SentryTable>
      <div className="koala-issue-pagination">
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          caption={getPaginationCaption({ page: safePage, pageSize, total: filtered.length })}
        />
        <label className="koala-issue-page-size">
          Rows
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="koala-issue-page-size-select"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );

  return (
    <div className="koala-issue-detail">
      <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeftIcon />} className="koala-issue-back">
        All issues
      </Button>

      <KoalaDetailLayout
        main={(
          <div className="koala-issue-main-stack">
            <KoalaPanel>
              <KoalaPanelHeader
                title={(
                  <span className="koala-issue-title-row">
                    <span className="koala-issue-title">{issue.title}</span>
                    <Badge variant={severityVariant}>
                      {issue.severity === 'error' ? 'Error' : issue.severity === 'warning' ? 'Warning' : 'Notice'}
                    </Badge>
                  </span>
                )}
                actions={headerActions}
              />
              <KoalaPanelBody className="koala-issue-header-body">
                <StatsBar failed={failed} successful={successful} />
              </KoalaPanelBody>
            </KoalaPanel>

            <KoalaPanel noPadding className="koala-issue-table-panel">
              <div className="koala-issue-toolbar-wrap">{filterTabs}</div>
              {tableContent}
            </KoalaPanel>
          </div>
        )}
        aside={<IssueDetailAside issueId={issue.id} />}
      />
    </div>
  );
}
