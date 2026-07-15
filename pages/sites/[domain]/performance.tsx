/* eslint-disable max-len, no-nested-ternary */
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { SentryPanel, SentryPanelHeader } from '../../../components/sentry-pages';
import { Button, CompactSelect, PageFilterBar } from '../../../components/core';
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
  type GoalPeriod,
  type KeywordMode,
  type KeywordOperator,
  type KeywordRule,
  type MetricKey,
  type PageFilter,
  type SortMetric,
  type SortOrder,
  type TableRow,
  type TrafficGoal,
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

const TrafficGoalModal = dynamic(() => import('../../../components/performance/TrafficGoalModal'), { ssr: false });
const KeywordFilterModal = dynamic(() => import('../../../components/performance/KeywordFilterModal'), { ssr: false });
const DateRangePicker = dynamic(
  () => import('../../../components/core/calendar/dateRangePicker').then((m) => m.DateRangePicker),
  { ssr: false },
);

const ROW_COLUMNS = [60, 50, 40, 40] as const;

function TableSkeleton({ headerLabelWidth }: { headerLabelWidth: number }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, background: '#FFFFFF', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: headerLabelWidth, height: 20, borderRadius: 6, background: '#E0E0E6' }} />
        {ROW_COLUMNS.map((w, i) => (
          <div key={i} style={{ width: w, height: 20, borderRadius: 6, background: '#E8E8ED' }} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, borderBottom: i < 4 ? '1px solid #F4F4F5' : 'none', paddingBottom: i < 4 ? 14 : 0, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 14, borderRadius: 6, background: '#E8E8ED' }} />
          {ROW_COLUMNS.map((w, j) => (
            <div key={j} style={{ width: w, height: 14, borderRadius: 6, background: '#E8E8ED' }} />
          ))}
        </div>
      ))}
    </section>
  );
}

function ChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
    </svg>
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.337 21.718a7 7 0 0 1-.533-.074a.75.75 0 0 1-.44-1.223a3.73 3.73 0 0 0 .814-1.686c.023-.115-.022-.317-.254-.543C3.274 16.587 2.25 14.41 2.25 12c0-5.03 4.428-9 9.75-9s9.75 3.97 9.75 9s-4.428 9-9.75 9c-.833 0-1.643-.097-2.417-.279a6.72 6.72 0 0 1-4.246.997" clipRule="evenodd" />
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

function EyeIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      {muted ? (
        <>
          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.03 10.03 0 0 0 3.3-4.38a1.65 1.65 0 0 0 0-1.185A10 10 0 0 0 9.999 3a9.96 9.96 0 0 0-4.744 1.194zm4.472 4.47l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092A4 4 0 0 0 7.752 6.69" clipRule="evenodd" />
          <path d="m10.748 13.93l2.523 2.523a10 10 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.65 1.65 0 0 1 0-1.186A10 10 0 0 1 2.839 6.02L6.07 9.252Q6 9.616 6 10a4 4 0 0 0 4.748 3.93" />
        </>
      ) : (
        <>
          <path d="M10 12.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5" />
          <path fillRule="evenodd" d="M.664 10.59a1.65 1.65 0 0 1 0-1.186A10 10 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41c.147.381.146.804 0 1.186A10 10 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41M14 10a4 4 0 1 1-8 0a4 4 0 0 1 8 0" clipRule="evenodd" />
        </>
      )}
    </svg>
  );
}

