import { isDue, finalizeAction } from '@/src/core/domain/automations/schedule';

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
