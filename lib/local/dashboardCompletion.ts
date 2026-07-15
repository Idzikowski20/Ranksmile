import type { AiRepliesSettings, BusinessDetails } from './types';
import { formatGrowthActivityDate } from './growthActionsProgress';

type CompletionInput = {
  details: BusinessDetails;
  aiReplies: AiRepliesSettings;
  mapRankKeywords: string[];
  hasUserRole: boolean;
};

export type CompletionChecklistItem = {
  label: string;
  done: number;
  total: number;
};

function countTruthy(flags: boolean[]): { done: number; total: number } {
  return { done: flags.filter(Boolean).length, total: flags.length };
}

export function getProfileCompletionChecklist(input: CompletionInput): CompletionChecklistItem[] {
  const { details, aiReplies, hasUserRole } = input;

  const basic = countTruthy([
    details.name.trim().length > 0,
    details.phone.trim().length > 0,
    details.website.trim().length > 0,
    details.description.trim().length > 20,
    details.directoryCategories.length > 0,
    details.googleCategories.length > 0,
    details.hours.some((row) => row.status === 'open'),
  ]);

  const address = countTruthy([
    details.address.trim().length > 0,
    details.phone.trim().length > 0,
    !details.deliversLocally || details.serviceAreas.length > 0,
    details.hours.length >= 7,
  ]);

  const photos = countTruthy([
    Boolean(details.logoUrl),
    Boolean(details.coverUrl),
    details.photoUrls.length > 0,
    details.photoUrls.length > 1,
  ]);

  const gbp = countTruthy([
    details.googleCategories.length > 0 || details.directoryCategories.length > 0,
  ]);

  const social = countTruthy([
    details.website.trim().length > 0,
    false,
  ]);

  const additional = countTruthy([
    hasUserRole || !aiReplies.skipped,
  ]);

  return [
    { label: 'Basic information', ...basic },
    { label: 'Address', ...address },
    { label: 'Photos and videos', ...photos },
    { label: 'Google Business Profile', ...gbp },
    { label: 'Social media', ...social },
    { label: 'Additional information', ...additional },
  ];
}

export function calculateProfileCompletion(input: CompletionInput): number {
  const { details, aiReplies, mapRankKeywords, hasUserRole } = input;
  let score = 42;

  if (details.description.trim().length > 20) score += 8;
  if (details.directoryCategories.length > 0) score += 10;
  if (details.photoUrls.length > 0) score += 6;
  if (details.website.trim()) score += 4;
  if (!aiReplies.skipped && (aiReplies.positiveEnabled || aiReplies.negativeEnabled)) score += 14;
  if (mapRankKeywords.length > 0) score += 10;
  if (hasUserRole) score += 6;

  return Math.min(100, score);
}

export function formatCompletedDate(iso: string | null): string {
  return formatGrowthActivityDate(iso);
}