function DeltaIcon({ direction }: { direction: Delta }) {
  if (direction === 'neutral') {
    return <div style={{ width: 6, height: 6, borderRadius: 9999, background: '#D4D4D8', flexShrink: 0 }} />;
  }

  return direction === 'up' ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="6" viewBox="0 0 8 6" fill="none" className="inline-block shrink-0 align-sub">
      <path d="M3.29289 1.20711L0.707107 3.79289C0.077142 4.42286 0.523309 5.5 1.41421 5.5H6.58579C7.47669 5.5 7.92286 4.42286 7.2929 3.79289L4.70711 1.20711C4.31658 0.816583 3.68342 0.816582 3.29289 1.20711Z" fill="#1AB25E" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="6" viewBox="0 0 8 6" fill="none" className="inline-block shrink-0 align-sub">
      <path d="M3.29289 4.79289L0.707107 2.20711C0.077142 1.57714 0.523309 0.5 1.41421 0.5H6.58579C7.47669 0.5 7.92286 1.57714 7.2929 2.20711L4.70711 4.79289C4.31658 5.18342 3.68342 5.18342 3.29289 4.79289Z" fill="#FF6F77" />
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

function TableSortButton({
  value,
  onClick,
}: {
  value: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      style={{ borderRadius: 8, border: '1px solid #D4D4D8', background: 'transparent', color: '#18181B' }}
    >
      <span style={{ textTransform: 'lowercase' }}>{value}</span>
      <ChevronDown size={18} />
    </Button>
  );
}

function MetricCard({
  label,
  value,
  change,
  accentBg,
  accentColor,
  gradientColor,
  muted = false,
  onToggle,
}: {
  label: string;
  value: string;
  change: number | null;
  accentBg: string;
  accentColor: string;
  gradientColor?: string;
  muted?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className="perf-3d-card"
      style={{
      borderRadius: 12,
      padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: gradientColor
          ? `linear-gradient(to right, color-mix(in oklab, ${gradientColor} 5%, transparent), transparent)`
          : '#FFFFFF',
        minHeight: 110,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{value}</span>
          <span style={{ fontSize: 12, lineHeight: '16px', fontFamily: 'var(--font-family-primary)' }}>
            {change === null ? (
              <>
                <span style={{ color: '#52525C' }}>-</span>
                <span style={{ color: '#52525C' }}> vs previous period</span>
              </>
            ) : (
              <>
                <span style={{ color: change >= 0 ? '#1AB25E' : '#FF6F77', fontWeight: 600 }}>
                  {change >= 0 ? '+' : ''}
                  {Math.round(change)}%
                </span>
                <span style={{ color: '#52525C' }}> vs previous period</span>
              </>
            )}
          </span>
        </div>
      </div>
      <Button
        variant="secondary"
        size="zero"
        onClick={onToggle}
        style={{ padding: 8, borderRadius: 8, background: accentBg, color: accentColor, border: 'none', flexShrink: 0, opacity: muted ? 0.5 : 1, transition: 'opacity 150ms ease' }}
        icon={<EyeIcon muted={muted} />}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  direction,
}: {
  label: string;
  value: string;
  direction?: Delta;
}) {
  return (
    <div className="perf-3d-card" style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 8, borderRadius: 12, background: '#FFFFFF', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
        <span style={{ color: '#52525C', display: 'inline-flex' }}><InfoIcon /></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 24, lineHeight: '32px', fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{value}</span>
        {direction ? <DeltaIcon direction={direction} /> : null}
      </div>
    </div>
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

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalPercentage, setGoalPercentage] = useState(10);
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>('MONTH');
  const [trafficGoal, setTrafficGoal] = useState<TrafficGoal | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
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
      const response = await fetch(`/api/searchconsole?${performanceQuery}`);
      return response.json();
    },
    { enabled: !!slug, staleTime: 0, keepPreviousData: true },
  );

  const { data: baseScData } = useQuery(
    ['sc-domain-performance-base', slug],
    async () => {
      const response = await fetch(`/api/searchconsole?domain=${slug}`);
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

  const { refetch: refetchGoal } = useQuery(
    ['domain-traffic-goal', slug],
    async () => {
      const response = await fetch(`/api/domains/goal?domain=${slug}`);
      return response.json();
    },
    {
      enabled: !!slug,
      staleTime: 60 * 1000,
      onSuccess: (data) => {
        if (data?.goal) setTrafficGoal(data.goal);
      },
    },
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
        accentBg: '#F4F4F5',
        accentColor: '#2F2F34',
        gradientColor: '#74A9FF',
        muted: false,
      },
      {
        key: 'impressions' as MetricKey,
        label: 'Impressions',
        value: compactNumber(statsTotals.impressions),
        change: getChangePercent(statsTotals.impressions, previousTotals.impressions),
        accentBg: '#F4F4F5',
        accentColor: '#2F2F34',
        gradientColor: '#F29964',
        muted: false,
      },
      {
        key: 'ctr' as MetricKey,
        label: 'Avg. CTR',
        value: formatPercent(avgCtr),
        change: getChangePercent(avgCtr, previousAvgCtr),
        accentBg: '#F4F4F5',
        accentColor: '#2F2F34',
        gradientColor: '#22C55E',
        muted: true,
      },
      {
        key: 'position' as MetricKey,
        label: 'Avg. position',
        value: avgPosition > 0 ? avgPosition.toFixed(1) : '0.0',
        change: getChangePercent(previousAvgPosition, avgPosition),
        accentBg: '#F4F4F5',
        accentColor: '#2F2F34',
        gradientColor: '#F97316',
        muted: true,
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
    return rows.slice(0, 5);
  }, [filteredPageRows, pageSortMetric, pageSortOrder]);

  const sortedKeywordRows = useMemo(() => {
    const rows = [...computed.keywordRows];
    rows.sort((a, b) => {
      const direction = keywordSortOrder === 'highest' ? -1 : 1;
      const valueA = a[keywordSortMetric];
      const valueB = b[keywordSortMetric];
      return valueA > valueB ? direction : valueA < valueB ? -direction : 0;
    });
    return rows.slice(0, 5);
  }, [computed.keywordRows, keywordSortMetric, keywordSortOrder]);

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

  const currentClicks = computed.statsCards.find((c) => c.key === 'clicks')
    ? computed.statsCards[0]?.value
    : '0';

  const handleSaveGoal = async () => {
    if (!slug) return;
    setGoalSaving(true);
    const baseClicks = parseInt(String(currentClicks).replace(/[^0-9]/g, ''), 10) || 0;
    try {
      const response = await fetch(`/api/domains/goal?domain=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: goalPercentage, period: goalPeriod, baseClicks }),
      });
      const data = await response.json();
      if (data.goal) {
        setTrafficGoal(data.goal);
        setGoalModalOpen(false);
        refetchGoal();
      }
    } catch (error) {
      console.error('Error saving goal:', error);
    }
    setGoalSaving(false);
  };

  const handleDeleteGoal = async () => {
    if (!slug) return;
    try {
      await fetch(`/api/domains/goal?domain=${slug}`, { method: 'DELETE' });
      setTrafficGoal(null);
      setGoalModalOpen(false);
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const goalProjectionData = useMemo(() => {
    if (!trafficGoal) return [];
    const base = trafficGoal.baseClicks || 0;
    const rate = trafficGoal.period === 'MONTH' ? trafficGoal.percentage / 100 : (trafficGoal.percentage / 100) / 3;
    const start = new Date(trafficGoal.startDate);
    const months = 12;
    const data: Array<{ label: string; projected: number; actual?: number }> = [];
    for (let i = 0; i < months; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: d.getFullYear() !== start.getFullYear() ? 'numeric' : undefined });
      data.push({ label: monthLabel, projected: Math.round(base * (1 + rate) ** i) });
    }
    return data;
  }, [trafficGoal]);

  const goalStats = useMemo(() => {
    if (!trafficGoal) return null;
    const base = trafficGoal.baseClicks || 0;
    const rate = trafficGoal.period === 'MONTH' ? trafficGoal.percentage / 100 : (trafficGoal.percentage / 100) / 3;
    const today = new Date();
    const start = new Date(trafficGoal.startDate);
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
    const periodDays = trafficGoal.period === 'MONTH' ? 30 : 90;
    const daysRemaining = Math.max(0, periodDays - (daysElapsed % periodDays));
    const targetClicks = Math.round(base * (1 + rate));
    const totalCurrentClicks = parseInt(String(currentClicks).replace(/[^0-9]/g, ''), 10) || 0;
    const progressPct = targetClicks > 0 ? Math.min(100, Math.round((totalCurrentClicks / targetClicks) * 100)) : 0;
    const avgNeeded = daysRemaining > 0 ? Math.max(0, Math.round((targetClicks - totalCurrentClicks) / daysRemaining)) : 0;
    return { progressPct, targetClicks, totalCurrentClicks, daysRemaining, avgNeeded };
  }, [trafficGoal, currentClicks]);

  const feedbackAction = (
    <Button variant="link" size="sm" icon={<FeedbackIcon />} style={{ padding: 0, color: '#3F3F47' }}>
      Leave feedback
    </Button>
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{`Performance - ${domain} - SerpBear`}</title>
      </Head>

      <DomainSubLayout domain={domain} slug={slug || ''} section="Performance" heading="Performance" actions={feedbackAction} contentMaxWidth="unset">
        {isLoading && !scData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderRadius: 12, background: '#FFFFFF', padding: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {[120, 140, 100, 90, 130].map((w, i) => (
                  <div key={i} style={{ height: 36, width: w, borderRadius: 9999, background: '#E8E8ED' }} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ borderRadius: 12, padding: 16, background: '#F8F8F9', minHeight: 110, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: 60, height: 14, borderRadius: 6, background: '#E8E8ED' }} />
                    <div style={{ width: 80, height: 24, borderRadius: 6, background: '#E0E0E6' }} />
                    <div style={{ width: 100, height: 12, borderRadius: 6, background: '#E8E8ED' }} />
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 12, background: '#F8F8F9', padding: 16 }}>
                <div style={{ height: 220, borderRadius: 6, background: '#E8E8ED' }} />
              </div>
            </div>
            <TableSkeleton headerLabelWidth={80} />
            <TableSkeleton headerLabelWidth={90} />
          </div>
        ) : scData?.error ? (
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid #FECACA', background: '#FFF1F2', color: '#B91C1C', fontSize: 14, fontFamily: 'var(--font-family-primary)' }}>
            {scData.error}
          </div>
        ) : (
          <>
              <SentryPanel noPadding>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <PageFilterBar condensed className="performance-filter-bar">
                <div className="performance-filters" style={{ display: 'contents' }}>
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
                  </div>
                </PageFilterBar>

                  <div className="performance-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                    {computed.statsCards.map((card) => (
                      <MetricCard
                        key={card.key}
                        label={card.label}
                        value={card.value}
                        change={card.change}
                        accentBg={card.accentBg}
                        accentColor={card.accentColor}
                        gradientColor={card.gradientColor}
                        muted={!visibleMetrics[card.key as MetricKey]}
                        onToggle={() => setVisibleMetrics((prev) => ({ ...prev, [card.key]: !prev[card.key as MetricKey] }))}
                      />
                    ))}
                  </div>

                  <PerformanceLineChart data={computed.chart} visibleMetrics={visibleMetrics} />

                  <div className="performance-goal-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, color: '#3F3F47', fontFamily: 'var(--font-family-primary)', fontSize: 14, borderTop: '1px solid #F4F4F5', paddingTop: 20, marginTop: 4 }}>
                  {trafficGoal ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <div style={{ fontWeight: 400 }}>Goal</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Increase clicks by {trafficGoal.percentage}% each {trafficGoal.period === 'MONTH' ? 'month' : 'quarter'}</span>
                          <Button
                            type="button"
                            variant="transparent"
                            size="sm"
                            onClick={() => { setGoalPercentage(trafficGoal.percentage); setGoalPeriod(trafficGoal.period); setGoalModalOpen(true); }}
                            aria-label="Edit goal"
                            icon={(
                              <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
                                <g fill="currentColor">
                                  <path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" />
                                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" />
                                </g>
                              </svg>
                            )}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <div style={{ fontWeight: 400 }}>Current progress</div>
                        <div>{goalStats?.progressPct ?? 0}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <div style={{ fontWeight: 400 }}>Days remaining</div>
                        <div>{goalStats?.daysRemaining ?? '-'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <div style={{ fontWeight: 400 }}>Avg. clicks to meet goal</div>
                        <div>{goalStats?.avgNeeded ?? 0}/day</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button variant="link" size="sm" onClick={() => setGoalModalOpen(true)} icon={
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />
                        </svg>
                      } style={{ padding: 0, color: '#3F3F47' }}>
                        Set up traffic goal
                      </Button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <span style={{ fontWeight: 400 }}>Current progress</span>
                        <span>-</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <span style={{ fontWeight: 400 }}>Days remaining</span>
                        <span>-</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <span style={{ fontWeight: 400 }}>Avg. clicks to meet goal</span>
                        <span>-</span>
                      </div>
                    </>
                  )}
                  </div>
                </div>
              </SentryPanel>

              <section className="performance-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                <SummaryCard label="All Keywords" value={String(computed.keywordSummary.allKeywords)} />
                <SummaryCard label="Top 3" value={String(computed.keywordSummary.top3)} direction={computed.keywordSummary.top3Direction} />
                <SummaryCard label="Position 4-10" value={String(computed.keywordSummary.pos4to10)} direction={computed.keywordSummary.pos4to10Direction} />
                <SummaryCard label="Position 11-20" value={String(computed.keywordSummary.pos11to20)} direction={computed.keywordSummary.pos11to20Direction} />
              </section>

              <SentryPanel noPadding>
                <SentryPanelHeader
                  title={(
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>Pages</span>
                      <span style={{ fontSize: 16, fontWeight: 400, color: '#52525C' }}>with</span>
                      <TableSortButton value={pageSortOrder} onClick={() => setPageSortOrder((current) => (current === 'highest' ? 'lowest' : 'highest'))} />
                      <TableSortButton
                        value={pageSortMetric === 'impressions' ? 'impr.' : pageSortMetric}
                        onClick={() => {
                          const order: SortMetric[] = ['clicks', 'impressions', 'ctr', 'position'];
                          const currentIndex = order.indexOf(pageSortMetric);
                          setPageSortMetric(order[(currentIndex + 1) % order.length]);
                        }}
                      />
                    </div>
                  )}
                />

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ minWidth: 200, width: 496, padding: '12px 16px 12px 24px', textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Page</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Clicks</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Impr.</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>CTR</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPageRows.map((row, index) => (
                        <tr key={row.key} style={{ borderBottom: index < sortedPageRows.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
                          <td style={{ maxWidth: 496, padding: '14px 16px 14px 24px', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)', verticalAlign: 'middle' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.label}>
                              <a href={row.href} target="_blank" rel="noreferrer" style={{ color: '#18181B', textDecoration: 'none' }}>{row.label}</a>
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={compactNumber(row.clicks)} direction={row.clickDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={compactNumber(row.impressions)} direction={row.impressionDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={formatPercent(row.ctr)} direction={row.ctrDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={row.position.toFixed(1).replace('.0', '')} direction={row.positionDir} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SentryPanel>

              <SentryPanel noPadding>
                <SentryPanelHeader
                  title={(
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>Keywords</span>
                      <span style={{ fontSize: 16, fontWeight: 400, color: '#52525C' }}>with</span>
                      <TableSortButton value={keywordSortOrder} onClick={() => setKeywordSortOrder((current) => (current === 'highest' ? 'lowest' : 'highest'))} />
                      <TableSortButton
                        value={keywordSortMetric === 'impressions' ? 'impr.' : keywordSortMetric}
                        onClick={() => {
                          const order: SortMetric[] = ['clicks', 'impressions', 'ctr', 'position'];
                          const currentIndex = order.indexOf(keywordSortMetric);
                          setKeywordSortMetric(order[(currentIndex + 1) % order.length]);
                        }}
                      />
                    </div>
                  )}
                />

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ minWidth: 200, width: 496, padding: '12px 16px 12px 24px', textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Keyword</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Clicks</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Impr.</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>CTR</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKeywordRows.map((row, index) => (
                        <tr key={row.key} style={{ borderBottom: index < sortedKeywordRows.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
                          <td style={{ maxWidth: 496, padding: '14px 16px 14px 24px', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)', verticalAlign: 'middle' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.label}>
                              {row.label}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={compactNumber(row.clicks)} direction={row.clickDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={compactNumber(row.impressions)} direction={row.impressionDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={formatPercent(row.ctr)} direction={row.ctrDir} />
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 14, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>
                            <DeltaValue value={row.position.toFixed(1).replace('.0', '')} direction={row.positionDir} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SentryPanel>
          </>
        )}

        {goalModalOpen ? (
          <TrafficGoalModal
            onClose={() => setGoalModalOpen(false)}
            goalPercentage={goalPercentage}
            onGoalPercentageChange={setGoalPercentage}
            goalPeriod={goalPeriod}
            onGoalPeriodChange={setGoalPeriod}
            currentClicks={currentClicks}
            trafficGoal={trafficGoal}
            onDeleteGoal={handleDeleteGoal}
            onSaveGoal={handleSaveGoal}
            goalSaving={goalSaving}
          />
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

          @media (min-width: 1024px) {
            .performance-goal-bar {
              display: flex !important;
              align-items: center;
              justify-content: space-between;
            }
          }

          @media (max-width: 1100px) {
            .performance-metrics-grid,
            .performance-summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 900px) {
            .performance-filters {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            }

            .perf-filter-button {
              width: 100%;
              justify-content: space-between;
            }
          }

          @media (max-width: 720px) {
            .performance-metrics-grid,
            .performance-summary-grid,
            .performance-goal-bar,
            .performance-filters {
              grid-template-columns: minmax(0, 1fr) !important;
            }

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
