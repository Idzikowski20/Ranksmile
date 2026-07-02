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

/** Intro protection can pair focus 'expand' with mode 'less'; the LESS prompt remaps that focus to
 *  ai-coverage (buildLessPrompt), so the copy must NOT claim expansion for it — mirror the remap. */
function effectiveFocus(focus?: StepFocus, mode?: EditMode): StepFocus | undefined {
  return focus === 'expand' && mode === 'less' ? 'ai-coverage' : focus;
}

export function sectionStatusLabel({ focus, mode, reason }: SectionMsgInput): string {
  const f = effectiveFocus(focus, mode);
  if (mode === 'expand' || f === 'expand') return 'Expanding thin content…';
  if (f === 'ai-coverage') {
    return isAuthorityReason(reason) ? 'Strengthening factual authority…' : 'Improving AI answer readiness…';
  }
  if (f === 'seo-terms') return 'Improving SEO coverage…';
  if (f === 'readability') return 'Improving readability…';
  if (f === 'skip') return 'Already optimized.';
  return 'Optimizing section…';
}

export function sectionResultLabel({ focus, mode, reason }: SectionMsgInput): string {
  const f = effectiveFocus(focus, mode);
  if (mode === 'expand') return 'Expanded thin content';
  if (f === 'ai-coverage') {
    return isAuthorityReason(reason) ? 'Strengthened factual authority' : 'Improved AI Search coverage';
  }
  if (f === 'seo-terms') return 'Added missing coverage';
  if (f === 'readability') return 'Improved readability';
  return 'Improved section';
}
