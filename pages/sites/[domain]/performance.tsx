/* eslint-disable max-len, no-nested-ternary */
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { PageHeader } from '../../../components/koala/layout';
import { Button, CompactSelect, PageFilterBar, Modal, ModalFooter, DataTable, DataTableScroll, DataTableContent, DataTableHeader, DataTableBody, DataTableRow, DataTableEmpty, Tabs, ToolRibbon, Pagination, getPaginationCaption } from '../../../components/koala/core';
import { Card, FeedbackPopover } from '../../../components/koala/product';
import { TrendDeltaBadge } from '../../../components/koala/product/helpers/TrendDeltaBadge';
import { Icon } from '../../../components/koala/icons/Icon';
import PerformanceLineChart from '../../../components/performance/PerformanceLineChart';
import { useFetchDomains } from '../../../services/domains';
import countries from '../../../utils/countries';
import {
  DATE_PRESETS,
  DEVICE_OPTIONS,
  PAGE_OPTIONS,
  type AuditResponseData,
  type DatePreset,
  type DateRangeValue,
  type Delta,
  type DeviceFilter,
  type KeywordMode,
  type KeywordOperator,
  type KeywordRule,
  type MetricKey,
  type PageFilter,
  type SortMetric,
  type SortOrder,
  type TableRow,
} from '../../../lib/performance/types';
import {
  addDays,
  buildKeywordQuery,
  compactNumber,
  formatDateKey,
  formatPercent,
  getChangePercent,
  getDelta,
  getDomainTokens,
  getPresetRange,
  getRangeLabel,
  getRangeLength,
  getToday,
  normalizePath,
  parseDateKey,
} from '../../../lib/performance/formatters';
import { slugToDomain } from '../../../utils/slugToDomain';

const KeywordFilterModal = dynamic(() => import('../../../components/performance/KeywordFilterModal'), { ssr: false });
const DateRangePicker = dynamic(
  () => import('../../../components/koala/core/calendar/dateRangePicker').then((m) => m.DateRangePicker),
  { ssr: false },
);

const ROW_COLUMNS = [60, 50, 40, 40] as const;

function TableSkeleton({ headerLabelWidth }: { headerLabelWidth: number }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, background: 'var(--koala-bg-primary)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: headerLabelWidth, height: 20, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
        {ROW_COLUMNS.map((w, i) => (
          <div key={i} style={{ width: w, height: 20, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, borderBottom: i < 4 ? '1px solid var(--koala-bg-secondary)' : 'none', paddingBottom: i < 4 ? 14 : 0, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 14, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
          {ROW_COLUMNS.map((w, j) => (
            <div key={j} style={{ width: w, height: 14, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
          ))}
        </div>
      ))}
    </section>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10L8.22 6.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
    </svg>
  );
}


function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2m-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z" clipRule="evenodd" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0m-6.5 6.326a6.5 6.5 0 0 1-1.5.174a6.49 6.49 0 0 1-5.011-2.36l.49-.98a.423.423 0 0 1 .614-.164l.294.196a.992.992 0 0 0 1.491-1.139l-.197-.593a.25.25 0 0 1 .126-.304l1.973-.987a.938.938 0 0 0 .361-1.359a.375.375 0 0 1 .239-.576l.125-.025A2.42 2.42 0 0 0 12.327 6.6l.05-.149a1 1 0 0 0-.242-1.023l-1.489-1.489a.5.5 0 0 1-.146-.353v-.067a6.5 6.5 0 0 1 5.392 9.23a1.4 1.4 0 0 0-.68-.244l-.566-.566a1.5 1.5 0 0 0-1.06-.439h-.172a1.5 1.5 0 0 0-1.06.44l-.593.592a.5.5 0 0 1-.13.093l-1.578.79a1 1 0 0 0-.553.894v.191a1 1 0 0 0 1 1h.5a.5.5 0 0 1 .5.5z" clipRule="evenodd" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313zM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444l.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294m9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444l-.806-.444a.75.75 0 0 1-.295-1.02M7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019M2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75m14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75m-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75" clipRule="evenodd" />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-3.105a3.5 3.5 0 0 0 1.1 1.677A.75.75 0 0 1 13.26 18H6.74a.75.75 0 0 1-.484-1.323A3.5 3.5 0 0 0 7.355 15H4.25A2.25 2.25 0 0 1 2 12.75zm1.5 0a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      <g fill="currentColor">
        <path d="M8 16.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 8 16.25" />
        <path fillRule="evenodd" d="M4 4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zm4-1.5v.75c0 .414.336.75.75.75h2.5a.75.75 0 0 0 .75-.75V2.5h1A1.5 1.5 0 0 1 14.5 4v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 16V4A1.5 1.5 0 0 1 7 2.5z" clipRule="evenodd" />
      </g>
    </svg>
  );
}

function TabletIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5 1a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V4a3 3 0 0 0-3-3zM3.5 4A1.5 1.5 0 0 1 5 2.5h10A1.5 1.5 0 0 1 16.5 4v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16zm5.25 11.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5z" clipRule="evenodd" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865a.75.75 0 0 0 .977-1.138a2.5 2.5 0 0 1-.142-3.667z" />
      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138q.072.062.142.131a2.5 2.5 0 0 1 0 3.536l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865" />
    </svg>
  );
}

function KeywordIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5 5 0 0 1 8 7m5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7A.75.75 0 0 0 16 7a3 3 0 0 0-3-3" clipRule="evenodd" />
    </svg>
  );
}

