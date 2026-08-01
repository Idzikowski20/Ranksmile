import React, { useCallback, useMemo, useState } from 'react';
import { Badge, Button, CompactSelect, SegmentedControl } from '../koala/core';
import { KoalaEmptyState, KoalaPanel, KoalaPanelBody } from '../koala/layout';
import InfoPopper, { dashedLinkStyle, PopperParagraph } from './InfoPopper';
import HowToFixPopper from './HowToFixPopper';
import {
  CATEGORY_LABELS,
  EXTRA_CATEGORIES,
  SEVERITY_GROUP_INFO,
  VISIBLE_CATEGORIES,
} from '../../lib/siteAudit/issueCatalog';
import type {
  IssueCategory,
  IssueSeverity,
  SiteAuditIssueSummary,
  SiteAuditIssuesReport,
} from '../../lib/siteAudit/types';

type SeverityFilter = 'all' | IssueSeverity;
type TriggeredFilter = 'with_issues' | 'with_new_issues';

type Props = {
  report: SiteAuditIssuesReport;
  onSelectIssue: (issueId: string) => void;
};

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  notice: 'Notices',
};

function EmptyTrend() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="20" fill="none" aria-hidden="true">
      <g clipPath="url(#emptyTrend)">
        <path stroke="#fff" strokeLinejoin="round" d="M0 9.4c9.2 0 9.2-8.2 18-8.2s9.3 8.2 18 8.2 8.7-8.2 18-8.2 9.3 8.2 18 8.2" />
        <path fill="#E0E1E9" fillOpacity="0.8" d="M0 9.4c9.2 0 9.2-8.2 18-8.2s9.3 8.2 18 8.2 8.7-8.2 18-8.2 9.3 8.2 18 8.2V20H0z" />
      </g>
      <defs>
        <clipPath id="emptyTrend">
          <path fill="#fff" d="M0 0h72v20H0z" />
        </clipPath>
      </defs>
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

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="m15.946 8.333.003-.008a1.008 1.008 0 0 0-.003-.652 8.4 8.4 0 0 0-15.89 0 .98.98 0 0 0-.054.273L0 7.961a.982.982 0 0 0 .055.372 8.45 8.45 0 0 0 7.95 5.67 8.45 8.45 0 0 0 7.94-5.67ZM4.28 10.807a6.4 6.4 0 0 1-2.21-2.804 6.4 6.4 0 0 1 11.863 0 6.4 6.4 0 0 1-9.653 2.804Zm2.609-1.141A2 2 0 1 0 9.11 6.34a2 2 0 0 0-2.22 3.326Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M7.82 6a1 1 0 0 1 .99 1.16L8 12h2a1 1 0 1 1 0 2H7.18a1 1 0 0 1-.99-1.16L7 8H6a1 1 0 0 1 0-2h1.82ZM8.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function CountBadge({ value }: { value: number }) {
  return <span className="koala-issues-count">{value}</span>;
}

function IssueRow({
  issue,
  onSelect,
  onHowToFix,
  howToFixOpen,
}: {
  issue: SiteAuditIssueSummary;
  onSelect: () => void;
  onHowToFix: (e: React.MouseEvent<HTMLButtonElement>) => void;
  howToFixOpen: boolean;
}) {
  const newLabel = issue.newCount === 1 ? '1 new issue' : `${issue.newCount} new issues`;

  return (
    <li className="koala-issues-row">
      <div className="koala-issues-row-main">
        {issue.isNew && <Badge variant="new">NEW</Badge>}
        <span className="koala-issues-row-title">
          <button type="button" onClick={onSelect} className="koala-issues-row-link">
            {issue.linkText}
          </button>
          {' '}
          {issue.titleSuffix}
        </span>
        <button
          type="button"
          aria-expanded={howToFixOpen}
          onClick={onHowToFix}
          className="koala-issues-how-to-fix"
          style={dashedLinkStyle}
        >
          How to fix
        </button>
        <button type="button" onClick={onSelect} className="koala-issues-new-count">
          {newLabel}
        </button>
      </div>
      <div className="koala-issues-row-trend">
        <EmptyTrend />
      </div>
      <div className="koala-issues-row-actions">
        <Button variant="secondary" size="sm" disabled icon={<ShareIcon />}>
          Send to...
        </Button>
        <Button variant="secondary" size="sm" disabled aria-label="Exclude check" icon={<EyeIcon />} />
      </div>
    </li>
  );
}

