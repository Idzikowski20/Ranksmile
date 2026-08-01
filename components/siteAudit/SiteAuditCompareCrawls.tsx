import React, { useCallback, useMemo, useState } from 'react';
import { CompactSelect } from '../koala/core';
import { KoalaEmptyState, KoalaPanel, KoalaPanelBody } from '../koala/layout';
import InfoPopper, { dashedLinkStyle } from './InfoPopper';
import HowToFixPopper from './HowToFixPopper';
import { getCatalogEntry } from '../../lib/siteAudit/issueCatalog';
import { SEVERITY_GROUP_INFO } from '../../lib/siteAudit/issueCatalog';
import type {
  CompareCrawlsReport,
  CompareCrawlsRow,
  SiteAuditIssueSummary,
} from '../../lib/siteAudit/types';

type Props = {
  report: CompareCrawlsReport;
  onOlderChange: (id: string) => void;
  onNewerChange: (id: string) => void;
  onOpenOverview?: () => void;
  onOpenIssues?: (severity?: 'error' | 'warning' | 'notice') => void;
  onOpenCrawledPages?: () => void;
  onOpenIssue?: (issueId: string) => void;
};

const FONT = 'var(--font-family-primary)';

const GENERAL_INFO: Record<string, string> = {
  pages_crawled: 'Total number of pages crawled during the audit.',
  overall_score: 'Overall Site Health score based on errors and warnings found during the crawl.',
  total_issues: 'Sum of all issue instances across errors, warnings, and notices.',
  total_errors: 'Total error-level issue instances found during the crawl.',
  total_warnings: 'Total warning-level issue instances found during the crawl.',
  total_notices: 'Total notice-level issue instances found during the crawl.',
};

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M7.82 6a1 1 0 0 1 .99 1.16L8 12h2a1 1 0 1 1 0 2H7.18a1 1 0 0 1-.99-1.16L7 8H6a1 1 0 0 1 0-2h1.82ZM8.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M3.293 6.293a1 1 0 0 1 1.414 0L8 9.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M0 1a1 1 0 1 1 2 0v13h13a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1V1Z" />
      <path d="M14.8 4.6a1 1 0 1 0-1.6-1.2L9 9 7.8 7.4a1 1 0 0 0-1.6 0l-3 4a1 1 0 0 0 1.6 1.2L7 9.667l1.2 1.6a1 1 0 0 0 1.6 0l5-6.667Z" />
    </svg>
  );
}

function formatCellValue(value: number | undefined): string {
  if (value === undefined) return '—';
  return String(value);
}

function formatDiffValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value);
}

function issueSummaryFromRow(row: CompareCrawlsRow): SiteAuditIssueSummary | null {
  if (!row.issueId) return null;
  const catalog = getCatalogEntry(row.issueId);
  const count = row.newerValue ?? 0;
  if (!catalog) {
    return {
      id: row.issueId,
      title: row.label,
      linkText: String(count),
      titleSuffix: row.label,
      severity: row.severity ?? 'notice',
      count,
      newCount: 0,
      categories: [],
    };
  }
  return {
    id: row.issueId,
    title: `${catalog.countLabel(count)} ${catalog.suffix}`,
    linkText: catalog.countLabel(count),
    titleSuffix: catalog.suffix,
    severity: catalog.severity,
    count,
    newCount: 0,
    categories: catalog.categories,
    aiSearch: catalog.aiSearch,
    isNew: catalog.isNew,
  };
}

function CrawlSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <CompactSelect
      value={value}
      options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
      onChange={(opt) => onChange(String(opt.value))}
      size="sm"
      menuMinWidth={220}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          className="koala-compare-crawls-select-trigger"
          aria-label={ariaLabel}
        >
          <span className="koala-compare-crawls-select-text">
            {options.find((o) => o.value === value)?.label ?? 'Select crawl'}
          </span>
          <span className="koala-compare-crawls-select-addon" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      )}
    />
  );
}

