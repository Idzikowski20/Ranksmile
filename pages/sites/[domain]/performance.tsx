/* eslint-disable max-len, no-nested-ternary */
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';
import countries from '../../../utils/countries';

type MetricKey = 'clicks' | 'impressions' | 'ctr' | 'position';
type SortMetric = 'clicks' | 'impressions' | 'ctr' | 'position';
type SortOrder = 'highest' | 'lowest';
type Delta = 'up' | 'down' | 'neutral';
type FilterId = 'date' | 'location' | 'device' | 'page' | 'keyword';
type DatePreset = '30' | '60' | '90' | '480' | 'custom';
type DeviceFilter = 'all' | 'desktop' | 'mobile' | 'tablet';
type PageFilter = 'all' | 'optimized' | 'tracked' | 'custom';
type KeywordMode = 'all' | 'custom' | 'nonBranded' | 'branded';
type KeywordOperator = 'contains' | 'equals' | 'notContains';

type DateRangeValue = {
  start: string;
  end: string;
};

type KeywordRule = {
  operator: KeywordOperator;
  value: string;
};

type TableRow = {
  key: string;
  label: string;
  href?: string;
  path?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clickDir: Delta;
  impressionDir: Delta;
  ctrDir: Delta;
  positionDir: Delta;
};

type ChartPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type AuditItemData = {
  url: string;
  contentScore: number;
};

type AuditResponseData = {
  items: AuditItemData[];
};

type CalendarCell = {
  value: string;
  label: number;
  outside: boolean;
  disabled: boolean;
  today: boolean;
};

type GoalPeriod = 'MONTH' | 'QUARTER';

type TrafficGoal = {
  percentage: number;
  period: GoalPeriod;
  startDate: string;
  baseClicks: number;
};

const DATE_PRESETS: Array<{ value: DatePreset; label: string; days?: number; months?: number }> = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '60', label: 'Last 60 days', days: 60 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: '480', label: 'Last 16 months', months: 16 },
];

