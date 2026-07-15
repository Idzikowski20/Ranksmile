import type { BusinessDetails } from './types';

export type GrowthTaskId = 'setup-agent' | 'add-categories' | 'improve-description';

export type GrowthTaskMeta = {
  id: GrowthTaskId;
  title: string;
  subtitle: string;
  image: string;
  imageHeight?: number;
};

export const GROWTH_TASKS: GrowthTaskMeta[] = [
  {
    id: 'setup-agent',
    title: 'Set up GBP AI Agent',
    subtitle:
      'Google recommends weekly profile updates for better visibility. AI Agent handles the essentials:',
    image: '/images/local-growth-gbp-agent.webp',
    imageHeight: 220,
  },
  {
    id: 'add-categories',
    title: 'Add more categories',
    subtitle:
      'Categories help your business appear in more relevant searches and attract the right customers on Google Maps.',
    image: '/images/local-growth-add-categories.webp',
    imageHeight: 220,
  },
  {
    id: 'improve-description',
    title: 'Improve description',
    subtitle:
      'A good business description makes your Google Business Profile stand out. Here\u2019s an SEO-optimized description for you.',
    image: '/images/local-growth-add-description.webp',
    imageHeight: 220,
  },
];

const ENGINEERING_CATEGORY_SUGGESTIONS = [
  'Engineering consultant',
  'Construction company',
  'HVAC contractor',
  'Electrical installation service',
  'Mechanical contractor',
  'Electrical engineer',
  'Mechanical engineer',
  'Civil engineering company',
  'Building consultant',
] as const;

const EXTENDED_ENGINEERING_CATEGORY_SUGGESTIONS = [
  'Data center',
  'Computer support and services',
  'Telecommunications contractor',
  'Security system supplier',
  'Fire protection service',
  'Industrial equipment supplier',
  'Project management company',
  'Technical consultant',
  'Automation company',
  'Energy equipment supplier',
] as const;

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Business consultant',
  'Professional services',
  'Corporate office',
] as const;

const EXTENDED_DEFAULT_CATEGORY_SUGGESTIONS = [
  'Business center',
  'Consultant',
  'Marketing agency',
  'Office space rental agency',
  'Business management consultant',
  'Financial consultant',
  'Training center',
  'Employment agency',
] as const;

const CATEGORY_LABEL_MAP: Record<string, string> = {
  'Siedziba firmy': 'Corporate office',
  'Business center': 'Business center',
};

const MIN_CATEGORY_SUGGESTIONS = 3;

function normalizeCategoryLabel(category: string): string {
  const trimmed = category.trim();
  return CATEGORY_LABEL_MAP[trimmed] ?? trimmed;
}

function buildExistingCategorySet(details: BusinessDetails): Set<string> {
  const primary = getPrimaryCategory(details);
  const existing = new Set<string>([primary]);

  for (const category of [...details.googleCategories, ...details.directoryCategories]) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    existing.add(trimmed);
    existing.add(normalizeCategoryLabel(trimmed));
  }

  return existing;
}

function collectFreshCategories(pool: readonly string[], existing: Set<string>, limit: number): string[] {
  const fresh: string[] = [];
  for (const category of pool) {
    if (existing.has(category)) continue;
    fresh.push(category);
    if (fresh.length >= limit) break;
  }
  return fresh;
}

export function getPrimaryCategory(details: BusinessDetails): string {
  const raw = details.googleCategories[0] ?? details.directoryCategories[0] ?? 'Corporate office';
  return CATEGORY_LABEL_MAP[raw] ?? raw;
}

export function getSuggestedCategories(details: BusinessDetails): string[] {
  const haystack = `${details.name} ${details.description}`.toLowerCase();
  const isEngineering =
    haystack.includes('data center')
    || haystack.includes('inżynier')
    || haystack.includes('engineer')
    || haystack.includes('aodc');

  const primaryPool = isEngineering
    ? ENGINEERING_CATEGORY_SUGGESTIONS
    : DEFAULT_CATEGORY_SUGGESTIONS;
  const extendedPool = isEngineering
    ? EXTENDED_ENGINEERING_CATEGORY_SUGGESTIONS
    : EXTENDED_DEFAULT_CATEGORY_SUGGESTIONS;

  const existing = buildExistingCategorySet(details);
  const fresh = collectFreshCategories(primaryPool, existing, 9);

  if (fresh.length < MIN_CATEGORY_SUGGESTIONS) {
    const extended = collectFreshCategories(extendedPool, existing, 9);
    for (const category of extended) {
      if (fresh.includes(category)) continue;
      fresh.push(category);
      if (fresh.length >= 9) break;
    }
  }

  return fresh;
}

export function hasCategorySuggestions(details: BusinessDetails): boolean {
  return getSuggestedCategories(details).length > 0;
}

const POLISH_CHARS = /[ąćęłńóśźż]/i;

export function isPolishDescription(text: string): boolean {
  return POLISH_CHARS.test(text);
}

function improvePolishDescription(name: string, current: string): string {
  let body = current
    .replace(/^AoDC \(Art of Data Center\)/i, name)
    .replace(/\s+/g, ' ')
    .trim();

  if (!body.endsWith('.')) body += '.';

  const suffix = /jakość|innowac/i.test(body)
    ? ''
    : ' Stawiamy na jakość, innowacje i niezawodne rozwiązania dopasowane do potrzeb Twojego biznesu.';

  if (/^to zespół/i.test(body)) {
    return `${name} ${body}${suffix}`;
  }

  if (body.startsWith(name)) return `${body}${suffix}`;

  return `${name} — ${body}${suffix}`;
}

function improveEnglishDescription(name: string, current: string): string {
  let body = current.trim();
  if (!body.endsWith('.')) body += '.';

  const suffix = /quality|innovation/i.test(body)
    ? ''
    : ' With a focus on quality and innovation, we provide reliable solutions tailored to meet your business needs.';

  if (body.toLowerCase().startsWith(name.toLowerCase())) return `${body}${suffix}`;

  return `${name} — ${body}${suffix}`;
}

export function getSuggestedDescription(details: BusinessDetails): string {
  const name = details.name.trim() || (isPolishDescription(details.description) ? 'Nasza firma' : 'Our business');
  const current = details.description.trim();

  if (!current) {
    return isPolishDescription(details.address)
      ? `${name} świadczy profesjonalne usługi dla lokalnych klientów. Koncentrujemy się na jakości, niezawodności i jasnej komunikacji.`
      : `${name} provides professional services tailored to local customers. We focus on quality, reliability, and clear communication.`;
  }

  if (isPolishDescription(current)) {
    return improvePolishDescription(name, current);
  }

  return improveEnglishDescription(name, current);
}

export function applySuggestedCategories(
  details: BusinessDetails,
  extraCategories: string[],
): BusinessDetails {
  const primary = details.googleCategories[0] ?? details.directoryCategories[0];
  const seen = new Set<string>();
  const merged: string[] = [];

  if (primary) {
    seen.add(primary);
    merged.push(primary);
  }

  for (const cat of [...details.googleCategories.slice(primary ? 1 : 0), ...extraCategories]) {
    const label = cat.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    merged.push(label);
  }

  if (merged.length === 0) return details;

  return {
    ...details,
    googleCategories: merged,
    directoryCategories: merged.length > 1
      ? [...new Set([...details.directoryCategories, ...merged.slice(1)])]
      : details.directoryCategories,
  };
}

export function applySuggestedDescription(
  details: BusinessDetails,
  description: string,
): BusinessDetails {
  const next = description.trim();
  if (!next || next === details.description) return details;
  return { ...details, description: next };
}