function DeltaIcon({ direction }: { direction: Delta }) {
  if (direction === 'neutral') {
    return <div style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--koala-border-primary)', flexShrink: 0 }} />;
  }

  return direction === 'up' ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="6" viewBox="0 0 8 6" fill="none" className="inline-block shrink-0 align-sub">
      <path d="M3.29289 1.20711L0.707107 3.79289C0.077142 4.42286 0.523309 5.5 1.41421 5.5H6.58579C7.47669 5.5 7.92286 4.42286 7.2929 3.79289L4.70711 1.20711C4.31658 0.816583 3.68342 0.816582 3.29289 1.20711Z" fill="var(--koala-status-success)" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="6" viewBox="0 0 8 6" fill="none" className="inline-block shrink-0 align-sub">
      <path d="M3.29289 4.79289L0.707107 2.20711C0.077142 1.57714 0.523309 0.5 1.41421 0.5H6.58579C7.47669 0.5 7.92286 1.57714 7.2929 2.20711L4.70711 4.79289C4.31658 5.18342 3.68342 5.18342 3.29289 4.79289Z" fill="var(--koala-status-danger)" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87q.11.06.22.127c.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a8 8 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a7 7 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124q.108-.066.22-.128c.332-.183.582-.495.644-.869z" />
        <path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0" />
      </g>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

const SORT_ORDER_OPTIONS = [
  { value: 'highest', label: 'highest' },
  { value: 'lowest', label: 'lowest' },
] as const;

const SORT_METRIC_OPTIONS = [
  { value: 'clicks', label: 'clicks' },
  { value: 'impressions', label: 'impressions' },
  { value: 'ctr', label: 'ctr' },
  { value: 'position', label: 'position' },
] as const;

const METRIC_ICONS: Record<MetricKey, string> = {
  clicks: 'CursorClick',
  impressions: 'Eye',
  ctr: 'ChartLineUp',
  position: 'Ranking',
};

/** Koala Analytics Item (Figma 9834:294099) — flat KPI cell with outline delta badge. */
function AnalyticsItem({
  icon,
  label,
  value,
  change,
  period,
  muted = false,
  onToggle,
  last = false,
  direction,
}: {
  icon: string;
  label: string;
  value: string;
  change?: number | null;
  period?: string;
  muted?: boolean;
  onToggle?: () => void;
  last?: boolean;
  /** Compact triangle when no % change (summary strip). */
  direction?: Delta;
}) {
  const hasChange = change !== undefined;
  const positive = change == null ? null : change >= 0;
  const deltaText = change == null
    ? null
    : `${change >= 0 ? '+' : ''}${Math.round(change)}%`;

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
        <Icon name={icon} size={20} weight="bold" color="var(--koala-text-primary)" />
        <span
          style={{
            flex: '1 1 0',
            minWidth: 0,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: '20px',
            letterSpacing: '-0.4px',
            color: 'var(--koala-text-primary)',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              lineHeight: '36px',
              letterSpacing: '-0.07px',
              color: 'var(--koala-text-primary)',
              fontFamily: 'var(--font-family-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
          {hasChange ? (
            <div style={{ paddingBottom: 6 }}>
              <TrendDeltaBadge
                delta={deltaText ?? '='}
                positive={positive}
                variant="outline"
                size="sm"
              />
            </div>
          ) : direction ? (
            <div style={{ paddingBottom: 10 }}>
              <DeltaIcon direction={direction} />
            </div>
          ) : null}
        </div>
        {period ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: '20px',
              letterSpacing: '-0.4px',
              color: 'var(--koala-text-tertiary)',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            {period}
          </p>
        ) : null}
      </div>
    </>
  );

  const shellStyle: React.CSSProperties = {
    flex: '1 0 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingRight: last ? 0 : 24,
    borderRight: last ? 'none' : '1px solid var(--koala-border-primary)',
    opacity: muted ? 0.45 : 1,
    transition: 'opacity 150ms ease',
    fontFamily: 'var(--font-family-primary)',
    textAlign: 'left',
    boxSizing: 'border-box',
  };

  if (onToggle) {
    return (
      <button
        type="button"
        className="performance-analytics-item"
        onClick={onToggle}
        aria-pressed={!muted}
        title={muted ? `Show ${label} on chart` : `Hide ${label} on chart`}
        style={{
          ...shellStyle,
          margin: 0,
          background: 'transparent',
          border: 'none',
          borderRight: last ? 'none' : '1px solid var(--koala-border-primary)',
          cursor: 'pointer',
        }}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="performance-analytics-item" style={shellStyle}>
      {body}
    </div>
  );
}

function MetricCard({
  metricKey,
  label,
  value,
  change,
  period,
  muted = false,
  onToggle,
  last = false,
}: {
  metricKey: MetricKey;
  label: string;
  value: string;
  change: number | null;
  period: string;
  muted?: boolean;
  onToggle?: () => void;
  last?: boolean;
}) {
  return (
    <AnalyticsItem
      icon={METRIC_ICONS[metricKey]}
      label={label}
      value={value}
      change={change}
      period={period}
      muted={muted}
      onToggle={onToggle}
      last={last}
    />
  );
}

function SummaryCard({
  icon,
  label,
  value,
  direction,
  last = false,
}: {
  icon: string;
  label: string;
  value: string;
  direction?: Delta;
  last?: boolean;
}) {
  return (
    <AnalyticsItem
      icon={icon}
      label={label}
      value={value}
      direction={direction}
      last={last}
    />
  );
}

function DeltaValue({ value, direction }: { value: string; direction: Delta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      <DeltaIcon direction={direction} />
      <span>{value}</span>
    </div>
  );
}

const METRIC_COL: React.CSSProperties = {
  padding: '10px 16px',
  width: 108,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  fontSize: 13,
  color: 'var(--koala-text-primary)',
  fontFamily: 'var(--font-family-primary)',
};

const HEADER_METRIC: React.CSSProperties = {
  padding: '8px 16px',
  width: 108,
  flexShrink: 0,
  textAlign: 'right',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '-0.4px',
  color: 'var(--koala-text-secondary)',
  fontFamily: 'var(--font-family-primary)',
};

/** Pages / Keywords rows — same DataTable shell as Recommendations. */
const PERF_TABLE_PAGE_SIZE = 10;

function PerformanceMetricTable({
  label,
  rows,
  emptyLabel,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  label: string;
  rows: TableRow[];
  emptyLabel: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <DataTable>
        <DataTableScroll>
          <DataTableContent minWidth={720} aria-label={label}>
            <DataTableHeader>
              <div
                style={{
                  padding: '8px 16px',
                  flex: '1 1 0',
                  minWidth: 200,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '-0.4px',
                  color: 'var(--koala-text-secondary)',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                {label}
              </div>
              <div style={HEADER_METRIC}>Clicks</div>
              <div style={HEADER_METRIC}>Impr.</div>
              <div className="performance-col-secondary" style={HEADER_METRIC}>CTR</div>
              <div className="performance-col-secondary" style={HEADER_METRIC}>Position</div>
            </DataTableHeader>

            {rows.length === 0 ? (
              <DataTableEmpty>{emptyLabel}</DataTableEmpty>
            ) : (
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.key}
                    className="perf-row"
                    style={{ minHeight: 56, alignItems: 'center' }}
                  >
                    <div style={{ padding: '10px 16px', flex: '1 1 0', minWidth: 200, overflow: 'hidden' }}>
                      <span
                        title={row.label}
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--koala-text-primary)',
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        {row.href ? (
                          <a
                            href={row.href}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {row.label}
                          </a>
                        ) : (
                          row.label
                        )}
                      </span>
                    </div>
                    <div style={METRIC_COL}>
                      <DeltaValue value={compactNumber(row.clicks)} direction={row.clickDir} />
                    </div>
                    <div style={METRIC_COL}>
                      <DeltaValue value={compactNumber(row.impressions)} direction={row.impressionDir} />
                    </div>
                    <div className="performance-col-secondary" style={METRIC_COL}>
                      <DeltaValue value={formatPercent(row.ctr)} direction={row.ctrDir} />
                    </div>
                    <div className="performance-col-secondary" style={METRIC_COL}>
                      <DeltaValue
                        value={row.position.toFixed(1).replace('.0', '')}
                        direction={row.positionDir}
                      />
                    </div>
                  </DataTableRow>
                ))}
              </DataTableBody>
            )}
          </DataTableContent>
        </DataTableScroll>
      </DataTable>
      {total > pageSize ? (
        <div style={{ padding: '0 16px 16px' }}>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={onPageChange}
            caption={getPaginationCaption({ page, pageSize, total })}
          />
        </div>
      ) : null}
    </>
  );
}


