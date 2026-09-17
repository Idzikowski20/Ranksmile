import {
  weekStart, weekDays, weekRange, weekRangeLabel, columnDateLabel, toDateKey,
  groupEventsByDay, statusBadge, publishLabel, filterEvents,
} from '@/src/core/domain/automations/board';
import type { AutomationEvent } from '@/src/core/shared/types/automations';

const ev = (id: number, date: string, over: Partial<AutomationEvent> = {}): AutomationEvent => ({
  id, domainId: 1, workspaceId: 1, scheduledDate: date, title: `T${id}`, targetKeyword: 'k',
  publishMode: 'draft', articleId: null, status: 'scheduled', createdAt: null, ...over,
});

describe('week helpers', () => {
  it('starts the week on Monday regardless of the day passed', () => {
    // 2024-12-18 is a Wednesday → week starts Mon 2024-12-16.
    expect(toDateKey(weekStart(new Date(2024, 11, 18)))).toBe('2024-12-16');
    expect(toDateKey(weekStart(new Date(2024, 11, 16)))).toBe('2024-12-16'); // Monday itself
    expect(toDateKey(weekStart(new Date(2024, 11, 22)))).toBe('2024-12-16'); // Sunday
  });

  it('lists 7 Monday-first days and an inclusive range', () => {
    const days = weekDays(new Date(2024, 11, 18));
    expect(days.map(toDateKey)).toEqual([
      '2024-12-16', '2024-12-17', '2024-12-18', '2024-12-19', '2024-12-20', '2024-12-21', '2024-12-22',
    ]);
    expect(weekRange(new Date(2024, 11, 18))).toEqual({ from: '2024-12-16', to: '2024-12-22' });
  });

  it('labels the week like the calendar header: "16 - 22 December 2024"', () => {
    expect(weekRangeLabel(new Date(2024, 11, 18))).toBe('16 - 22 December 2024');
    // Week of 2024-12-30 (Mon) → 2025-01-05 (Sun) crosses month + year.
    expect(weekRangeLabel(new Date(2024, 11, 31))).toBe('30 Dec 2024 - 5 Jan 2025');
    // Crosses a month only.
    expect(weekRangeLabel(new Date(2024, 8, 30))).toBe('30 Sep - 6 Oct 2024');
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
