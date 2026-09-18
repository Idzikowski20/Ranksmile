/** Date formatting on Intl — replaces dayjs/react-timeago for the handful of call sites that used them. */

const DMY = new Intl.DateTimeFormat('en-US', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
});

const LONG_DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** `18-Sep-2026, 07:30:15 AM` — the tooltip format the dayjs call sites used. */
export function formatDateTime(date: string | number | Date): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(DMY.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year}, ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod?.toUpperCase() ?? ''}`.trim();
}

/** `September 18, 2026`. */
export function formatLongDate(date: string | number | Date): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : LONG_DATE.format(d);
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
];

/** `5 minutes ago` / `in 3 days`. */
export function timeAgo(date: string | number | Date, now: Date = new Date()): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  const [unit, secs] = UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1];
  return RTF.format(Math.round(diff / secs), unit);
}