const PerformancePage: NextPage = () => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';

  const [datePreset, setDatePreset] = useState<DatePreset>('30');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeValue>(() => getPresetRange('30'));
  const [locationCode, setLocationCode] = useState('ALL');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  const [pageFilter, setPageFilter] = useState<PageFilter>('all');
  const [keywordMode, setKeywordMode] = useState<KeywordMode>('all');
  const [customKeywordRule, setCustomKeywordRule] = useState<KeywordRule | null>(null);
  const [keywordModalMode, setKeywordModalMode] = useState<'custom' | 'brand' | null>(null);
  const [keywordOperatorDraft, setKeywordOperatorDraft] = useState<KeywordOperator>('contains');
  const [keywordValueDraft, setKeywordValueDraft] = useState('');
  const [brandKeywordDraft, setBrandKeywordDraft] = useState('');
  const [pageSortMetric, setPageSortMetric] = useState<SortMetric>('clicks');
  const [pageSortOrder, setPageSortOrder] = useState<SortOrder>('highest');
  const [keywordSortMetric, setKeywordSortMetric] = useState<SortMetric>('clicks');
  const [keywordSortOrder, setKeywordSortOrder] = useState<SortOrder>('highest');
  const [tableTab, setTableTab] = useState<'pages' | 'keywords'>('pages');
  const [tablePage, setTablePage] = useState(1);

  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState({ clicks: true, impressions: true, ctr: false, position: false });

  const defaultBrandTerms = useMemo(() => getDomainTokens(domain), [domain]);
  const [brandTerms, setBrandTerms] = useState<string[]>([]);

  useEffect(() => {
    setBrandTerms(defaultBrandTerms);
    setBrandKeywordDraft(defaultBrandTerms.join(', '));
  }, [defaultBrandTerms]);

  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];

  const keywordQuery = useMemo(
    () => buildKeywordQuery(keywordMode, customKeywordRule, brandTerms),
    [brandTerms, customKeywordRule, keywordMode],
  );

  const performanceQuery = useMemo(() => {
    const params = new URLSearchParams({
      domain: slug || '',
      startDate: selectedDateRange.start,
      endDate: selectedDateRange.end,
    });

    if (locationCode !== 'ALL') {
      params.set('country', locationCode);
    }

    if (deviceFilter !== 'all') {
      params.set('device', deviceFilter);
    }

    if (keywordQuery) {
      params.set('keywordOperator', keywordQuery.operator);
      params.set('keywordValue', keywordQuery.value);
    }

    return params.toString();
  }, [deviceFilter, keywordQuery, locationCode, selectedDateRange.end, selectedDateRange.start, slug]);

  const { data: scData, isLoading } = useQuery(
    ['sc-domain-performance', slug, performanceQuery],
    async () => {
      const response = await fetch(`/api/gsc/search-data?${performanceQuery}`);
      return response.json();
    },
    { enabled: !!slug, staleTime: 0, keepPreviousData: true },
  );

  const { data: baseScData } = useQuery(
    ['sc-domain-performance-base', slug],
    async () => {
      const response = await fetch(`/api/gsc/search-data?domain=${slug}`);
      return response.json();
    },
    { enabled: !!slug, staleTime: 5 * 60 * 1000 },
  );

  const { data: auditData } = useQuery<AuditResponseData>(
    ['sc-domain-performance-audit', slug],
    async () => {
      const response = await fetch(`/api/audit?domain=${slug}&scFilter=thirtyDays`);
      return response.json();
    },
    { enabled: !!slug, staleTime: 5 * 60 * 1000 },
  );

  const currentRangeItems: SearchAnalyticsItem[] = scData?.data?.selectedRange || scData?.data?.thirtyDays || [];
  const previousRangeItems: SearchAnalyticsItem[] = scData?.data?.previousRange || scData?.data?.sevenDays || [];
  const currentStats: SearchAnalyticsStat[] = scData?.data?.stats || [];
  const previousStats: SearchAnalyticsStat[] = scData?.data?.previousStats || [];

  const availableLocations = useMemo(() => {
    const sourceItems: SearchAnalyticsItem[] = [
      ...(baseScData?.data?.thirtyDays || []),
      ...(baseScData?.data?.sevenDays || []),
      ...(baseScData?.data?.threeDays || []),
    ];
    const uniqueCodes = Array.from(new Set(sourceItems.map((item) => item.country).filter(Boolean)));
    const options = uniqueCodes
      .map((code) => ({
        code,
        label: countries[code]?.[0] || code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ code: 'ALL', label: 'All locations' }, ...options];
  }, [baseScData]);

  const locationSelectOptions = useMemo(
    () => availableLocations.map((item) => ({
      value: item.code,
      label: item.label,
      textValue: item.label,
      leadingItems: item.code !== 'ALL' ? (
        <img src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${item.code.toLowerCase()}.svg`} alt="" style={{ display: 'block', width: 16, height: 12, boxShadow: 'rgba(0, 0, 0, 0.5) 0px 0px 1px 0px' }} />
      ) : undefined,
    })),
    [availableLocations],
  );

  const deviceSelectOptions = useMemo(
    () => DEVICE_OPTIONS.map((item) => ({
      value: item.value,
      label: item.label,
      leadingItems: item.value === 'desktop' ? <DesktopIcon /> : item.value === 'mobile' ? <MobileIcon /> : item.value === 'tablet' ? <TabletIcon /> : <DeviceIcon />,
    })),
    [],
  );

  const pageSelectOptions = useMemo(
    () => PAGE_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  const trackedPaths = useMemo(
    () => new Set((auditData?.items || []).map((item) => normalizePath(item.url))),
    [auditData],
  );
  const optimizedPaths = useMemo(
    () => new Set((auditData?.items || []).filter((item) => item.contentScore > 0).map((item) => normalizePath(item.url))),
    [auditData],
  );

  const selectedLocationLabel = availableLocations.find((item) => item.code === locationCode)?.label || 'All locations';
  const selectedDeviceLabel = DEVICE_OPTIONS.find((item) => item.value === deviceFilter)?.label || 'All devices';
  const selectedPageLabel = PAGE_OPTIONS.find((item) => item.value === pageFilter)?.label || 'All pages';
  const selectedKeywordLabel = useMemo(() => {
    if (keywordMode === 'custom' && customKeywordRule?.value.trim()) {
      return customKeywordRule.value.trim();
    }
    if (keywordMode === 'branded') return 'Branded keywords';
    if (keywordMode === 'nonBranded') return 'Non-branded keywords';
    return 'All keywords';
  }, [customKeywordRule, keywordMode]);

  const computed = useMemo(() => {
    const statsTotals = currentStats.reduce(
      (acc, item) => ({
        clicks: acc.clicks + item.clicks,
        impressions: acc.impressions + item.impressions,
        ctr: acc.ctr + item.ctr,
        position: acc.position + item.position,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    );

    const previousTotals = previousStats.reduce(
      (acc, item) => ({
        clicks: acc.clicks + item.clicks,
        impressions: acc.impressions + item.impressions,
        ctr: acc.ctr + item.ctr,
        position: acc.position + item.position,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    );

    const avgCtr = currentStats.length ? statsTotals.ctr / currentStats.length : 0;
    const avgPosition = currentStats.length ? statsTotals.position / currentStats.length : 0;
    const previousAvgCtr = previousStats.length ? previousTotals.ctr / previousStats.length : 0;
    const previousAvgPosition = previousStats.length ? previousTotals.position / previousStats.length : 0;

    const statsCards = [
      {
        key: 'clicks' as MetricKey,
        label: 'Clicks',
        value: compactNumber(statsTotals.clicks),
        change: getChangePercent(statsTotals.clicks, previousTotals.clicks),
      },
      {
        key: 'impressions' as MetricKey,
        label: 'Impressions',
        value: compactNumber(statsTotals.impressions),
        change: getChangePercent(statsTotals.impressions, previousTotals.impressions),
      },
      {
        key: 'ctr' as MetricKey,
        label: 'Avg. CTR',
        value: formatPercent(avgCtr),
        change: getChangePercent(avgCtr, previousAvgCtr),
      },
      {
        key: 'position' as MetricKey,
        label: 'Avg. position',
        value: avgPosition > 0 ? avgPosition.toFixed(1) : '0.0',
        change: getChangePercent(previousAvgPosition, avgPosition),
      },
    ];

    const currentKeywordMap = new Map<string, { clicks: number; impressions: number; ctrTotal: number; positionTotal: number; count: number }>();
    currentRangeItems.forEach((item) => {
      const existing = currentKeywordMap.get(item.keyword);
      if (!existing) {
        currentKeywordMap.set(item.keyword, {
          clicks: item.clicks,
          impressions: item.impressions,
          ctrTotal: item.ctr,
          positionTotal: item.position,
          count: 1,
        });
      } else {
        existing.clicks += item.clicks;
        existing.impressions += item.impressions;
        existing.ctrTotal += item.ctr;
        existing.positionTotal += item.position;
        existing.count += 1;
      }
    });

    const previousKeywordMap = new Map<string, { clicks: number; impressions: number; ctrTotal: number; positionTotal: number; count: number }>();
    previousRangeItems.forEach((item) => {
      const existing = previousKeywordMap.get(item.keyword);
      if (!existing) {
        previousKeywordMap.set(item.keyword, {
          clicks: item.clicks,
          impressions: item.impressions,
          ctrTotal: item.ctr,
          positionTotal: item.position,
          count: 1,
        });
      } else {
        existing.clicks += item.clicks;
        existing.impressions += item.impressions;
        existing.ctrTotal += item.ctr;
        existing.positionTotal += item.position;
        existing.count += 1;
      }
    });

    let top3 = 0;
    let pos4to10 = 0;
    let pos11to20 = 0;

    currentKeywordMap.forEach((item) => {
      const avgPositionValue = item.positionTotal / item.count;
      if (avgPositionValue > 0 && avgPositionValue <= 3) top3 += 1;
      else if (avgPositionValue > 3 && avgPositionValue <= 10) pos4to10 += 1;
      else if (avgPositionValue > 10 && avgPositionValue <= 20) pos11to20 += 1;
    });

    let previousTop3 = 0;
    let previousPos4to10 = 0;
    let previousPos11to20 = 0;
    previousKeywordMap.forEach((item) => {
      const avgPositionValue = item.positionTotal / item.count;
      if (avgPositionValue > 0 && avgPositionValue <= 3) previousTop3 += 1;
      else if (avgPositionValue > 3 && avgPositionValue <= 10) previousPos4to10 += 1;
      else if (avgPositionValue > 10 && avgPositionValue <= 20) previousPos11to20 += 1;
    });

    const keywordSummary = {
      allKeywords: currentKeywordMap.size,
      top3,
      pos4to10,
      pos11to20,
      top3Direction: getDelta(top3, previousTop3),
      pos4to10Direction: getDelta(pos4to10, previousPos4to10),
      pos11to20Direction: getDelta(pos11to20, previousPos11to20, false),
    };

    const currentPageMap = new Map<string, { clicks: number; impressions: number; ctrTotal: number; positionTotal: number; count: number }>();
    currentRangeItems.forEach((item) => {
      if (!item.page) return;
      const existing = currentPageMap.get(item.page);
      if (!existing) {
        currentPageMap.set(item.page, {
          clicks: item.clicks,
          impressions: item.impressions,
          ctrTotal: item.ctr,
          positionTotal: item.position,
          count: 1,
        });
      } else {
        existing.clicks += item.clicks;
        existing.impressions += item.impressions;
        existing.ctrTotal += item.ctr;
        existing.positionTotal += item.position;
        existing.count += 1;
      }
    });

    const previousPageMap = new Map<string, { clicks: number; impressions: number; ctrTotal: number; positionTotal: number; count: number }>();
    previousRangeItems.forEach((item) => {
      if (!item.page) return;
      const existing = previousPageMap.get(item.page);
      if (!existing) {
        previousPageMap.set(item.page, {
          clicks: item.clicks,
          impressions: item.impressions,
          ctrTotal: item.ctr,
          positionTotal: item.position,
          count: 1,
        });
      } else {
        existing.clicks += item.clicks;
        existing.impressions += item.impressions;
        existing.ctrTotal += item.ctr;
        existing.positionTotal += item.position;
        existing.count += 1;
      }
    });

    const pageRows: TableRow[] = Array.from(currentPageMap.entries()).map(([page, value]) => {
      const previous = previousPageMap.get(page);
      const path = normalizePath(page);
      const href = page.startsWith('http') ? page : `https://${domain}${path}`;
      const label = path === '/' ? `${domain}/` : path;

      return {
        key: page,
        label,
        href,
        path,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr: value.ctrTotal / value.count,
        position: value.positionTotal / value.count,
        clickDir: previous ? getDelta(value.clicks, previous.clicks) : 'neutral',
        impressionDir: previous ? getDelta(value.impressions, previous.impressions) : 'neutral',
        ctrDir: previous ? getDelta(value.ctrTotal / value.count, previous.ctrTotal / previous.count) : 'neutral',
        positionDir: previous ? getDelta(value.positionTotal / value.count, previous.positionTotal / previous.count, false) : 'neutral',
      };
    });

    const keywordRows: TableRow[] = Array.from(currentKeywordMap.entries()).map(([keyword, value]) => {
      const previous = previousKeywordMap.get(keyword);

      return {
        key: keyword,
        label: keyword,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr: value.ctrTotal / value.count,
        position: value.positionTotal / value.count,
        clickDir: previous ? getDelta(value.clicks, previous.clicks) : 'neutral',
        impressionDir: previous ? getDelta(value.impressions, previous.impressions) : 'neutral',
        ctrDir: previous ? getDelta(value.ctrTotal / value.count, previous.ctrTotal / previous.count) : 'neutral',
        positionDir: previous ? getDelta(value.positionTotal / value.count, previous.positionTotal / previous.count, false) : 'neutral',
      };
    });

    return {
      chart: currentStats.map((item) => ({
        date: item.date,
        clicks: item.clicks,
        impressions: item.impressions,
        ctr: item.ctr,
        position: item.position,
      })),
      statsCards,
      keywordSummary,
      pageRows,
      keywordRows,
    };
  }, [currentRangeItems, currentStats, domain, previousRangeItems, previousStats]);

  const filteredPageRows = useMemo(() => {
    if (pageFilter === 'all') return computed.pageRows;
    if (pageFilter === 'optimized') return computed.pageRows.filter((row) => optimizedPaths.has(row.path || '/'));
    if (pageFilter === 'tracked') return computed.pageRows.filter((row) => trackedPaths.has(row.path || '/'));
    return computed.pageRows.filter((row) => !trackedPaths.has(row.path || '/'));
  }, [computed.pageRows, optimizedPaths, pageFilter, trackedPaths]);

  const sortedPageRows = useMemo(() => {
    const rows = [...filteredPageRows];
    rows.sort((a, b) => {
      const direction = pageSortOrder === 'highest' ? -1 : 1;
      const valueA = a[pageSortMetric];
      const valueB = b[pageSortMetric];
      return valueA > valueB ? direction : valueA < valueB ? -direction : 0;
    });
    return rows;
  }, [filteredPageRows, pageSortMetric, pageSortOrder]);

  const sortedKeywordRows = useMemo(() => {
    const rows = [...computed.keywordRows];
    rows.sort((a, b) => {
      const direction = keywordSortOrder === 'highest' ? -1 : 1;
      const valueA = a[keywordSortMetric];
      const valueB = b[keywordSortMetric];
      return valueA > valueB ? direction : valueA < valueB ? -direction : 0;
    });
    return rows;
  }, [computed.keywordRows, keywordSortMetric, keywordSortOrder]);

  const activeTableRows = tableTab === 'pages' ? sortedPageRows : sortedKeywordRows;
  const activeSortMetric = tableTab === 'pages' ? pageSortMetric : keywordSortMetric;
  const activeSortOrder = tableTab === 'pages' ? pageSortOrder : keywordSortOrder;
  const setActiveSortMetric = tableTab === 'pages' ? setPageSortMetric : setKeywordSortMetric;
  const setActiveSortOrder = tableTab === 'pages' ? setPageSortOrder : setKeywordSortOrder;

  const tablePageCount = Math.max(1, Math.ceil(activeTableRows.length / PERF_TABLE_PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, tablePageCount);
  const pagedTableRows = useMemo(() => {
    const start = (safeTablePage - 1) * PERF_TABLE_PAGE_SIZE;
    return activeTableRows.slice(start, start + PERF_TABLE_PAGE_SIZE);
  }, [activeTableRows, safeTablePage]);

  useEffect(() => {
    setTablePage(1);
  }, [tableTab, pageSortMetric, pageSortOrder, keywordSortMetric, keywordSortOrder, pageFilter, performanceQuery]);

  const handleTodayClick = () => {
    const today = getToday();
    const len = getRangeLength(selectedDateRange);
    setSelectedDateRange({ start: formatDateKey(addDays(today, -(len - 1))), end: formatDateKey(today) });
    setDatePreset('custom');
  };

  const applyPreset = (preset: DatePreset) => {
    const range = getPresetRange(preset, selectedDateRange);
    setDatePreset(preset);
    setSelectedDateRange(range);
  };

  const openKeywordModal = (mode: 'custom' | 'brand') => {
    setFiltersModalOpen(false);
    setKeywordModalMode(mode);
    if (mode === 'custom') {
      setKeywordOperatorDraft(customKeywordRule?.operator || 'contains');
      setKeywordValueDraft(customKeywordRule?.value || '');
    } else {
      setBrandKeywordDraft(brandTerms.join(', '));
    }
  };

  const closeKeywordModal = () => {
    setKeywordModalMode(null);
  };

  const handleKeywordModalSubmit = () => {
    if (keywordModalMode === 'custom') {
      const trimmedValue = keywordValueDraft.trim();
      if (!trimmedValue) return;
      setCustomKeywordRule({ operator: keywordOperatorDraft, value: trimmedValue });
      setKeywordMode('custom');
    }

    if (keywordModalMode === 'brand') {
      const nextTerms = brandKeywordDraft
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      setBrandTerms(nextTerms);
      if (keywordMode === 'branded' || keywordMode === 'nonBranded') {
        setKeywordMode('all');
      }
    }

    closeKeywordModal();
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (datePreset !== '30') n += 1;
    if (locationCode !== 'ALL') n += 1;
    if (deviceFilter !== 'all') n += 1;
    if (pageFilter !== 'all') n += 1;
    if (keywordMode !== 'all') n += 1;
    return n;
  }, [datePreset, locationCode, deviceFilter, pageFilter, keywordMode]);

  const performanceFilterControls = (
    <>
      <CompactSelect
        prefix={<CalendarIcon />}
        size="sm"
        options={[]}
        hideOptions
        triggerLabel={getRangeLabel(datePreset, selectedDateRange)}
        menuTitle="Filter time range"
        menuWidth="min(580px, calc(100vw - 2rem))"
        menuBody={({ close }) => (
          <div style={{ padding: '0 0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {DATE_PRESETS.map((preset) => (
                  <Button key={preset.value} variant={datePreset === preset.value ? 'primary' : 'secondary'} size="xs"
                    onClick={() => { applyPreset(preset.value); close(); }}>
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Button variant="link" size="xs" onClick={() => { handleTodayClick(); close(); }}>Today</Button>
            </div>
            <DateRangePicker
              startDate={parseDateKey(selectedDateRange.start)}
              endDate={parseDateKey(selectedDateRange.end)}
              maxDate={getToday()}
              onChange={({ start, end }) => {
                setSelectedDateRange({ start: formatDateKey(start), end: formatDateKey(end) });
                setDatePreset('custom');
                close();
              }}
            />
          </div>
        )}
      />

      <CompactSelect
        prefix={<LocationIcon />}
        size="sm"
        search={{ placeholder: 'Search locations…' }}
        options={locationSelectOptions}
        value={locationCode}
        triggerLabel={selectedLocationLabel}
        menuMinWidth={300}
        onChange={(opt) => setLocationCode(String(opt.value))}
      />

      <CompactSelect
        prefix={<DeviceIcon />}
        size="sm"
        options={deviceSelectOptions}
        value={deviceFilter}
        triggerLabel={selectedDeviceLabel}
        menuMinWidth={240}
        onChange={(opt) => setDeviceFilter(opt.value as DeviceFilter)}
      />

      <CompactSelect
        prefix={<PageIcon />}
        size="sm"
        options={pageSelectOptions}
        value={pageFilter}
        triggerLabel={selectedPageLabel}
        menuMinWidth={240}
        onChange={(opt) => setPageFilter(opt.value as PageFilter)}
      />

      <CompactSelect
        prefix={<KeywordIcon />}
        size="sm"
        value={keywordMode === 'custom' ? 'all' : keywordMode}
        triggerLabel={selectedKeywordLabel}
        menuMinWidth={260}
        options={[
          {
            options: [
              { value: 'all', label: 'All keywords' },
              { value: '__custom_action__', label: 'Custom Keyword' },
            ],
          },
          {
            options: [
              { value: 'nonBranded', label: 'Non-Branded Keywords' },
              { value: 'branded', label: 'Branded Keywords', trailingItems: <span>{brandTerms.length}</span> },
            ],
          },
          {
            options: [
              { value: '__manage_brand__', label: 'Manage Branded Keywords', leadingItems: <SettingsIcon /> },
            ],
          },
        ]}
        onChange={(opt) => {
          const v = String(opt.value);
          if (v === '__custom_action__') {
            openKeywordModal('custom');
            return;
          }
          if (v === '__manage_brand__') {
            openKeywordModal('brand');
            return;
          }
          setKeywordMode(v as KeywordMode);
        }}
      />
    </>
  );

  const feedbackAction = (
    <FeedbackPopover context="performance">
      {({ open, anchorRef }) => (
        <span ref={anchorRef as React.RefObject<HTMLSpanElement>}>
          <Button type="button" variant="secondary" size="sm" onClick={open}>
            Leave feedback
          </Button>
        </span>
      )}
    </FeedbackPopover>
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{`Performance - ${domain} - Ranksmile`}</title>
      </Head>

      <DomainSubLayout domain={domain} slug={slug || ''} section="Performance" heading="Performance" actions={feedbackAction} contentMaxWidth="unset">
        {isLoading && !scData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, background: 'var(--koala-bg-primary)', padding: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {[120, 140, 100, 90, 130].map((w, i) => (
                  <div key={i} style={{ height: 36, width: w, borderRadius: 9999, background: 'var(--koala-bg-tertiary)' }} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: 16, background: 'var(--koala-bg-secondary)', minHeight: 110, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: 60, height: 14, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
                    <div style={{ width: 80, height: 24, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
                    <div style={{ width: 100, height: 12, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 12, background: 'var(--koala-bg-secondary)', padding: 16 }}>
                <div style={{ height: 220, borderRadius: 6, background: 'var(--koala-bg-tertiary)' }} />
              </div>
            </div>
            <TableSkeleton headerLabelWidth={80} />
            <TableSkeleton headerLabelWidth={90} />
          </div>
        ) : scData?.error ? (
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--koala-status-danger-bg)', background: 'var(--koala-status-danger-bg)', color: 'var(--koala-status-danger)', fontSize: 14, fontFamily: 'var(--font-family-primary)' }}>
            {scData.error}
          </div>
        ) : (
          <>
              <Card padded={false} elevated>
                <div className="performance-panel-body" style={{ padding: 20 }}>
                <PageHeader title="Performance overview" subtitle={domain} />
                <div className="performance-filters-desktop">
                  <PageFilterBar condensed className="performance-filter-bar">
                    <div className="performance-filters" style={{ display: 'contents' }}>
                      {performanceFilterControls}
                    </div>
                  </PageFilterBar>
                </div>

                <div className="performance-filters-mobile">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setFiltersModalOpen(true)}
                    icon={(
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Button>
                </div>

                  <div className="performance-metrics-grid">
                    {computed.statsCards.map((card, index) => (
                      <MetricCard
                        key={card.key}
                        metricKey={card.key}
                        label={card.label}
                        value={card.value}
                        change={card.change}
                        period={getRangeLabel(datePreset, selectedDateRange)}
                        muted={!visibleMetrics[card.key as MetricKey]}
                        last={index === computed.statsCards.length - 1}
                        onToggle={() => setVisibleMetrics((prev) => ({ ...prev, [card.key]: !prev[card.key as MetricKey] }))}
                      />
                    ))}
                  </div>

                  <PerformanceLineChart
                    data={computed.chart}
                    visibleMetrics={visibleMetrics}
                    primaryValue={
                      (visibleMetrics.clicks
                        ? computed.statsCards.find((c) => c.key === 'clicks')
                        : computed.statsCards.find((c) => visibleMetrics[c.key as keyof typeof visibleMetrics]))
                        ?.value ?? '0'
                    }
                    primaryLabel={
                      visibleMetrics.clicks
                        ? 'Clicks'
                        : (computed.statsCards.find((c) => visibleMetrics[c.key as keyof typeof visibleMetrics])?.label ?? 'Clicks')
                    }
                  />
                </div>
              </Card>

              <Card elevated className="performance-summary-card">
                <div className="performance-summary-grid">
                  <SummaryCard icon="MagnifyingGlass" label="All Keywords" value={String(computed.keywordSummary.allKeywords)} />
                  <SummaryCard icon="Trophy" label="Top 3" value={String(computed.keywordSummary.top3)} direction={computed.keywordSummary.top3Direction} />
                  <SummaryCard icon="ListNumbers" label="Position 4-10" value={String(computed.keywordSummary.pos4to10)} direction={computed.keywordSummary.pos4to10Direction} />
                  <SummaryCard icon="Rows" label="Position 11-20" value={String(computed.keywordSummary.pos11to20)} direction={computed.keywordSummary.pos11to20Direction} last />
                </div>
              </Card>

              <Card padded={false} elevated>
                <div style={{ padding: '12px 16px 0' }}>
                  <ToolRibbon className="performance-table-ribbon">
                    <Tabs
                      items={[
                        { value: 'pages', label: 'Pages', count: sortedPageRows.length },
                        { value: 'keywords', label: 'Keywords', count: sortedKeywordRows.length },
                      ]}
                      value={tableTab}
                      onChange={(v) => setTableTab(v as 'pages' | 'keywords')}
                    />
                    <div
                      className="performance-table-header-sorts"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                        {tableTab === 'pages' ? 'Pages' : 'Keywords'} with
                      </span>
                      <CompactSelect
                        size="sm"
                        options={[...SORT_ORDER_OPTIONS]}
                        value={activeSortOrder}
                        onChange={(opt) => {
                          const v = String(opt.value);
                          if (v === 'highest' || v === 'lowest') setActiveSortOrder(v);
                        }}
                      />
                      <CompactSelect
                        size="sm"
                        options={[...SORT_METRIC_OPTIONS]}
                        value={activeSortMetric}
                        onChange={(opt) => {
                          const v = String(opt.value);
                          if (v === 'clicks' || v === 'impressions' || v === 'ctr' || v === 'position') {
                            setActiveSortMetric(v);
                          }
                        }}
                      />
                    </div>
                  </ToolRibbon>
                </div>
                <PerformanceMetricTable
                  label={tableTab === 'pages' ? 'Page' : 'Keyword'}
                  rows={pagedTableRows}
                  emptyLabel={tableTab === 'pages' ? 'No pages in this range.' : 'No keywords in this range.'}
                  page={safeTablePage}
                  pageSize={PERF_TABLE_PAGE_SIZE}
                  total={activeTableRows.length}
                  onPageChange={setTablePage}
                />
              </Card>
          </>
        )}

        {filtersModalOpen ? (
          <Modal
            title="Filters"
            onClose={() => setFiltersModalOpen(false)}
            width={400}
            className="performance-filters-modal"
          >
            <div className="performance-filters-modal-stack">
              {performanceFilterControls}
            </div>
            <ModalFooter>
              <Button type="button" variant="primary" size="sm" onClick={() => setFiltersModalOpen(false)}>
                Done
              </Button>
            </ModalFooter>
          </Modal>
        ) : null}

        {keywordModalMode ? (
          <KeywordFilterModal
            mode={keywordModalMode}
            onClose={closeKeywordModal}
            keywordOperatorDraft={keywordOperatorDraft}
            onKeywordOperatorDraftChange={setKeywordOperatorDraft}
            keywordValueDraft={keywordValueDraft}
            onKeywordValueDraftChange={setKeywordValueDraft}
            brandKeywordDraft={brandKeywordDraft}
            onBrandKeywordDraftChange={setBrandKeywordDraft}
            onSubmit={handleKeywordModalSubmit}
          />
        ) : null}

        <style jsx>{`
          @keyframes growOut {
            0% {
              opacity: 0;
              transform: scale(0.8);
            }

            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @media (max-width: 1100px) and (min-width: 768px) {
            .performance-analytics-item {
              flex: 1 1 calc(50% - 12px) !important;
              min-width: calc(50% - 12px) !important;
            }
          }

          @media (max-width: 720px) {
            .performance-calendar-months {
              flex-wrap: wrap !important;
            }

            .performance-calendar-month {
              min-width: 100% !important;
            }
          }
        `}</style>
      </DomainSubLayout>
    </AppShell>
  );
};

export default PerformancePage;
