import {
  backoffMs,
  isoWeekPeriodKey,
  keywordPositionsIdempotencyKey,
  periodKeyFromInterval,
} from '../../lib/notifications/emailTypes';

describe('email periodKey helpers', () => {
  it('daily uses UTC YYYY-MM-DD', () => {
    const d = new Date('2026-07-27T15:00:00.000Z');
    expect(periodKeyFromInterval('daily', d)).toBe('2026-07-27');
  });

  it('weekly uses ISO week UTC', () => {
    // 2026-12-28 is Monday of ISO week 53 of 2026
    const d = new Date('2026-12-28T12:00:00.000Z');
    expect(isoWeekPeriodKey(d)).toMatch(/^\d{4}-W\d{2}$/);
    expect(periodKeyFromInterval('weekly', d)).toBe(isoWeekPeriodKey(d));
  });

  it('idempotency key is domain+period', () => {
    expect(keywordPositionsIdempotencyKey(42, '2026-07-27')).toBe(
      'keyword_positions:domain:42:2026-07-27',
    );
  });

  it('backoff caps at 15 minutes', () => {
    expect(backoffMs(0)).toBe(30_000);
    expect(backoffMs(10)).toBe(15 * 60_000);
  });
});
