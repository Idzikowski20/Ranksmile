import {
  DATE_PRESETS,
  type CalendarCell,
  type DatePreset,
  type DateRangeValue,
  type Delta,
  type KeywordMode,
  type KeywordRule,
} from './types';

export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getDelta(current: number, previous: number, higherIsBetter = true): Delta {
  if (current === previous) return 'neutral';
  if ((current > previous) === higherIsBetter) return 'up';
  return 'down';
}

export function getChangePercent(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function buildChartTicks(maxValue: number) {
  const safeMax = Math.max(maxValue, 1);
  const roundedMax = Math.ceil(safeMax / 3) * 3;
  return [0, roundedMax / 3, (roundedMax / 3) * 2, roundedMax];
}

export function padDate(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

export function getToday() {
  const now = new Date();
  return startOfDay(now);
}

export function getPresetRange(preset: DatePreset, existingRange?: DateRangeValue): DateRangeValue {
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

export function getRangeLength(range: DateRangeValue) {
  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function getRangeLabel(preset: DatePreset, range: DateRangeValue) {
  if (preset !== 'custom') {
    return DATE_PRESETS.find((item) => item.value === preset)?.label || 'Last 90 days';
  }

  const start = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function getCalendarCells(month: Date, selectedRange: DateRangeValue) {
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

export function normalizePath(value?: string) {
  if (!value) return '/';
  try {
    return new URL(value.startsWith('http') ? value : `https://placeholder.test${value.startsWith('/') ? value : `/${value}`}`).pathname || '/';
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getDomainTokens(domain: string) {
  const base = domain.split('.')[0] || '';
  return base
    .split(/[^a-zA-Z0-9]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function buildKeywordQuery(mode: KeywordMode, customRule: KeywordRule | null, brandTerms: string[]) {
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
