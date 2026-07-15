import type { LocalSetupStep } from './types';

export const ONBOARDING_PROGRESS: Partial<Record<LocalSetupStep, number>> = {
  'creating-location': 4,
  'customizing-flow': 8,
  'user-role': 12.5,
  'ai-replies': 62.5,
  'ai-replies-enabled': 75,
  'map-rank-tracker': 87.5,
  'great-start': 100,
};

export const USER_ROLE_OPTIONS = [
  { id: 'business-owner' as const, label: 'Business owner', icon: 'briefcase' },
  { id: 'freelancer-agency' as const, label: 'Freelancer/Agency', icon: 'laptop' },
  { id: 'marketing-manager' as const, label: 'Marketing manager', icon: 'megaphone' },
  { id: 'store-manager' as const, label: 'Store/Location Manager', icon: 'pin' },
  { id: 'employee' as const, label: 'Employee/Staff Member', icon: 'user' },
  { id: 'other' as const, label: 'Other', icon: null },
];

export const AI_REPLY_LANGUAGES = ['Polish', 'English', 'German', 'French'];
export const AI_REPLY_TONES = ['friendly', 'professional', 'casual', 'formal'];

export const DEFAULT_KEYWORD_SUGGESTIONS = [
  'Executive Suite',
  'Office Space Rental',
  'Business Office',
];

export function suggestKeywordsForBusiness(name: string, categories: string[]): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('detektyw') || lower.includes('detective')) {
    return ['Private detective', 'Detective agency', 'Surveillance services'];
  }
  if (lower.includes('garden') || lower.includes('urbaniak')) {
    return ['Garden design', 'Landscaping', 'Home gardens'];
  }
  if (lower.includes('auto') || lower.includes('park')) {
    return ['Car dealership', 'Used cars', 'Auto sales'];
  }
  if (categories.some((c) => c.toLowerCase().includes('business'))) {
    return DEFAULT_KEYWORD_SUGGESTIONS;
  }
  const firstWord = name.split(/\s+/)[0] ?? 'Local';
  return [`${firstWord} services`, `${firstWord} near me`, 'Local business'];
}
