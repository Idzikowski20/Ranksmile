import React, { useMemo } from 'react';
import { Checkbox, CompactSelect, DropdownButton } from '../koala/core';

export type CrawledPageColumnKey =
  | 'ilr'
  | 'url'
  | 'title'
  | 'statusCode'
  | 'issues'
  | 'blockedAiBots'
  | 'depth'
  | 'pageviews'
  | 'description'
  | 'loadTime'
  | 'markup'
  | 'structuredData'
  | 'canonicalization'
  | 'sitemap'
  | 'incomingIntLinks'
  | 'outgoingIntLinks'
  | 'aiSearch'
  | 'reaudit';

export type CrawledPageColumnDef = {
  key: CrawledPageColumnKey;
  label: string;
  required?: boolean;
  /** Shown in menu but not yet backed by crawl data */
  comingSoon?: boolean;
};

export const CRAWLED_PAGE_COLUMNS: CrawledPageColumnDef[] = [
  { key: 'ilr', label: 'ILR', required: true },
  { key: 'url', label: 'Page URL', required: true },
  { key: 'title', label: 'Title' },
  { key: 'statusCode', label: 'Status Code' },
  { key: 'issues', label: 'Issues' },
  { key: 'blockedAiBots', label: 'Blocked AI Search Bots', comingSoon: true },
  { key: 'depth', label: 'Crawl Depth' },
  { key: 'pageviews', label: 'Pageviews', comingSoon: true },
  { key: 'description', label: 'Description', comingSoon: true },
  { key: 'loadTime', label: 'Load Time', comingSoon: true },
  { key: 'markup', label: 'Markup', comingSoon: true },
  { key: 'structuredData', label: 'Structured data', comingSoon: true },
  { key: 'canonicalization', label: 'Canonicalization', comingSoon: true },
  { key: 'sitemap', label: 'Sitemap', comingSoon: true },
  { key: 'incomingIntLinks', label: 'Incoming Int. Links', comingSoon: true },
  { key: 'outgoingIntLinks', label: 'Outgoing Int. Links', comingSoon: true },
  { key: 'aiSearch', label: 'AI Search' },
  { key: 'reaudit', label: 'Reaudit' },
];

export const DEFAULT_CRAWLED_PAGE_VISIBLE: CrawledPageColumnKey[] = [
  'ilr',
  'url',
  'title',
  'statusCode',
  'issues',
  'aiSearch',
  'depth',
  'reaudit',
];

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M6.667 0a1 1 0 0 0-.962.726l-.4 1.402-.112.062-1.383-.575a1 1 0 0 0-1.175.311L.961 4.09a1 1 0 0 0-.017 1.2l.889 1.218-.059.342-1.235.641a1 1 0 0 0-.52 1.084l.515 2.563a1 1 0 0 0 .889.8l1.47.135.139.2-.17 1.474a1 1 0 0 0 .55 1.012l2.297 1.136a1 1 0 0 0 1.18-.22l.928-1.013h.365l.927 1.012a1 1 0 0 0 1.18.221l2.298-1.136a1 1 0 0 0 .55-1.012l-.17-1.473.14-.2 1.47-.137a1 1 0 0 0 .889-.799l.514-2.563a1 1 0 0 0-.52-1.085l-1.236-.64-.058-.34.888-1.218a1 1 0 0 0-.017-1.202l-1.675-2.165a1 1 0 0 0-1.175-.311l-1.383.575-.113-.062-.4-1.402A1 1 0 0 0 9.33 0H6.667Zm.447 3.08L7.422 2h1.153l.308 1.08a1 1 0 0 0 .483.604l.902.491a1 1 0 0 0 .862.045l1.118-.465.748.966-.695.953a1 1 0 0 0-.178.758l.214 1.248a1 1 0 0 0 .526.719l1.008.522-.22 1.095-1.19.11a1 1 0 0 0-.728.423l-.623.892a1 1 0 0 0-.174.688l.133 1.15-.993.492-.716-.784a1 1 0 0 0-.738-.324H7.377a1 1 0 0 0-.738.325l-.717.783-.993-.492.133-1.15a1 1 0 0 0-.173-.687l-.622-.893a1 1 0 0 0-.728-.423l-1.19-.11-.22-1.096 1.008-.523a1 1 0 0 0 .524-.718l.215-1.248a1 1 0 0 0-.178-.76l-.695-.952.746-.964 1.118.465a1 1 0 0 0 .862-.045l.901-.49a1 1 0 0 0 .484-.605Z" />
    </svg>
  );
}

type Props = {
  visible: Set<CrawledPageColumnKey>;
  onChange: (next: Set<CrawledPageColumnKey>) => void;
};

export default function CrawledPagesManageColumns({ visible, onChange }: Props) {
  const visibleCount = useMemo(
    () => CRAWLED_PAGE_COLUMNS.filter((col) => visible.has(col.key)).length,
    [visible],
  );

  const resetToDefault = () => {
    onChange(new Set(DEFAULT_CRAWLED_PAGE_VISIBLE));
  };

  const selectAll = () => {
    onChange(new Set(CRAWLED_PAGE_COLUMNS.filter((col) => !col.comingSoon).map((col) => col.key)));
  };

  const toggleColumn = (key: CrawledPageColumnKey, checked: boolean) => {
    const col = CRAWLED_PAGE_COLUMNS.find((c) => c.key === key);
    if (!col || col.required || col.comingSoon) return;
    const next = new Set(visible);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  return (
    <CompactSelect
      options={[]}
      hideOptions
      align="right"
      menuMinWidth={300}
      menuWidth={320}
      menuClassName="koala-manage-columns-menu"
      trigger={(props, isOpen) => (
        <DropdownButton
          {...props}
          isOpen={isOpen}
          size="sm"
          showChevron={false}
          prefix={<SettingsIcon />}
          style={{ width: 'auto' }}
        >
          Manage columns
          <span className="koala-crawled-pages-col-count">
            {visibleCount}
            /
            {CRAWLED_PAGE_COLUMNS.length}
          </span>
        </DropdownButton>
      )}
      menuBody={() => (
        <div className="koala-manage-columns">
          <div className="koala-compact-select-menu-header koala-manage-columns-header">
            <span className="koala-compact-select-menu-title">Columns</span>
            <div className="koala-manage-columns-actions">
              <button type="button" className="koala-compact-select-clear" onClick={resetToDefault}>
                Reset to default
              </button>
              <button type="button" className="koala-compact-select-clear" onClick={selectAll}>
                Select all
              </button>
            </div>
          </div>
          <div
            className="koala-compact-select-list styled-scrollbar koala-manage-columns-list"
            role="menu"
          >
            {CRAWLED_PAGE_COLUMNS.map((col) => {
              const isVisible = visible.has(col.key);
              const locked = !!col.required;
              const disabled = locked || !!col.comingSoon;
              return (
                <div
                  key={col.key}
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  aria-disabled={disabled || undefined}
                  className={`koala-manage-columns-item${disabled ? ' koala-manage-columns-item--disabled' : ''}`}
                  onClick={() => !disabled && toggleColumn(col.key, !isVisible)}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleColumn(col.key, !isVisible);
                    }
                  }}
                  tabIndex={disabled ? -1 : 0}
                >
                  <Checkbox
                    size="sm"
                    checked={isVisible}
                    disabled={disabled}
                    readOnly
                  />
                  <span className="koala-manage-columns-label">{col.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    />
  );
}