function SeverityGroup({
  severity,
  issues,
  onSelectIssue,
  fixPopper,
  onHowToFix,
}: {
  severity: IssueSeverity;
  issues: SiteAuditIssueSummary[];
  onSelectIssue: (id: string) => void;
  fixPopper: SiteAuditIssueSummary | null;
  onHowToFix: (issue: SiteAuditIssueSummary, e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoRect, setInfoRect] = useState<DOMRect | null>(null);

  if (!issues.length) return null;

  return (
    <section className={`koala-issues-severity koala-issues-severity--${severity}`}>
      <div className="koala-issues-severity-header">
        <div className="koala-issues-severity-title">
          <h2>{SEVERITY_LABELS[severity]}</h2>
          <span className="koala-issues-severity-count">({issues.length})</span>
          <button
            type="button"
            aria-expanded={infoOpen}
            onClick={(e) => {
              setInfoRect(e.currentTarget.getBoundingClientRect());
              setInfoOpen((v) => !v);
            }}
            className="koala-issues-info-btn"
          >
            <InfoIcon />
          </button>
        </div>
        <div className="koala-issues-row-trend">
          <EmptyTrend />
        </div>
        <div />
      </div>
      <ul className="koala-issues-list">
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            onSelect={() => onSelectIssue(issue.id)}
            onHowToFix={(e) => onHowToFix(issue, e)}
            howToFixOpen={fixPopper?.id === issue.id}
          />
        ))}
      </ul>
      {infoOpen && infoRect && (
        <InfoPopper anchorRect={infoRect} onClose={() => setInfoOpen(false)} width={280}>
          <PopperParagraph>{SEVERITY_GROUP_INFO[severity]}</PopperParagraph>
        </InfoPopper>
      )}
    </section>
  );
}

