export type MetricKey = 'clicks' | 'impressions' | 'ctr' | 'position';
export type SortMetric = 'clicks' | 'impressions' | 'ctr' | 'position';
export type SortOrder = 'highest' | 'lowest';
export type Delta = 'up' | 'down' | 'neutral';
export type DatePreset = '30' | '60' | '90' | '480' | 'custom';
export type DeviceFilter = 'all' | 'desktop' | 'mobile' | 'tablet';
export type PageFilter = 'all' | 'optimized' | 'tracked' | 'custom';
export type KeywordMode = 'all' | 'custom' | 'nonBranded' | 'branded';
export type KeywordOperator = 'contains' | 'equals' | 'notContains';

export type DateRangeValue = {
  start: string;
  end: string;
};

export type KeywordRule = {
  operator: KeywordOperator;
  value: string;
};

export type TableRow = {
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

export type ChartPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type AuditItemData = {
  url: string;
  contentScore: number;
};

export type AuditResponseData = {
  items: AuditItemData[];
};

export type CalendarCell = {
  value: string;
  label: number;
  outside: boolean;
  disabled: boolean;
  today: boolean;
};

export type GoalPeriod = 'MONTH' | 'QUARTER';

export type TrafficGoal = {
  percentage: number;
  period: GoalPeriod;
  startDate: string;
  baseClicks: number;
};

export const DATE_PRESETS: Array<{ value: DatePreset; label: string; days?: number; months?: number }> = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '60', label: 'Last 60 days', days: 60 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: '480', label: 'Last 16 months', months: 16 },
];

export const DEVICE_OPTIONS: Array<{ value: DeviceFilter; label: string }> = [
  { value: 'all', label: 'All devices' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
];

export const PAGE_OPTIONS: Array<{ value: PageFilter; label: string }> = [
  { value: 'all', label: 'All pages' },
  { value: 'optimized', label: 'Optimized with Content Audit' },
  { value: 'tracked', label: 'Tracked with Content Audit' },
  { value: 'custom', label: 'Custom' },
];

export const KEYWORD_OPERATOR_OPTIONS: Array<{ value: KeywordOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Exact match' },
  { value: 'notContains', label: 'Does not contain' },
];

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MONTH_LABELS = [
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