export default function SiteAuditCompareCrawls({
  report,
  onOlderChange,
  onNewerChange,
  onOpenOverview,
  onOpenIssues,
  onOpenCrawledPages,
  onOpenIssue,
}: Props) {
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [infoRect, setInfoRect] = useState<DOMRect | null>(null);
  const [howToFixIssue, setHowToFixIssue] = useState<SiteAuditIssueSummary | null>(null);
  const [howToFixRect, setHowToFixRect] = useState<DOMRect | null>(null);

  const crawlOptions = useMemo(
    () => report.crawls.map((c) => ({ value: c.id, label: c.label })),
    [report.crawls],
  );

  const olderId = report.olderCrawlId ?? crawlOptions[0]?.value ?? '';
  const newerId = report.newerCrawlId ?? crawlOptions[0]?.value ?? '';

  const openInfo = useCallback((key: string, el: HTMLElement) => {
    setInfoKey(key);
    setInfoRect(el.getBoundingClientRect());
  }, []);

  const closeInfo = useCallback(() => {
    setInfoKey(null);
    setInfoRect(null);
  }, []);

  const openHowToFix = useCallback((issue: SiteAuditIssueSummary, el: HTMLElement) => {
    setHowToFixIssue(issue);
    setHowToFixRect(el.getBoundingClientRect());
  }, []);

  const closeHowToFix = useCallback(() => {
    setHowToFixIssue(null);
    setHowToFixRect(null);
  }, []);

  if (!report.hasData || !report.crawls.length) {
    return (
      <KoalaPanel>
        <KoalaPanelBody>
          <KoalaEmptyState
            title="No crawl history yet"
            description="Run at least one site audit crawl to compare results over time."
          />
        </KoalaPanelBody>
      </KoalaPanel>
    );
  }

  const infoText = infoKey
    ? (GENERAL_INFO[infoKey]
      ?? (infoKey === 'errors_issues' ? SEVERITY_GROUP_INFO.error
        : infoKey === 'warnings_issues' ? SEVERITY_GROUP_INFO.warning
          : infoKey === 'notices_issues' ? SEVERITY_GROUP_INFO.notice
            : infoKey === 'general' ? 'Compare key site audit metrics between two crawl dates.'
              : null))
    : null;

  const handleGeneralLink = (rowId: string) => {
    if (rowId === 'pages_crawled') onOpenCrawledPages?.();
    else if (rowId === 'overall_score') onOpenOverview?.();
    else if (rowId === 'total_issues') onOpenIssues?.();
    else if (rowId === 'total_errors') onOpenIssues?.('error');
    else if (rowId === 'total_warnings') onOpenIssues?.('warning');
    else if (rowId === 'total_notices') onOpenIssues?.('notice');
  };

  return (
    <section className="koala-compare-crawls" aria-label="Compare crawls">
      <div className="koala-compare-crawls-card">
        <div className="koala-compare-crawls-table-wrap">
          <table className="koala-compare-crawls-table">
            <tbody>
              <tr className="koala-compare-crawls-header-row">
                <td className="koala-compare-crawls-cell koala-compare-crawls-cell--label">
                  <h2 className="koala-compare-crawls-section-title">General</h2>
                  <button
                    type="button"
                    className="koala-compare-crawls-info-btn"
                    aria-label="About general metrics"
                    onClick={(e) => openInfo('general', e.currentTarget)}
                  >
                    <InfoIcon />
                  </button>
                </td>
                <td className="koala-compare-crawls-cell koala-compare-crawls-cell--crawl">
                  <div className="koala-compare-crawls-crawl-picker">
                    <CrawlSelect
                      value={olderId}
                      options={crawlOptions}
                      onChange={onOlderChange}
                      ariaLabel="Select the earlier crawl date to compare"
                    />
                    <span className="koala-compare-crawls-vs">vs</span>
                  </div>
                </td>
                <td className="koala-compare-crawls-cell koala-compare-crawls-cell--crawl">
                  <CrawlSelect
                    value={newerId}
                    options={crawlOptions}
                    onChange={onNewerChange}
                    ariaLabel="Select the later crawl date to compare"
                  />
                </td>
                <td className="koala-compare-crawls-cell koala-compare-crawls-cell--diff">
                  <span className="koala-compare-crawls-diff-title">Fixed</span>
                </td>
                <td className="koala-compare-crawls-cell koala-compare-crawls-cell--diff">
                  <span className="koala-compare-crawls-diff-title">New</span>
                </td>
              </tr>

              {report.rows.filter((row) => row.id !== 'general_header').map((row) => {
                if (row.kind === 'section') {
                  const sectionInfoKey = row.id;
                  return (
                    <tr key={row.id} className="koala-compare-crawls-section-row">
                      <td className="koala-compare-crawls-cell koala-compare-crawls-cell--label" colSpan={1}>
                        <h2 className="koala-compare-crawls-section-title">{row.label}</h2>
                        {row.severity && (
                          <button
                            type="button"
                            className="koala-compare-crawls-info-btn"
                            aria-label={`About ${row.label}`}
                            onClick={(e) => openInfo(sectionInfoKey, e.currentTarget)}
                          >
                            <InfoIcon />
                          </button>
                        )}
                      </td>
                      <td className="koala-compare-crawls-cell" colSpan={4} />
                    </tr>
                  );
                }

                const issueSummary = row.kind === 'issue' ? issueSummaryFromRow(row) : null;

                return (
                  <tr key={row.id} className="koala-compare-crawls-data-row">
                    <td className="koala-compare-crawls-cell koala-compare-crawls-cell--label">
                      <div className="koala-compare-crawls-label-wrap">
                        {row.kind === 'issue' ? (
                          <button
                            type="button"
                            className="koala-compare-crawls-link"
                            onClick={() => onOpenIssue?.(row.issueId ?? row.id)}
                          >
                            {row.label}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="koala-compare-crawls-link"
                            onClick={() => handleGeneralLink(row.id)}
                          >
                            {row.label}
                          </button>
                        )}
                        {row.kind === 'general' && GENERAL_INFO[row.id] && (
                          <button
                            type="button"
                            className="koala-compare-crawls-info-btn"
                            aria-label={`About ${row.label}`}
                            onClick={(e) => openInfo(row.id, e.currentTarget)}
                          >
                            <InfoIcon />
                          </button>
                        )}
                        {issueSummary && getCatalogEntry(issueSummary.id) && (
                          <button
                            type="button"
                            style={dashedLinkStyle}
                            onClick={(e) => openHowToFix(issueSummary, e.currentTarget)}
                          >
                            Learn more
                          </button>
                        )}
                        <button
                          type="button"
                          className="koala-compare-crawls-progress-btn"
                          aria-label="Open the Progress report"
                          title="Go to Progress"
                          disabled
                        >
                          <ProgressIcon />
                        </button>
                      </div>
                    </td>
                    <td className="koala-compare-crawls-cell koala-compare-crawls-cell--value">
                      <span className="koala-compare-crawls-value">{formatCellValue(row.olderValue)}</span>
                    </td>
                    <td className="koala-compare-crawls-cell koala-compare-crawls-cell--value">
                      <span className="koala-compare-crawls-value">{formatCellValue(row.newerValue)}</span>
                    </td>
                    <td className="koala-compare-crawls-cell koala-compare-crawls-cell--value">
                      <span className="koala-compare-crawls-diff">{formatDiffValue(row.fixed)}</span>
                    </td>
                    <td className="koala-compare-crawls-cell koala-compare-crawls-cell--value">
                      <span className="koala-compare-crawls-diff">{formatDiffValue(row.newCount)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {infoText && (
        <InfoPopper anchorRect={infoRect} onClose={closeInfo}>
          <p style={{ margin: 0, fontFamily: FONT, fontSize: 13, color: '#18181B', lineHeight: 1.5 }}>
            {infoText}
          </p>
        </InfoPopper>
      )}

      {howToFixIssue && (
        <HowToFixPopper issue={howToFixIssue} anchorRect={howToFixRect} onClose={closeHowToFix} />
      )}
    </section>
  );
}
