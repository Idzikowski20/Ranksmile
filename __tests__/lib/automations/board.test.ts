import {
  weekStart, weekDays, weekRange, weekRangeLabel, toDateKey, groupEventsByDay, statusBadge, publishLabel,
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

  it('labels a within-month week and a boundary-crossing week', () => {
    expect(weekRangeLabel(new Date(2024, 11, 18))).toBe('16 – 22 December 2024');
    // Week of 2024-12-30 (Mon) → 2025-01-05 (Sun) crosses month + year.
    expect(weekRangeLabel(new Date(2024, 11, 31))).toBe('30 Dec 2024 – 5 Jan 2025');
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
  it('maps each status to a label and tone', () => {
    expect(statusBadge('scheduled')).toEqual({ label: 'Scheduled', tone: 'neutral' });
    expect(statusBadge('generating')).toEqual({ label: 'Generating', tone: 'warning' });
    expect(statusBadge('created')).toEqual({ label: 'Draft ready', tone: 'success' });
    expect(statusBadge('published')).toEqual({ label: 'Published', tone: 'brand' });
    expect(statusBadge('failed')).toEqual({ label: 'Failed', tone: 'danger' });
  });
});

describe('publishLabel', () => {
  it('reads the publish intent', () => {
    expect(publishLabel('live')).toBe('Publish live');
    expect(publishLabel('draft')).toBe('Keep as draft');
  });
});
