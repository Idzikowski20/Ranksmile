import { isDue, finalizeAction, dateKeyIn, normalizeTimeZone } from '@/src/core/domain/automations/schedule';

describe('dateKeyIn', () => {
  const lateUtc = new Date('2026-09-17T23:30:00Z');
  it("is the calendar day in the user's time zone", () => {
    expect(dateKeyIn(lateUtc, 'UTC')).toBe('2026-09-17');
    expect(dateKeyIn(lateUtc, 'Europe/Warsaw')).toBe('2026-09-18');
    expect(dateKeyIn(new Date('2026-09-18T02:00:00Z'), 'America/New_York')).toBe('2026-09-17');
  });
  it('falls back to UTC for an unknown zone', () => {
    expect(dateKeyIn(lateUtc, 'Mars/Olympus')).toBe('2026-09-17');
    expect(dateKeyIn(lateUtc, null)).toBe('2026-09-17');
  });
});

describe('normalizeTimeZone', () => {
  it('keeps a valid IANA zone and drops anything else', () => {
    expect(normalizeTimeZone('Europe/Warsaw')).toBe('Europe/Warsaw');
    expect(normalizeTimeZone('Mars/Olympus')).toBeNull();
    expect(normalizeTimeZone(42)).toBeNull();
    expect(normalizeTimeZone('x'.repeat(100))).toBeNull();
  });
});

describe('isDue', () => {
  it('is due on or before today, not in the future', () => {
    expect(isDue('2024-12-16', '2024-12-18')).toBe(true);
    expect(isDue('2024-12-18', '2024-12-18')).toBe(true);
    expect(isDue('2024-12-19', '2024-12-18')).toBe(false);
  });
});

describe('finalizeAction', () => {
  it('waits while generation is pending', () => {
    expect(finalizeAction('live', 'pending', false)).toBe('wait');
    expect(finalizeAction('draft', 'pending', false)).toBe('wait');
  });
  it('fails when generation failed', () => {
    expect(finalizeAction('live', 'failed', true)).toBe('fail');
  });
  it('publishes a live event once content exists', () => {
    expect(finalizeAction('live', 'done', true)).toBe('publish');
  });
  it('completes as draft when live but content is missing, or intent is draft', () => {
    expect(finalizeAction('live', 'done', false)).toBe('complete');
    expect(finalizeAction('draft', 'done', true)).toBe('complete');
  });
});
