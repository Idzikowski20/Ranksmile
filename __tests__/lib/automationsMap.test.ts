import { mapAutomationEvent } from '../../lib/types/automations';

describe('mapAutomationEvent', () => {
  it('normalizes publish mode and date', () => {
    const ev = mapAutomationEvent({
      id: 1,
      domain_id: 2,
      workspace_id: 3,
      scheduled_date: '2026-08-15T00:00:00.000Z',
      title: 'Test',
      target_keyword: 'seo',
      publish_mode: 'live',
      article_id: 9,
      status: 'created',
      created_at: null,
    });
    expect(ev.scheduledDate).toBe('2026-08-15');
    expect(ev.publishMode).toBe('live');
    expect(ev.status).toBe('created');
  });

  it('falls back unknown publish mode to draft', () => {
    const ev = mapAutomationEvent({
      id: 1,
      domain_id: 2,
      workspace_id: 3,
      scheduled_date: '2026-08-01',
      title: 'X',
      target_keyword: '',
      publish_mode: 'weird',
      article_id: null,
      status: 'scheduled',
      created_at: null,
    });
    expect(ev.publishMode).toBe('draft');
  });
});
