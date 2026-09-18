import { formatDateTime, formatLongDate, timeAgo } from '@/lib/formatDate';

describe('formatDate', () => {
  const at = new Date('2026-09-18T07:30:15Z');

  it('formats the dayjs tooltip shape', () => {
    expect(formatDateTime('2026-09-18T07:30:15Z')).toMatch(/^18-Sep-2026, \d{2}:\d{2}:\d{2} (AM|PM)$/);
  });

  it('formats a long date', () => {
    expect(formatLongDate('2026-09-18T12:00:00Z')).toBe('September 18, 2026');
  });

  it('formats relative times in both directions', () => {
    expect(timeAgo(new Date(at.getTime() - 5 * 60_000), at)).toBe('5 minutes ago');
    expect(timeAgo(new Date(at.getTime() - 3 * 86400_000), at)).toBe('3 days ago');
    expect(timeAgo(new Date(at.getTime() + 2 * 3600_000), at)).toBe('in 2 hours');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDateTime('nope')).toBe('');
    expect(timeAgo('nope')).toBe('');
  });
});
