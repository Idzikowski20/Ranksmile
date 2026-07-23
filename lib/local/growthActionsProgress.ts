import {
  GROWTH_TASKS,
  hasBusinessLogo,
  hasCategorySuggestions,
  hasCoverPhoto,
  hasEnoughBusinessPhotos,
  type GrowthTaskId,
} from './growthActions';
import type { BusinessDetails, GrowthActionLogEntry } from './types';

export const GROWTH_BASELINE_ACTIONS = [
  { key: 'location-created', title: 'Location created' },
  { key: 'profile-connected', title: 'Google Business Profile connected' },
] as const;

export const GROWTH_DAILY_TOTAL = GROWTH_BASELINE_ACTIONS.length + GROWTH_TASKS.length;

export function growthDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isGrowthDayCurrent(day: string | null, date = new Date()): boolean {
  return day === growthDayKey(date);
}

export function resetGrowthActionsForToday(date = new Date()): {
  growthActionsDay: string;
  growthActionsCompletedIds: GrowthTaskId[];
  growthActionsLog: GrowthActionLogEntry[];
} {
  return {
    growthActionsDay: growthDayKey(date),
    growthActionsCompletedIds: [],
    growthActionsLog: [],
  };
}

/** Tasks that still make sense for this business (e.g. skip categories when none left). */
export function getApplicableGrowthTaskIds(
  details: BusinessDetails,
  completedIds: GrowthTaskId[] = [],
): GrowthTaskId[] {
  const completed = new Set(completedIds);
  return GROWTH_TASKS
    .filter((task) => {
      if (completed.has(task.id)) return true;
      if (task.id === 'add-categories' && !hasCategorySuggestions(details)) return false;
      if (task.id === 'add-logo' && hasBusinessLogo(details)) return false;
      if (task.id === 'add-cover-photo' && hasCoverPhoto(details)) return false;
      if (task.id === 'add-photos' && hasEnoughBusinessPhotos(details)) return false;
      return true;
    })
    .map((task) => task.id);
}

export function countGrowthDoneToday(
  completedIds: GrowthTaskId[],
  details?: BusinessDetails,
): number {
  if (!details) {
    return GROWTH_BASELINE_ACTIONS.length + completedIds.length;
  }
  const applicable = getApplicableGrowthTaskIds(details, completedIds);
  const doneApplicable = applicable.filter((id) => completedIds.includes(id)).length;
  const skipped = GROWTH_TASKS.length - applicable.length;
  return GROWTH_BASELINE_ACTIONS.length + doneApplicable + skipped;
}

export function areAllGrowthTasksDoneToday(
  completedIds: GrowthTaskId[],
  details?: BusinessDetails,
): boolean {
  const applicable = details
    ? getApplicableGrowthTaskIds(details, completedIds)
    : GROWTH_TASKS.map((task) => task.id);
  return applicable.every((id) => completedIds.includes(id));
}

export function buildGrowthActivityLog(
  completedIds: GrowthTaskId[],
  taskLog: GrowthActionLogEntry[],
  locationCreatedAt: string | null,
): GrowthActionLogEntry[] {
  const baseline: GrowthActionLogEntry[] = GROWTH_BASELINE_ACTIONS.map((item) => ({
    key: item.key,
    title: item.title,
    completedAt: item.key === 'location-created' && locationCreatedAt
      ? locationCreatedAt
      : new Date().toISOString(),
  }));

  const taskTitles = new Map(GROWTH_TASKS.map((task) => [task.id, task.title]));
  const completedTasks = completedIds.map((id) => {
    const fromLog = taskLog.find((entry) => entry.key === id);
    return {
      key: id,
      title: fromLog?.title ?? taskTitles.get(id) ?? id,
      completedAt: fromLog?.completedAt ?? new Date().toISOString(),
    };
  });

  return [...baseline, ...completedTasks];
}

export function formatGrowthActivityDate(iso: string | null): string {
  if (!iso) return 'Today';
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