export default function SiteAuditIssues({ report, onSelectIssue }: Props) {
  const [category, setCategory] = useState<IssueCategory>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [triggered, setTriggered] = useState<TriggeredFilter | null>(null);
  const [fixPopper, setFixPopper] = useState<{ issue: SiteAuditIssueSummary; rect: DOMRect } | null>(null);

  const closeFixPopper = useCallback(() => setFixPopper(null), []);

  const onHowToFix = useCallback((issue: SiteAuditIssueSummary, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFixPopper((prev) => (prev?.issue.id === issue.id ? null : { issue, rect }));
  }, []);

  const newIssuesCount = useMemo(
    () => report.issues.filter((i) => i.newCount > 0).length,
    [report.issues],
  );

  const filtered = useMemo(() => {
    return report.issues.filter((issue) => {
      if (triggered === 'with_new_issues' && issue.newCount <= 0) return false;
      if (severity !== 'all' && issue.severity !== severity) return false;
      if (category !== 'all' && !issue.categories.includes(category)) return false;
      return true;
    });
  }, [report.issues, category, severity, triggered]);

  const grouped = useMemo(() => ({
    error: filtered.filter((i) => i.severity === 'error'),
    warning: filtered.filter((i) => i.severity === 'warning'),
    notice: filtered.filter((i) => i.severity === 'notice'),
  }), [filtered]);

  const extraCategoryActive = EXTRA_CATEGORIES.includes(category);

  const categoryOptions = useMemo(() => [
    {
      value: 'all' as IssueCategory,
      label: <>All <CountBadge value={report.categoryCounts.all} /></>,
    },
    ...VISIBLE_CATEGORIES.map((cat) => ({
      value: cat,
      label: (
        <>
          {CATEGORY_LABELS[cat]}
          {' '}
          <CountBadge value={report.categoryCounts[cat]} />
        </>
      ),
    })),
  ], [report.categoryCounts]);

  const overflowCategoryOptions = useMemo(
    () => EXTRA_CATEGORIES.map((cat) => ({
      value: cat,
      label: CATEGORY_LABELS[cat],
      trailingItems: <span className="koala-issues-menu-count">{report.categoryCounts[cat]}</span>,
    })),
    [report.categoryCounts],
  );

  const severityOptions = (['all', 'error', 'warning', 'notice'] as const).map((sev) => {
    const count = sev === 'all'
      ? report.severityCounts.all
      : sev === 'error'
        ? report.severityCounts.errors
        : sev === 'warning'
          ? report.severityCounts.warnings
          : report.severityCounts.notices;
    const label = sev === 'all' ? 'All' : SEVERITY_LABELS[sev];
    return {
      value: sev,
      label: <>{label} <CountBadge value={count} /></>,
    };
  });

  const triggeredOptions = useMemo(() => [
    {
      value: 'with_issues' as TriggeredFilter,
      label: 'With issues',
      trailingItems: <span className="koala-issues-menu-count">{report.issues.length}</span>,
    },
    {
      value: 'with_new_issues' as TriggeredFilter,
      label: 'With new issues',
      trailingItems: <span className="koala-issues-menu-count">{newIssuesCount}</span>,
    },
  ], [report.issues.length, newIssuesCount]);

  const activeTriggeredLabel = triggered === 'with_new_issues' ? 'With new issues' : 'With issues';

  return (
    <div className="koala-issues-page">
      <KoalaPanel className="koala-issues-filters-panel">
        <KoalaPanelBody className="koala-issues-filters">
          <div className="koala-issues-filter-row">
            <div className="koala-issues-category-group">
              <SegmentedControl
                value={category}
                size="sm"
                onChange={setCategory}
                name="issues-category"
                options={categoryOptions}
              />
              <CompactSelect
                value={extraCategoryActive ? category : undefined}
                size="sm"
                align="left"
                menuMinWidth={220}
                options={overflowCategoryOptions}
                onChange={(opt) => setCategory(opt.value)}
                triggerLabel="More"
              />
            </div>
            <SegmentedControl
              value={severity}
              size="sm"
              onChange={setSeverity}
              name="issues-severity"
              options={severityOptions}
            />
          </div>
          <div className="koala-issues-triggered-wrap">
            {triggered ? (
              <div className="koala-issues-active-filter koala-issues-active-filter--selected">
                <span className="koala-issues-active-filter-label">{activeTriggeredLabel}</span>
                <button
                  type="button"
                  className="koala-issues-active-filter-clear"
                  aria-label="Clear triggered filter"
                  onClick={() => setTriggered(null)}
                >
                  ×
                </button>
              </div>
            ) : (
              <CompactSelect
                size="sm"
                align="right"
                menuMinWidth={220}
                options={triggeredOptions}
                onChange={(opt) => setTriggered(opt.value)}
                triggerLabel="Triggered checks"
              />
            )}
          </div>
        </KoalaPanelBody>
      </KoalaPanel>

      <KoalaPanel noPadding className="koala-issues-list-panel">
        {filtered.length === 0 ? (
          <KoalaPanelBody>
            <KoalaEmptyState title="No matching issues" description="Try adjusting your filters." />
          </KoalaPanelBody>
        ) : (
          <>
            <SeverityGroup
              severity="error"
              issues={grouped.error}
              onSelectIssue={onSelectIssue}
              fixPopper={fixPopper?.issue ?? null}
              onHowToFix={onHowToFix}
            />
            <SeverityGroup
              severity="warning"
              issues={grouped.warning}
              onSelectIssue={onSelectIssue}
              fixPopper={fixPopper?.issue ?? null}
              onHowToFix={onHowToFix}
            />
            <SeverityGroup
              severity="notice"
              issues={grouped.notice}
              onSelectIssue={onSelectIssue}
              fixPopper={fixPopper?.issue ?? null}
              onHowToFix={onHowToFix}
            />
          </>
        )}
      </KoalaPanel>

      {fixPopper && (
        <HowToFixPopper
          issue={fixPopper.issue}
          anchorRect={fixPopper.rect}
          onClose={closeFixPopper}
        />
      )}
    </div>
  );
}
