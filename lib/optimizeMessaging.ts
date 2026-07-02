import type { StepFocus, EditMode } from './optimizationPlanner';

export interface SectionMsgInput {
  focus?: StepFocus;
  mode?: EditMode;
  reason?: string;
}

const AUTHORITY_REASON_RE = /authorit|fact|citation|source/i;

function isAuthorityReason(reason?: string): boolean {
  return !!reason && AUTHORITY_REASON_RE.test(reason);
}

export function sectionStatusLabel({ focus, mode, reason }: SectionMsgInput): string {
  if (mode === 'expand' || focus === 'expand') return 'Expanding thin content…';
  if (focus === 'ai-coverage') {
    return isAuthorityReason(reason) ? 'Strengthening factual authority…' : 'Improving AI answer readiness…';
  }
  if (focus === 'seo-terms') return 'Improving SEO coverage…';
  if (focus === 'readability') return 'Improving readability…';
  if (focus === 'skip') return 'Already optimized.';
  return 'Optimizing section…';
}

export function sectionResultLabel({ focus, mode, reason }: SectionMsgInput): string {
  if (mode === 'expand') return 'Expanded thin content';
  if (focus === 'ai-coverage') {
    return isAuthorityReason(reason) ? 'Strengthened factual authority' : 'Improved AI Search coverage';
  }
  if (focus === 'seo-terms') return 'Added missing coverage';
  if (focus === 'readability') return 'Improved readability';
  return 'Improved section';
}
