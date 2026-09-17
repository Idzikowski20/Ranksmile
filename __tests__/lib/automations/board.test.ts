import {
  WINDOW_DAYS, startOfDay, shiftDays, windowDays, windowRange, windowRangeLabel, columnDateLabel, toDateKey,
  groupEventsByDay, statusBadge, publishLabel, filterEvents,
} from '@/src/core/domain/automations/board';
import type { AutomationEvent } from '@/src/core/shared/types/automations';

const ev = (id: number, date: string, over: Partial<AutomationEvent> = {}): AutomationEvent => ({
  id, domainId: 1, workspaceId: 1, scheduledDate: date, title: `T${id}`, targetKeyword: 'k',
  publishMode: 'draft', articleId: null, status: 'scheduled', createdAt: null, ...over,
});

describe('day window', () => {
  it('shows four days', () => {
    expect(WINDOW_DAYS).toBe(4);
  });

  it('starts at the given day (midnight) and runs forward, no earlier days', () => {
    const days = windowDays(new Date(2026, 8, 17, 15, 30));
    expect(days.map(toDateKey)).toEqual(['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
    expect(days[0].getHours()).toBe(0);
    expect(windowRange(new Date(2026, 8, 17))).toEqual({ from: '2026-09-17', to: '2026-09-20' });
  });

  it('shifts by whole days across month ends, keeping midnight', () => {
    expect(toDateKey(shiftDays(new Date(2026, 8, 29), 4))).toBe('2026-10-03');
    expect(toDateKey(shiftDays(new Date(2026, 9, 1), -4))).toBe('2026-09-27');
    expect(startOfDay(new Date(2026, 8, 17, 23, 59)).getHours()).toBe(0);
  });

  it('labels the window like the calendar header', () => {
    expect(windowRangeLabel(new Date(2026, 8, 17))).toBe('17 - 20 September 2026');
    expect(windowRangeLabel(new Date(2026, 8, 29))).toBe('29 Sep - 2 Oct 2026');
    expect(windowRangeLabel(new Date(2026, 11, 30))).toBe('30 Dec 2026 - 2 Jan 2027');
  });

  it('labels a column as "Monday, 16 Dec 2024"', () => {
    expect(columnDateLabel(new Date(2024, 11, 16))).toBe('Monday, 16 Dec 2024');
    expect(columnDateLabel(new Date(2024, 11, 22))).toBe('Sunday, 22 Dec 2024');
  });
});

describe('groupEventsByDay', () => {
  it('buckets events by their scheduled day, preserving order', () => {
    const map = groupEventsByDay([ev(1, '2024-12-16'), ev(2, '2024-12-16'), ev(3, '2024-12-18')]);
    expect(map.get('2024-12-16')?.map((e) => e.id)).toEqual([1, 2]);
    expect(map.get('2024-12-18')?.map((e) => e.id)).toEqual([3]);
    expect(map.has('2024-12-17')).toBe(false);
  });
});

describe('statusBadge', () => {
  it('maps each status to a label, avatar initial and colour', () => {
    expect(statusBadge('scheduled')).toEqual({ label: 'Scheduled', initial: 'S', color: 'blue' });
    expect(statusBadge('generating')).toEqual({ label: 'Generating', initial: 'G', color: 'orange' });
    expect(statusBadge('created')).toEqual({ label: 'Draft ready', initial: 'D', color: 'green' });
    expect(statusBadge('published')).toEqual({ label: 'Published', initial: 'P', color: 'purple' });
    expect(statusBadge('failed')).toEqual({ label: 'Failed', initial: 'F', color: 'red' });
  });
});

describe('publishLabel', () => {
  it('reads the publish intent', () => {
    expect(publishLabel('live')).toBe('Publish live');
    expect(publishLabel('draft')).toBe('Keep as draft');
  });
});

describe('filterEvents', () => {
  const events = [
    ev(1, '2024-12-16', { title: 'Figma basics', targetKeyword: 'figma', status: 'scheduled', publishMode: 'draft' }),
    ev(2, '2024-12-16', { title: 'Local SEO', targetKeyword: 'seo tips', status: 'published', publishMode: 'live' }),
    ev(3, '2024-12-17', { title: 'Boolean types', targetKeyword: 'figma boolean', status: 'failed', publishMode: 'live' }),
  ];
  const ids = (list: AutomationEvent[]) => list.map((e) => e.id);

  it('returns everything with no filters', () => {
    expect(ids(filterEvents(events, {}))).toEqual([1, 2, 3]);
  });
  it('matches the search query against title and keyword, case-insensitively', () => {
    expect(ids(filterEvents(events, { query: 'FIGMA' }))).toEqual([1, 3]);
    expect(ids(filterEvents(events, { query: 'tips' }))).toEqual([2]);
    expect(ids(filterEvents(events, { query: '   ' }))).toEqual([1, 2, 3]);
  });
  it('filters by status and by publish mode, combined', () => {
    expect(ids(filterEvents(events, { status: 'failed' }))).toEqual([3]);
    expect(ids(filterEvents(events, { mode: 'live' }))).toEqual([2, 3]);
    expect(ids(filterEvents(events, { mode: 'live', query: 'figma' }))).toEqual([3]);
  });
});
