import type { BusinessDetails } from '../../lib/local/types';
import {
  areAllGrowthTasksDoneToday,
  buildGrowthActivityLog,
  countGrowthDoneToday,
  getApplicableGrowthTaskIds,
  GROWTH_DAILY_TOTAL,
  growthDayKey,
  isGrowthDayCurrent,
  resetGrowthActionsForToday,
} from '../../lib/local/growthActionsProgress';

const EMPTY_DETAILS: BusinessDetails = {
  name: 'Test Co',
  address: '',
  phone: '',
  website: '',
  description: '',
  hideAddress: false,
  deliversLocally: false,
  serviceAreas: [],
  googleCategories: ['Corporate office'],
  directoryCategories: [
    'Business consultant',
    'Professional services',
    'Corporate office',
    'Business center',
    'Consultant',
    'Marketing agency',
    'Office space rental agency',
    'Business management consultant',
    'Financial consultant',
    'Training center',
    'Employment agency',
  ],
  photoUrls: [],
  hours: [],
};

describe('growthActionsProgress', () => {
  it('counts baseline actions plus completed growth tasks', () => {
    expect(GROWTH_DAILY_TOTAL).toBe(5);
    expect(countGrowthDoneToday([])).toBe(2);
    expect(countGrowthDoneToday(['setup-agent', 'add-categories', 'improve-description'])).toBe(5);
    expect(areAllGrowthTasksDoneToday(['setup-agent', 'add-categories', 'improve-description'])).toBe(true);
  });

  it('treats exhausted category suggestions as not applicable', () => {
    const applicable = getApplicableGrowthTaskIds(EMPTY_DETAILS, ['setup-agent']);
    expect(applicable).toEqual(['setup-agent', 'improve-description']);
    expect(areAllGrowthTasksDoneToday(['setup-agent', 'improve-description'], EMPTY_DETAILS)).toBe(true);
    expect(countGrowthDoneToday(['setup-agent', 'improve-description'], EMPTY_DETAILS)).toBe(5);
  });

  it('builds activity log with baseline and completed tasks', () => {
    const log = buildGrowthActivityLog(
      ['add-categories'],
      [{ key: 'add-categories', title: 'Add more categories', completedAt: '2026-07-15T10:00:00.000Z' }],
      '2026-07-15T08:00:00.000Z',
    );
    expect(log[0]?.title).toBe('Location created');
    expect(log[1]?.title).toBe('Google Business Profile connected');
    expect(log[2]?.title).toBe('Add more categories');
  });

  it('resets progress for a new day using local calendar date', () => {
    const localNoon = new Date(2026, 6, 15, 12, 0, 0);
    const reset = resetGrowthActionsForToday(localNoon);
    expect(reset.growthActionsDay).toBe('2026-07-15');
    expect(reset.growthActionsCompletedIds).toEqual([]);
    expect(isGrowthDayCurrent('2026-07-14', localNoon)).toBe(false);
    expect(isGrowthDayCurrent(growthDayKey(localNoon), localNoon)).toBe(true);
  });
});