const DEVICE_OPTIONS: Array<{ value: DeviceFilter; label: string }> = [
  { value: 'all', label: 'All devices' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
];

const PAGE_OPTIONS: Array<{ value: PageFilter; label: string }> = [
  { value: 'all', label: 'All pages' },
  { value: 'optimized', label: 'Optimized with Content Audit' },
  { value: 'tracked', label: 'Tracked with Content Audit' },
  { value: 'custom', label: 'Custom' },
];

const KEYWORD_OPERATOR_OPTIONS: Array<{ value: KeywordOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Exact match' },
  { value: 'notContains', label: 'Does not contain' },
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DROPDOWN_SHADOW = '0px 18px 40px 0px rgba(17, 24, 39, 0.14), 0px 8px 18px 0px rgba(17, 24, 39, 0.09), 0px 2px 6px 0px rgba(17, 24, 39, 0.06)';

import { slugToDomain } from '../../../utils/slugToDomain';

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDelta(current: number, previous: number, higherIsBetter = true): Delta {
  if (current === previous) return 'neutral';
  if ((current > previous) === higherIsBetter) return 'up';
  return 'down';
}

function getChangePercent(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

const ROW_COLUMNS = [60, 50, 40, 40] as const;

function TableSkeleton({ headerLabelWidth }: { headerLabelWidth: number }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24, border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 24 }}>
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

function buildChartTicks(maxValue: number) {
  const safeMax = Math.max(maxValue, 1);
  const roundedMax = Math.ceil(safeMax / 3) * 3;
  return [0, roundedMax / 3, (roundedMax / 3) * 2, roundedMax];
}

function padDate(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function getToday() {
  const now = new Date();
  return startOfDay(now);
}

function getPresetRange(preset: DatePreset, existingRange?: DateRangeValue): DateRangeValue {
  const today = getToday();
  const config = DATE_PRESETS.find((item) => item.value === preset);

  if (!config) {
    return existingRange || { start: formatDateKey(today), end: formatDateKey(today) };
  }

  if (config.days) {
    return {
      start: formatDateKey(addDays(today, -(config.days - 1))),
      end: formatDateKey(today),
    };
  }

  const start = new Date(today.getFullYear(), today.getMonth() - (config.months || 0), today.getDate(), 12);
  return {
    start: formatDateKey(start),
    end: formatDateKey(today),
  };
}

function getRangeLength(range: DateRangeValue) {
  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function getRangeLabel(preset: DatePreset, range: DateRangeValue) {
  if (preset !== 'custom') {
    return DATE_PRESETS.find((item) => item.value === preset)?.label || 'Last 90 days';
  }

  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getCalendarCells(month: Date, selectedRange: DateRangeValue) {
  const today = getToday();
  const firstDay = startOfMonth(month);
  const startWeekDay = firstDay.getDay();
  const firstCellDate = addDays(firstDay, -startWeekDay);
  const selectedStart = parseDateKey(selectedRange.start);
  const selectedEnd = parseDateKey(selectedRange.end);
  const cells: CalendarCell[][] = [];

  for (let week = 0; week < 6; week += 1) {
    const row: CalendarCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const currentDate = addDays(firstCellDate, week * 7 + day);
      row.push({
        value: formatDateKey(currentDate),
        label: currentDate.getDate(),
        outside: currentDate.getMonth() !== month.getMonth(),
        disabled: currentDate.getTime() > today.getTime(),
        today: formatDateKey(currentDate) === formatDateKey(today),
      });
    }
    cells.push(row);
  }

  return {
    cells,
    isSelected: (value: string) => {
      const current = parseDateKey(value).getTime();
      return current >= selectedStart.getTime() && current <= selectedEnd.getTime();
    },
    isRangeStart: (value: string) => value === selectedRange.start,
    isRangeEnd: (value: string) => value === selectedRange.end,
  };
}

function normalizePath(value?: string) {
  if (!value) return '/';
  try {
    return new URL(value.startsWith('http') ? value : `https://placeholder.test${value.startsWith('/') ? value : `/${value}`}`).pathname || '/';
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDomainTokens(domain: string) {
  const base = domain.split('.')[0] || '';
  return base
    .split(/[^a-zA-Z0-9]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildKeywordQuery(mode: KeywordMode, customRule: KeywordRule | null, brandTerms: string[]) {
  if (mode === 'custom' && customRule?.value.trim()) {
    return {
      operator: customRule.operator,
      value: customRule.value.trim(),
    };
  }

  if ((mode === 'branded' || mode === 'nonBranded') && brandTerms.length) {
    return {
      operator: mode === 'branded' ? 'includingRegex' : 'excludingRegex',
      value: brandTerms.map((item) => escapeRegex(item)).join('|'),
    };
  }

  return null;
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
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

function FilterButton({
  label,
  icon,
  active = false,
  open = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  open?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="perf-filter-button"
      style={{
        display: 'inline-flex',
        minWidth: 55,
        alignItems: 'center',
        gap: 8,
        borderRadius: 9999,
        border: active ? '1px solid #09090B' : '1px solid #D4D4D8',
        boxShadow: active ? 'inset 0 0 0 1px #09090B' : 'none',
        background: '#FFFFFF',
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 600,
        color: active ? '#09090B' : '#18181B',
        fontFamily: 'var(--font-family-primary)',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
      }}
      aria-expanded={open}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit' }}>{icon}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>
        <ChevronDown size={18} />
      </span>
    </button>
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
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 9999,
        border: '1px solid #D4D4D8',
        background: 'transparent',
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 600,
        color: '#18181B',
        fontFamily: 'var(--font-family-primary)',
        cursor: 'pointer',
      }}
    >
      <span style={{ textTransform: 'lowercase' }}>{value}</span>
      <ChevronDown size={18} />
    </button>
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
      style={{
        border: '1px solid #F4F4F5',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: gradientColor
          ? `linear-gradient(to right, color-mix(in oklab, ${gradientColor} 5%, transparent), transparent)`
          : '#FFFFFF',
        boxShadow: '0px 1px 2px 0px #1A1D280F',
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
      <button
        type="button"
        onClick={onToggle}
        style={{ display: 'inline-flex', padding: 8, borderRadius: 8, background: accentBg, color: accentColor, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: muted ? 0.5 : 1, transition: 'opacity 150ms ease' }}
      >
        <EyeIcon muted={muted} />
      </button>
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
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 10, borderRadius: 12, background: '#F8F8F9', padding: 16 }}>
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

function LineChart({ data, visibleMetrics }: { data: ChartPoint[]; visibleMetrics: { clicks: boolean; impressions: boolean; ctr: boolean; position: boolean } }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverState, setHoverState] = useState<{ index: number; lineX: number; cursorPx: number } | null>(null);

  if (!data.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#52525C', fontSize: 14 }}>
        No chart data for this filter.
      </div>
    );
  }

  const width = 1230;
  const height = 368;
  const leftPad = 45;
  const topPad = 10;
  const svgWidth = width + 90;
  const svgHeight = height + 64;
  const innerWidth = width;
  const innerHeight = height;

  const maxClicks = Math.max(...data.map((item) => item.clicks), 1);
  const maxImpressions = Math.max(...data.map((item) => item.impressions), 1);
  const maxCtr = Math.max(...data.map((item) => item.ctr), 0.0001);
  const maxPosition = Math.max(...data.map((item) => item.position), 1);
  const clickTicks = buildChartTicks(maxClicks);
  const impressionTicks = buildChartTicks(maxImpressions);

  const getX = (index: number) => (index / Math.max(data.length - 1, 1)) * innerWidth;
  const getClicksY = (value: number) => innerHeight - (value / clickTicks[3]) * innerHeight;
  const getImpressionsY = (value: number) => innerHeight - (value / impressionTicks[3]) * innerHeight;
  const getCtrY = (value: number) => innerHeight - (value / maxCtr) * innerHeight;
  const getPositionY = (value: number) => (value / maxPosition) * innerHeight;

  const buildLinePath = (getY: (item: ChartPoint) => number) =>
    data.map((item, index) => `${index === 0 ? 'M' : 'L'}${getX(index).toFixed(3)},${getY(item).toFixed(3)}`).join('');

  const clickPath = buildLinePath((item) => getClicksY(item.clicks));
  const impressionPath = buildLinePath((item) => getImpressionsY(item.impressions));
  const ctrPath = buildLinePath((item) => getCtrY(item.ctr));
  const positionPath = buildLinePath((item) => getPositionY(item.position));

  const clickArea = `${clickPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const impressionArea = `${impressionPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const ctrArea = `${ctrPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;
  const positionArea = `${positionPath}L${getX(data.length - 1).toFixed(3)},${innerHeight}L0,${innerHeight}Z`;

  const labelStep = Math.max(1, Math.floor(data.length / 14));
  const xLabels = data.filter((_, index) => index % labelStep === 0).slice(0, 15);

  const formatAxisDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  };

  const formatTooltipDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const hoveredPoint = hoverState ? data[hoverState.index] : null;
  const hoveredPointX = hoverState ? getX(hoverState.index) : null;

  const handlePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const plotLeftPx = (leftPad / svgWidth) * rect.width;
    const plotWidthPx = (innerWidth / svgWidth) * rect.width;
    const cursorPx = Math.max(plotLeftPx, Math.min(event.clientX - rect.left, plotLeftPx + plotWidthPx));
    const relativePlotPx = cursorPx - plotLeftPx;
    const lineX = (relativePlotPx / plotWidthPx) * innerWidth;
    const nextIndex = Math.round((lineX / innerWidth) * Math.max(data.length - 1, 1));
    setHoverState({ index: nextIndex, lineX, cursorPx });
  };

  let tooltipStyle: { left: number; top: number } | undefined;
  if (hoverState && hoveredPoint) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const plotTopPx = (topPad / svgHeight) * rect.height;
      const plotHeightPx = (innerHeight / svgHeight) * rect.height;
      const yValues = [
        visibleMetrics.clicks ? getClicksY(hoveredPoint.clicks) : null,
        visibleMetrics.impressions ? getImpressionsY(hoveredPoint.impressions) : null,
        visibleMetrics.ctr ? getCtrY(hoveredPoint.ctr) : null,
        visibleMetrics.position ? getPositionY(hoveredPoint.position) : null,
      ].filter((v): v is number => v !== null);
      const minY = yValues.length > 0 ? Math.min(...yValues) : 0;
      const anchorYPx = plotTopPx + (Math.min(minY, innerHeight) / innerHeight) * plotHeightPx;
      const tooltipWidth = 220;
      const tooltipHeight = 160;
      const left = Math.max(12, Math.min(rect.width - tooltipWidth - 12, hoverState.cursorPx + 10));
      const top = Math.max(16, Math.min(rect.height - tooltipHeight - 12, anchorYPx - tooltipHeight - 12));
      tooltipStyle = { left, top };
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', height: 400, width: '100%' }}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setHoverState(null)}
    >
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
          <g transform={`translate(${leftPad},${topPad})`}>
            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return <line key={index} x1="0" x2={innerWidth} y1={y} y2={y} stroke="#F4F4F5" strokeWidth="1" />;
            })}

            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return (
                <text key={`left-${index}`} x="-10" y={y} textAnchor="end" dominantBaseline="middle" fill={visibleMetrics.clicks ? '#52525C' : '#C4C4C4'} fontSize="12" fontFamily="var(--font-family-primary)">
                  {compactNumber(clickTicks[index])}
                </text>
              );
            })}

            {[0, 1, 2, 3].map((index) => {
              const y = innerHeight - (innerHeight / 3) * index;
              return (
                <text key={`right-${index}`} x={innerWidth + 10} y={y} textAnchor="start" dominantBaseline="middle" fill={visibleMetrics.impressions ? '#52525C' : '#C4C4C4'} fontSize="12" fontFamily="var(--font-family-primary)">
                  {compactNumber(impressionTicks[index])}
                </text>
              );
            })}

            <defs>
              <linearGradient id="perf-clicks-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#BEDBFF" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#BEDBFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-impressions-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C5B8FE" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#C5B8FE" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-ctr-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#86EFAC" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-position-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FDBA74" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#FDBA74" stopOpacity="0" />
              </linearGradient>
            </defs>

            {visibleMetrics.clicks ? (
              <>
                <path d={clickArea} fill="url(#perf-clicks-gradient)" opacity="0.9" />
                <path d={clickPath} fill="none" stroke="#74A9FF" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.impressions ? (
              <>
                <path d={impressionArea} fill="url(#perf-impressions-gradient)" opacity="0.9" />
                <path d={impressionPath} fill="none" stroke="#8B73F6" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.ctr ? (
              <>
                <path d={ctrArea} fill="url(#perf-ctr-gradient)" opacity="0.9" />
                <path d={ctrPath} fill="none" stroke="#22C55E" strokeWidth="2.2" />
              </>
            ) : null}
            {visibleMetrics.position ? (
              <>
                <path d={positionArea} fill="url(#perf-position-gradient)" opacity="0.9" />
                <path d={positionPath} fill="none" stroke="#F97316" strokeWidth="2.2" />
              </>
            ) : null}

            {hoverState && hoveredPointX !== null && hoveredPoint ? (
              <>
                <line x1={hoverState.lineX} x2={hoverState.lineX} y1={0} y2={innerHeight} stroke="#D4D4D8" strokeWidth="1" strokeDasharray="6 6" />
                {visibleMetrics.clicks ? <circle cx={hoveredPointX} cy={getClicksY(hoveredPoint.clicks)} r="5.5" fill="#74A9FF" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.impressions ? <circle cx={hoveredPointX} cy={getImpressionsY(hoveredPoint.impressions)} r="5.5" fill="#8B73F6" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.ctr ? <circle cx={hoveredPointX} cy={getCtrY(hoveredPoint.ctr)} r="5.5" fill="#22C55E" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
                {visibleMetrics.position ? <circle cx={hoveredPointX} cy={getPositionY(hoveredPoint.position)} r="5.5" fill="#F97316" style={{ transition: 'cx 90ms linear, cy 90ms linear' }} /> : null}
              </>
            ) : null}

            {xLabels.map((item) => {
              const index = data.indexOf(item);
              const x = getX(index);
              return (
                <g key={`${item.date}-${index}`} transform={`translate(${x},${innerHeight})`}>
                  <line x1="0" x2="0" y1="0" y2="14" stroke="#E4E4E7" strokeWidth="1" />
                  <text x="4" y="16" textAnchor="start" dominantBaseline="hanging" fill="#52525C" fontSize="11" fontFamily="var(--font-family-primary)">
                    {formatAxisDate(item.date)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {hoveredPoint && tooltipStyle ? (
          <div
            style={{
              position: 'absolute',
              zIndex: 150,
              display: 'inline-flex',
              maxWidth: '14rem',
              flexDirection: 'column',
              borderRadius: 4,
              background: '#18181B',
              color: '#FFFFFF',
              padding: '4px 8px',
              textAlign: 'left',
              fontSize: '0.8125rem',
              lineHeight: '1rem',
              fontWeight: 400,
              boxShadow: '0px 8px 16px 0px #181a220a, 0px 2px 8px 0px #181a2205, 0px 1px 2px 0px #181a220f',
              pointerEvents: 'none',
              left: tooltipStyle.left,
              top: tooltipStyle.top,
              transition: 'left 90ms linear, top 90ms linear',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px', fontSize: '0.8125rem', lineHeight: '1rem' }}>
              <span style={{ marginBottom: 2 }}>{formatTooltipDate(hoveredPoint.date)}</span>
              {visibleMetrics.clicks ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#74A9FF', flexShrink: 0 }} />
                    <span>Clicks</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.clicks}</span>
                </div>
              ) : null}
              {visibleMetrics.impressions ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#8B73F6', flexShrink: 0 }} />
                    <span>Impressions</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.impressions}</span>
                </div>
              ) : null}
              {visibleMetrics.ctr ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#22C55E', flexShrink: 0 }} />
                    <span>Avg. CTR</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatPercent(hoveredPoint.ctr)}</span>
                </div>
              ) : null}
              {visibleMetrics.position ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#F97316', flexShrink: 0 }} />
                    <span>Avg. Position</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{hoveredPoint.position.toFixed(1)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
    </div>
  );
}

function GoalProjectionChart({ baseClicks, percentage, period }: { baseClicks: number; percentage: number; period: GoalPeriod }) {
  const months = 12;
  const rate = period === 'MONTH' ? percentage / 100 : (percentage / 100) / 3;
  const data = Array.from({ length: months }, (_, i) => ({
    value: Math.round(baseClicks * (1 + rate) ** i),
    label: new Date(new Date().getFullYear(), new Date().getMonth() + i, 1).toLocaleDateString('en-US', { month: 'short' }),
  }));

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 500;
  const chartHeight = 160;
  const barWidth = Math.floor(chartWidth / months) - 4;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={chartWidth + 40} height={chartHeight + 32} style={{ display: 'block' }}>
        <g transform="translate(30, 10)">
          {[0, 1, 2, 3].map((i) => {
            const y = chartHeight - (chartHeight / 3) * i;
            return (
              <g key={i}>
                <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#E4E4E7" strokeWidth={1} />
                <text x={-4} y={y} textAnchor="end" dominantBaseline="middle" fill="#52525C" fontSize={10} fontFamily="var(--font-family-primary)">
                  {compactNumber(Math.round((maxVal / 3) * i))}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x = i * (chartWidth / months);
            const barH = maxVal > 0 ? (d.value / maxVal) * chartHeight : 0;
            const isFirst = i === 0;
            return (
              <g key={i}>
                <rect
                  x={x + 2}
                  y={chartHeight - barH}
                  width={barWidth}
                  height={barH}
                  fill={isFirst ? '#E4E4E7' : '#8B73F6'}
                  rx={3}
                />
                {i % 3 === 0 ? (
                  <text x={x + barWidth / 2 + 2} y={chartHeight + 14} textAnchor="middle" fill="#52525C" fontSize={10} fontFamily="var(--font-family-primary)">
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

const PerformancePage: NextPage = () => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';

  const [openFilter, setOpenFilter] = useState<FilterId | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('30');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeValue>(() => getPresetRange('30'));
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(parseDateKey(getPresetRange('30').start)));
  const [pendingCalendarStart, setPendingCalendarStart] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
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

  const filterRefs = {
    date: useRef<HTMLDivElement | null>(null),
    location: useRef<HTMLDivElement | null>(null),
    device: useRef<HTMLDivElement | null>(null),
    page: useRef<HTMLDivElement | null>(null),
    keyword: useRef<HTMLDivElement | null>(null),
  };

  useEffect(() => {
    if (!openFilter) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const activeRef = filterRefs[openFilter].current;
      if (activeRef && !activeRef.contains(target)) {
        setOpenFilter(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFilter(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openFilter]);

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

  const filteredLocationOptions = useMemo(() => {
    const query = locationSearch.trim().toLowerCase();
    if (!query) return availableLocations;
    return availableLocations.filter((item) => item.label.toLowerCase().includes(query));
  }, [availableLocations, locationSearch]);

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
        gradientColor: '#8B73F6',
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

  const dateMonthOne = calendarMonth;
  const dateMonthTwo = addMonths(calendarMonth, 1);
  const monthOneCalendar = getCalendarCells(dateMonthOne, selectedDateRange);
  const monthTwoCalendar = getCalendarCells(dateMonthTwo, selectedDateRange);
  const yearOptions = Array.from(new Set([
    getToday().getFullYear() - 1,
    getToday().getFullYear(),
  ])).sort((a, b) => a - b);

  const applyPreset = (preset: DatePreset) => {
    const range = getPresetRange(preset, selectedDateRange);
    setDatePreset(preset);
    setSelectedDateRange(range);
    setPendingCalendarStart(null);
    setCalendarMonth(startOfMonth(parseDateKey(range.start)));
    setOpenFilter(null);
  };

  const handleCustomDateClick = (value: string) => {
    const clickedDate = parseDateKey(value);
    if (clickedDate.getTime() > getToday().getTime()) return;

    setDatePreset('custom');

    if (!pendingCalendarStart) {
      setPendingCalendarStart(value);
      setSelectedDateRange({ start: value, end: value });
      return;
    }

    const start = pendingCalendarStart <= value ? pendingCalendarStart : value;
    const end = pendingCalendarStart <= value ? value : pendingCalendarStart;
    setSelectedDateRange({ start, end });
    setPendingCalendarStart(null);
    setOpenFilter(null);
  };

  const handleToday = () => {
    const today = getToday();
    if (datePreset === 'custom') {
      const length = getRangeLength(selectedDateRange);
      setSelectedDateRange({
        start: formatDateKey(addDays(today, -(length - 1))),
        end: formatDateKey(today),
      });
      setCalendarMonth(startOfMonth(addDays(today, -(length - 1))));
      return;
    }

    applyPreset(datePreset);
  };

  const openKeywordModal = (mode: 'custom' | 'brand') => {
    setKeywordModalMode(mode);
    if (mode === 'custom') {
      setKeywordOperatorDraft(customKeywordRule?.operator || 'contains');
      setKeywordValueDraft(customKeywordRule?.value || '');
    } else {
      setBrandKeywordDraft(brandTerms.join(', '));
    }
    setOpenFilter(null);
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
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontSize: 14,
        fontWeight: 600,
        color: '#3F3F47',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <FeedbackIcon />
      Leave feedback
    </button>
  );

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{`Performance - ${domain} - SerpBear`}</title>
      </Head>

      <DomainSubLayout domain={domain} slug={slug || ''} section="Performance" heading="Performance" actions={feedbackAction} contentMaxWidth="unset">
        {isLoading && !scData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 16, animation: 'skeletonPulse 1.5s ease-in-out infinite' }}>
            {/* Filter bar skeletons */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 24, borderRadius: 12, background: '#F8F8F9', boxShadow: 'inset 0 0 0 1px #E4E4E7' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {[120, 140, 100, 90, 130].map((w, i) => (
                    <div key={i} style={{ height: 36, width: w, borderRadius: 9999, background: '#E8E8ED' }} />
                  ))}
                </div>
              </div>

              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, background: '#FFFFFF', minHeight: 110, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ width: 60, height: 14, borderRadius: 6, background: '#E8E8ED' }} />
                    <div style={{ width: 80, height: 24, borderRadius: 6, background: '#E0E0E6' }} />
                    <div style={{ width: 100, height: 12, borderRadius: 6, background: '#E8E8ED' }} />
                  </div>
                ))}
              </div>

              {/* Chart skeleton */}
              <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 24 }}>
                <div style={{ height: 220, borderRadius: 10, background: '#E8E8ED' }} />
              </div>
            </section>

            {/* Table 1: Pages skeleton */}
            <TableSkeleton headerLabelWidth={80} />

            {/* Table 2: Keywords skeleton */}
            <TableSkeleton headerLabelWidth={90} />
          </div>
        ) : scData?.error ? (
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid #FECACA', background: '#FFF1F2', color: '#B91C1C', fontSize: 14, fontFamily: 'var(--font-family-primary)' }}>
            {scData.error}
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', flex: 1, overflow: 'auto', borderRadius: 12, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: 32, paddingBottom: 16 }}>
              <section
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                  borderRadius: 12,
                  background: '#F8F8F9',
                  boxShadow: 'inset 0 0 0 1px #E4E4E7',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 16 }}>
                  <div className="performance-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <div ref={filterRefs.date} style={{ position: 'relative' }}>
                      <FilterButton
                        active
                        open={openFilter === 'date'}
                        label={getRangeLabel(datePreset, selectedDateRange)}
                        icon={<CalendarIcon />}
                        onClick={() => setOpenFilter((current) => (current === 'date' ? null : 'date'))}
                      />
                      {openFilter === 'date' ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 'calc(100% + 12px)',
                            width: 'min(580px, calc(100vw - 2rem))',
                            zIndex: 150,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            borderRadius: 16,
                            background: '#FFFFFF',
                            padding: 20,
                            boxShadow: DROPDOWN_SHADOW,
                            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {DATE_PRESETS.map((preset) => {
                                const selected = datePreset === preset.value;
                                return (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => applyPreset(preset.value)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: 'none',
                                      borderRadius: 9999,
                                      padding: '8px 16px',
                                      background: selected ? '#09090B' : '#F4F4F5',
                                      color: selected ? '#FFFFFF' : '#3F3F47',
                                      fontSize: 14,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={handleToday}
                              style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 14, color: '#3F3F47', cursor: 'pointer' }}
                            >
                              Today
                            </button>
                          </div>

                          <div
                            className="performance-calendar-months"
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 16,
                              flexWrap: 'nowrap',
                            }}
                          >
                            <nav style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B' }}
                              >
                                <ChevronLeft />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B' }}
                              >
                                <ChevronRight />
                              </button>
                            </nav>

                            {[dateMonthOne, dateMonthTwo].map((monthDate, monthIndex) => {
                              const monthData = monthIndex === 0 ? monthOneCalendar : monthTwoCalendar;
                              return (
                                <div
                                  key={monthDate.toISOString()}
                                  className="performance-calendar-month"
                                  style={{
                                    display: 'flex',
                                    minWidth: 0,
                                    flex: '1 1 0',
                                    flexDirection: 'column',
                                    gap: 14,
                                  }}
                                >
                                  <div style={{ display: 'flex', height: 44, alignItems: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                                      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 18, fontWeight: 700, color: '#18181B' }}>
                                        <select
                                          value={monthDate.getMonth()}
                                          onChange={(event) => {
                                            const nextMonth = Number(event.target.value);
                                            const nextDate = new Date(monthDate.getFullYear(), nextMonth, 1, 12);
                                            if (monthIndex === 0) setCalendarMonth(nextDate);
                                            else setCalendarMonth(addMonths(nextDate, -1));
                                          }}
                                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                        >
                                          {MONTH_LABELS.map((label, index) => (
                                            <option key={label} value={index}>
                                              {label}
                                            </option>
                                          ))}
                                        </select>
                                        <span>{MONTH_LABELS[monthDate.getMonth()]}</span>
                                        <ChevronDown size={18} />
                                      </label>
                                      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 18, fontWeight: 700, color: '#18181B' }}>
                                        <select
                                          value={monthDate.getFullYear()}
                                          onChange={(event) => {
                                            const nextYear = Number(event.target.value);
                                            const nextDate = new Date(nextYear, monthDate.getMonth(), 1, 12);
                                            if (monthIndex === 0) setCalendarMonth(nextDate);
                                            else setCalendarMonth(addMonths(nextDate, -1));
                                          }}
                                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                        >
                                          {yearOptions.map((year) => (
                                            <option key={year} value={year}>
                                              {year}
                                            </option>
                                          ))}
                                        </select>
                                        <span>{monthDate.getFullYear()}</span>
                                        <ChevronDown size={18} />
                                      </label>
                                    </div>
                                  </div>

                                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <thead>
                                      <tr>
                                        {WEEKDAY_LABELS.map((label) => (
                                          <th key={label} style={{ width: '14.285%', paddingBottom: 8, textAlign: 'center', fontSize: 14, fontWeight: 500, color: '#52525C' }}>
                                            {label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {monthData.cells.map((week, weekIndex) => (
                                        <tr key={`${monthDate.toISOString()}-${weekIndex}`}>
                                          {week.map((cell) => {
                                            const selected = monthData.isSelected(cell.value);
                                            const isStart = monthData.isRangeStart(cell.value);
                                            const isEnd = monthData.isRangeEnd(cell.value);
                                            const activeRange = selected && !isStart && !isEnd;
                                            return (
                                              <td
                                                key={cell.value}
                                                style={{
                                                  width: '14.285%',
                                                  height: 38,
                                                  textAlign: 'center',
                                                  background: activeRange ? '#E8E8ED' : 'transparent',
                                                  opacity: cell.outside ? 0.65 : 1,
                                                }}
                                              >
                                                <button
                                                  type="button"
                                                  disabled={cell.disabled}
                                                  onClick={() => handleCustomDateClick(cell.value)}
                                                  style={{
                                                    display: 'inline-flex',
                                                    width: 36,
                                                    height: 36,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: 'none',
                                                    borderRadius: isStart || isEnd ? '9999px' : 0,
                                                    background: isStart || isEnd ? '#18181B' : activeRange ? 'transparent' : 'transparent',
                                                    color: isStart || isEnd ? '#FFFFFF' : cell.today ? '#3F3F47' : '#18181B',
                                                    cursor: cell.disabled ? 'not-allowed' : 'pointer',
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    opacity: cell.disabled ? 0.3 : 1,
                                                    transition: 'all 150ms ease',
                                                  }}
                                                >
                                                  {cell.label}
                                                </button>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div ref={filterRefs.location} style={{ position: 'relative' }}>
                      <FilterButton
                        label={selectedLocationLabel}
                        icon={<LocationIcon />}
                        open={openFilter === 'location'}
                        onClick={() => setOpenFilter((current) => (current === 'location' ? null : 'location'))}
                      />
                      {openFilter === 'location' ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 'calc(100% + 12px)',
                            zIndex: 150,
                            display: 'flex',
                            minWidth: 300,
                            flexDirection: 'column',
                            borderRadius: 12,
                            background: '#FFFFFF',
                            padding: '6px 0',
                            boxShadow: DROPDOWN_SHADOW,
                            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <div style={{ padding: '4px 8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #D4D4D8', borderRadius: 10, padding: '0 8px', boxShadow: '0px 1px 2px 0px #1a1d280f' }}>
                              <input
                                type="text"
                                value={locationSearch}
                                onChange={(event) => setLocationSearch(event.target.value)}
                                placeholder="Search..."
                                style={{
                                  width: '100%',
                                  height: 38,
                                  border: 'none',
                                  background: 'transparent',
                                  outline: 'none',
                                  fontSize: 14,
                                  color: '#18181B',
                                  fontFamily: 'var(--font-family-primary)',
                                }}
                              />
                            </div>
                          </div>
                          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                            {filteredLocationOptions.map((item) => (
                              <button
                                key={item.code}
                                type="button"
                                onClick={() => {
                                  setLocationCode(item.code);
                                  setLocationSearch('');
                                  setOpenFilter(null);
                                }}
                                style={{
                                  display: 'flex',
                                  width: 'calc(100% - 12px)',
                                  alignItems: 'center',
                                  gap: 10,
                                  margin: '0 6px',
                                  border: 'none',
                                  borderRadius: 8,
                                  background: locationCode === item.code ? '#F4F4F5' : 'transparent',
                                  padding: '10px 16px',
                                  fontSize: 14,
                                  color: '#2F2F34',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                {item.code !== 'ALL' ? (
                                  <img
                                    src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${item.code.toLowerCase()}.svg`}
                                    alt={`${item.code} flag`}
                                    style={{ display: 'block', width: 16, height: 12, boxShadow: 'rgba(0, 0, 0, 0.5) 0px 0px 1px 0px' }}
                                  />
                                ) : null}
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                                {locationCode === item.code ? (
                                  <span style={{ marginLeft: 'auto', color: '#52525C', display: 'inline-flex' }}>
                                    <CheckIcon />
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div ref={filterRefs.device} style={{ position: 'relative' }}>
                      <FilterButton
                        label={selectedDeviceLabel}
                        icon={<DeviceIcon />}
                        open={openFilter === 'device'}
                        onClick={() => setOpenFilter((current) => (current === 'device' ? null : 'device'))}
                      />
                      {openFilter === 'device' ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 'calc(100% + 12px)',
                            zIndex: 100,
                            display: 'flex',
                            minWidth: 240,
                            flexDirection: 'column',
                            borderRadius: 12,
                            background: '#FFFFFF',
                            padding: 6,
                            boxShadow: DROPDOWN_SHADOW,
                            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {DEVICE_OPTIONS.map((item) => {
                            let icon = null;
                            if (item.value === 'desktop') icon = <DesktopIcon />;
                            if (item.value === 'mobile') icon = <MobileIcon />;
                            if (item.value === 'tablet') icon = <TabletIcon />;

                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                  setDeviceFilter(item.value);
                                  setOpenFilter(null);
                                }}
                                style={{
                                  display: 'flex',
                                  minWidth: 220,
                                  alignItems: 'center',
                                  gap: 10,
                                  border: 'none',
                                  borderRadius: 8,
                                  background: deviceFilter === item.value ? '#F8F8F9' : 'transparent',
                                  padding: '10px 12px',
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: '#2F2F34',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                {icon}
                                <span>{item.label}</span>
                                {deviceFilter === item.value ? (
                                  <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
                                    <CheckIcon />
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div ref={filterRefs.page} style={{ position: 'relative' }}>
                      <FilterButton
                        label={selectedPageLabel}
                        icon={<PageIcon />}
                        open={openFilter === 'page'}
                        onClick={() => setOpenFilter((current) => (current === 'page' ? null : 'page'))}
                      />
                      {openFilter === 'page' ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 'calc(100% + 12px)',
                            zIndex: 100,
                            display: 'flex',
                            minWidth: 240,
                            flexDirection: 'column',
                            borderRadius: 12,
                            background: '#FFFFFF',
                            padding: 6,
                            boxShadow: DROPDOWN_SHADOW,
                            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {PAGE_OPTIONS.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => {
                                setPageFilter(item.value);
                                setOpenFilter(null);
                              }}
                              style={{
                                display: 'flex',
                                minWidth: 220,
                                alignItems: 'center',
                                gap: 10,
                                border: 'none',
                                borderRadius: 8,
                                background: pageFilter === item.value ? '#F8F8F9' : 'transparent',
                                padding: '10px 12px',
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#2F2F34',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <span>{item.label}</span>
                              {pageFilter === item.value ? (
                                <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
                                  <CheckIcon />
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div ref={filterRefs.keyword} style={{ position: 'relative' }}>
                      <FilterButton
                        label={selectedKeywordLabel}
                        icon={<KeywordIcon />}
                        open={openFilter === 'keyword'}
                        onClick={() => setOpenFilter((current) => (current === 'keyword' ? null : 'keyword'))}
                      />
                      {openFilter === 'keyword' ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 'calc(100% + 12px)',
                            zIndex: 100,
                            display: 'flex',
                            minWidth: 240,
                            flexDirection: 'column',
                            borderRadius: 12,
                            background: '#FFFFFF',
                            padding: 6,
                            boxShadow: DROPDOWN_SHADOW,
                            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setKeywordMode('all');
                              setOpenFilter(null);
                            }}
                            style={{
                              display: 'flex',
                              minWidth: 220,
                              alignItems: 'center',
                              gap: 10,
                              border: 'none',
                              borderRadius: 8,
                              background: keywordMode === 'all' ? '#F8F8F9' : 'transparent',
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 500,
                              color: '#2F2F34',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>All keywords</span>
                            {keywordMode === 'all' ? (
                              <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
                                <CheckIcon />
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => openKeywordModal('custom')}
                            style={{
                              display: 'flex',
                              minWidth: 220,
                              alignItems: 'center',
                              gap: 10,
                              border: 'none',
                              borderRadius: 8,
                              background: 'transparent',
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 500,
                              color: '#2F2F34',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>Custom Keyword</span>
                          </button>
                          <div style={{ margin: '6px 8px', minHeight: 1, background: '#F4F4F5' }} />
                          <button
                            type="button"
                            onClick={() => {
                              setKeywordMode('nonBranded');
                              setOpenFilter(null);
                            }}
                            style={{
                              display: 'flex',
                              minWidth: 220,
                              alignItems: 'center',
                              gap: 10,
                              border: 'none',
                              borderRadius: 8,
                              background: keywordMode === 'nonBranded' ? '#F8F8F9' : 'transparent',
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 500,
                              color: '#2F2F34',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>Non-Branded Keywords</span>
                            {keywordMode === 'nonBranded' ? (
                              <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
                                <CheckIcon />
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setKeywordMode('branded');
                              setOpenFilter(null);
                            }}
                            style={{
                              display: 'flex',
                              minWidth: 220,
                              alignItems: 'center',
                              gap: 10,
                              border: 'none',
                              borderRadius: 8,
                              background: keywordMode === 'branded' ? '#F8F8F9' : 'transparent',
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 500,
                              color: '#2F2F34',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>Branded Keywords</span>
                            <span style={{ marginLeft: 'auto', color: '#52525C' }}>{brandTerms.length}</span>
                          </button>
                          <div style={{ margin: '6px 8px', minHeight: 1, background: '#F4F4F5' }} />
                          <button
                            type="button"
                            onClick={() => openKeywordModal('brand')}
                            style={{
                              display: 'flex',
                              minWidth: 220,
                              alignItems: 'center',
                              gap: 10,
                              border: 'none',
                              borderRadius: 8,
                              background: 'transparent',
                              padding: '10px 12px',
                              fontSize: 14,
                              fontWeight: 500,
                              color: '#2F2F34',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <SettingsIcon />
                            <span>Manage Branded Keywords</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

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

                  <LineChart data={computed.chart} visibleMetrics={visibleMetrics} />
                </div>

                <div className="performance-goal-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, borderRadius: 12, padding: 24, color: '#3F3F47', fontFamily: 'var(--font-family-primary)', fontSize: 14 }}>
                  {trafficGoal ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        <div style={{ fontWeight: 400 }}>Goal</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Increase clicks by {trafficGoal.percentage}% each {trafficGoal.period === 'MONTH' ? 'month' : 'quarter'}</span>
                          <button
                            type="button"
                            onClick={() => { setGoalPercentage(trafficGoal.percentage); setGoalPeriod(trafficGoal.period); setGoalModalOpen(true); }}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#3F3F47', fontFamily: 'var(--font-family-primary)', fontSize: 14, fontWeight: 600, transition: 'color 150ms ease' }}
                          >
                            <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
                              <g fill="currentColor">
                                <path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" />
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" />
                              </g>
                            </svg>
                          </button>
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
                      <button
                        type="button"
                        onClick={() => setGoalModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: '#3F3F47', fontFamily: 'var(--font-family-primary)', fontSize: 14, padding: 0 }}
                      >
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
                          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />
                        </svg>
                        <span>Set up traffic goal</span>
                      </button>
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
              </section>

              <section className="performance-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                <SummaryCard label="All Keywords" value={String(computed.keywordSummary.allKeywords)} />
                <SummaryCard label="Top 3" value={String(computed.keywordSummary.top3)} direction={computed.keywordSummary.top3Direction} />
                <SummaryCard label="Position 4-10" value={String(computed.keywordSummary.pos4to10)} direction={computed.keywordSummary.pos4to10Direction} />
                <SummaryCard label="Position 11-20" value={String(computed.keywordSummary.pos11to20)} direction={computed.keywordSummary.pos11to20Direction} />
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 24, border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Pages</h3>
                  <span style={{ fontSize: 16, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>with</span>
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

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ minWidth: 200, width: 496, padding: '12px 16px 12px 0', textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Page</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Clicks</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Impr.</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>CTR</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPageRows.map((row, index) => (
                        <tr key={row.key} style={{ borderBottom: index < sortedPageRows.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
                          <td style={{ maxWidth: 496, padding: '14px 16px 14px 0', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)', verticalAlign: 'middle' }}>
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
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 24, border: '1px solid #E4E4E7', borderRadius: 12, background: '#FFFFFF', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Keywords</h3>
                  <span style={{ fontSize: 16, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>with</span>
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

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                        <th style={{ minWidth: 200, width: 496, padding: '12px 16px 12px 0', textAlign: 'left', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Keyword</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Clicks</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Impr.</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>CTR</th>
                        <th style={{ minWidth: 80, padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKeywordRows.map((row, index) => (
                        <tr key={row.key} style={{ borderBottom: index < sortedKeywordRows.length - 1 ? '1px solid #F4F4F5' : 'none' }}>
                          <td style={{ maxWidth: 496, padding: '14px 16px 14px 0', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)', verticalAlign: 'middle' }}>
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
              </section>
            </div>
          </div>
        )}

        {goalModalOpen ? (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 20 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setGoalModalOpen(false); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{ display: 'flex', width: 'min(600px, calc(100% - 2rem))', maxHeight: '85vh', flexDirection: 'column', overflow: 'auto', borderRadius: 12, background: '#FFFFFF', boxShadow: '0px 16px 32px 0px #181a2252, 0px 2px 4px 0px #181a2229, 0px 4px 4px 0px #00000014', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 24 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Create clicks goal</h2>
                <button type="button" onClick={() => setGoalModalOpen(false)} style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#18181B', cursor: 'pointer' }}>
                  <XIcon />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Configurator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 12, background: '#F8F8F9', padding: 16, flexWrap: 'wrap', fontSize: 14, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>
                  <span>Increase clicks by</span>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={goalPercentage}
                      onChange={(e) => setGoalPercentage(Math.max(1, Math.min(999, Number(e.target.value))))}
                      style={{ width: 64, height: 40, border: '1px solid #D4D4D8', borderRadius: 8, paddingLeft: 12, paddingRight: 24, fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#18181B', background: '#FFFFFF', boxShadow: '0px 1px 2px 0px #1a1d280f', outline: 'none' }}
                    />
                    <span style={{ position: 'absolute', right: 8, color: '#52525C', fontSize: 14, pointerEvents: 'none' }}>%</span>
                  </div>
                  <span>each</span>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <select
                      value={goalPeriod}
                      onChange={(e) => setGoalPeriod(e.target.value as GoalPeriod)}
                      style={{ height: 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: '0 32px 0 12px', fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#18181B', background: '#FFFFFF', boxShadow: '0px 1px 2px 0px #1a1d280f', cursor: 'pointer', outline: 'none', appearance: 'none' }}
                    >
                      <option value="MONTH">month</option>
                      <option value="QUARTER">quarter</option>
                    </select>
                    <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', display: 'inline-flex', color: '#52525C' }}><ChevronDown size={16} /></span>
                  </div>
                </div>

                {/* Projected growth chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Projected growth</h3>
                  <GoalProjectionChart
                    baseClicks={parseInt(String(currentClicks).replace(/[^0-9]/g, ''), 10) || 0}
                    percentage={goalPercentage}
                    period={goalPeriod}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid #F4F4F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 24 }}>
                  <div>
                    {trafficGoal ? (
                      <button
                        type="button"
                        onClick={handleDeleteGoal}
                        style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#FF6F77', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', padding: 0 }}
                      >
                        Delete goal
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" onClick={() => setGoalModalOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#3F3F47', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGoal}
                      disabled={goalSaving}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 10, background: '#2F2F34', padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#FFFFFF', cursor: goalSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-family-primary)', opacity: goalSaving ? 0.7 : 1 }}
                    >
                      {goalSaving ? 'Saving...' : 'Create goal'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {keywordModalMode ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)',
              padding: 20,
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeKeywordModal();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                display: 'flex',
                width: 'min(600px, calc(100% - 2rem))',
                maxHeight: '85vh',
                flexDirection: 'column',
                overflow: 'auto',
                borderRadius: 12,
                background: '#FFFFFF',
                color: '#18181B',
                boxShadow: '0px 16px 32px 0px #181a2252, 0px 2px 4px 0px #181a2229, 0px 4px 4px 0px #00000014, 0px 1px 1px 0px #0000000a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 24 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#18181B' }}>
                  {keywordModalMode === 'custom' ? 'Custom keyword' : 'Manage branded keywords'}
                </h2>
                <button
                  type="button"
                  onClick={closeKeywordModal}
                  style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#18181B', cursor: 'pointer' }}
                >
                  <XIcon />
                </button>
              </div>

              <div style={{ display: 'flex', padding: '0 24px 24px' }}>
                <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: 12 }}>
                  {keywordModalMode === 'custom' ? (
                    <div style={{ display: 'flex', width: '50%', minWidth: 180 }}>
                      <div style={{ display: 'flex', width: '100%', flexDirection: 'column', color: '#3F3F47' }}>
                        <label style={{ position: 'relative', display: 'inline-flex', width: '100%', alignItems: 'center', border: '1px solid #D4D4D8', borderRadius: 10, padding: '0 12px', boxShadow: '0px 1px 2px 0px #1a1d280f', height: 40, fontSize: 14, fontWeight: 500, color: '#18181B' }}>
                          <select
                            value={keywordOperatorDraft}
                            onChange={(event) => setKeywordOperatorDraft(event.target.value as KeywordOperator)}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                          >
                            {KEYWORD_OPERATOR_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <span style={{ display: 'flex', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {KEYWORD_OPERATOR_OPTIONS.find((item) => item.value === keywordOperatorDraft)?.label}
                          </span>
                          <span style={{ marginLeft: 'auto', display: 'inline-flex', color: '#52525C' }}>
                            <ChevronDown size={18} />
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
                    <label style={{ paddingBottom: 6, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>
                      {keywordModalMode === 'custom' ? 'Keyword' : 'Keywords'}
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={keywordModalMode === 'custom' ? keywordValueDraft : brandKeywordDraft}
                        onChange={(event) => {
                          if (keywordModalMode === 'custom') {
                            setKeywordValueDraft(event.target.value);
                            return;
                          }
                          setBrandKeywordDraft(event.target.value);
                        }}
                        placeholder={keywordModalMode === 'custom' ? '' : 'brand-1, brand-2'}
                        style={{
                          width: '100%',
                          minHeight: 40,
                          border: '1px solid #D4D4D8',
                          borderRadius: 10,
                          padding: '0 12px',
                          boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                          color: '#18181B',
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: 24 }}>
                <button
                  type="button"
                  onClick={closeKeywordModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRadius: 10,
                    background: '#F4F4F5',
                    padding: '10px 20px',
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#3F3F47',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={keywordModalMode === 'custom' ? !keywordValueDraft.trim() : !brandKeywordDraft.trim()}
                  onClick={handleKeywordModalSubmit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRadius: 10,
                    background: '#3F3F47',
                    padding: '10px 20px',
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: keywordModalMode === 'custom' ? (keywordValueDraft.trim() ? 'pointer' : 'not-allowed') : (brandKeywordDraft.trim() ? 'pointer' : 'not-allowed'),
                    opacity: keywordModalMode === 'custom' ? (keywordValueDraft.trim() ? 1 : 0.6) : (brandKeywordDraft.trim() ? 1 : 0.6),
                  }}
                >
                  Choose
                </button>
              </div>
            </div>
          </div>
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
