import type { EditBudget } from './editBudget';
import type { ArticleIntentProfile } from './intentProfile';
import { textHitsForbidden } from './intentProfile';

export type RejectReason =
  | 'WORD_BUDGET'
  | 'DELETE_BUDGET'
  | 'PARAGRAPH_BUDGET'
  | 'CHANGE_RATIO'
  | 'UNEXPECTED_HEADING'
  | 'TOPIC_DRIFT'
  | 'FORBIDDEN_TOPIC'
  | 'INVALID_HTML'
  | 'PRESERVATION';

export type SafetyGateResult =
  | { ok: true; changeRatio: number; beforeWords: number; afterWords: number }
  | {
      ok: false;
      rejectReason: RejectReason;
      changeRatio: number;
      beforeWords: number;
      afterWords: number;
      detail?: string;
    };

function stripTags(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(html: string): number {
  const t = stripTags(html);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function extractParagraphs(html: string): string[] {
  const matches = (html || '').match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  if (matches.length) return matches.map((m) => stripTags(m));
  const plain = stripTags(html);
  return plain ? [plain] : [];
}

function countHeadings(html: string): { h2: number; h3: number } {
  const h2 = ((html || '').match(/<h2\b/gi) || []).length;
  const h3 = ((html || '').match(/<h3\b/gi) || []).length;
  return { h2, h3 };
}

/** Simple char-level change ratio via longest common subsequence length. */
export function changeRatio(before: string, after: string): number {
  const a = stripTags(before);
  const b = stripTags(after);
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  const lcs = lcsLength(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - lcs / maxLen;
}

function lcsLength(a: string, b: string): number {
  // Cap for P0 perf — sample mid if huge
  const A = a.length > 4000 ? a.slice(0, 2000) + a.slice(-2000) : a;
  const B = b.length > 4000 ? b.slice(0, 2000) + b.slice(-2000) : b;
  const m = A.length;
  const n = B.length;
  // Two-row DP
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (A[i - 1] === B[j - 1]) curr[j] = prev[j - 1] + 1;
      else curr[j] = Math.max(prev[j], curr[j - 1]);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp.fill(0);
  }
  return prev[n];
}

function looksLikeValidHtml(html: string): boolean {
  if (!html || !html.trim()) return false;
  // Unbalanced obvious tags
  const open = (html.match(/<(p|div|h[1-6]|ul|ol|li|section)\b[^>]*>/gi) || []).length;
  const close = (html.match(/<\/(p|div|h[1-6]|ul|ol|li|section)>/gi) || []).length;
  if (open > 0 && Math.abs(open - close) > 2) return false;
  return true;
}

function modifiedParagraphCount(beforeHtml: string, afterHtml: string): number {
  const before = extractParagraphs(beforeHtml);
  const after = extractParagraphs(afterHtml);
  const max = Math.max(before.length, after.length);
  let mod = 0;
  for (let i = 0; i < max; i++) {
    if ((before[i] || '') !== (after[i] || '')) mod += 1;
  }
  return mod;
}

export type SafetyGateInput = {
  beforeHtml: string;
  afterHtml: string;
  budget: EditBudget;
  profile: ArticleIntentProfile;
  stepId?: string;
};

/**
 * Deterministic BEFORE/AFTER gate — never trust LLM self-report.
 * Logs rejectReason on failure (caller should console/structured log).
 */
export function runEditSafetyGate(input: SafetyGateInput): SafetyGateResult {
  const { beforeHtml, afterHtml, budget, profile, stepId } = input;
  const beforeWords = countWords(beforeHtml);
  const afterWords = countWords(afterHtml);
  const ratio = changeRatio(beforeHtml, afterHtml);
  const newWords = Math.max(0, afterWords - beforeWords);
  const deletedWords = Math.max(0, beforeWords - afterWords);

  const fail = (rejectReason: RejectReason, detail?: string): SafetyGateResult => {
    const result = {
      ok: false as const,
      rejectReason,
      changeRatio: ratio,
      beforeWords,
      afterWords,
      detail,
    };
    console.warn('[EditSafetyGate] reject', {
      rejectReason,
      stepId,
      beforeWords,
      afterWords,
      changeRatio: ratio,
      detail,
    });
    return result;
  };

  if (!looksLikeValidHtml(afterHtml)) {
    return fail('INVALID_HTML', 'unbalanced or empty html');
  }

  // Drift / forbidden first — clearer rejectReason than CHANGE_RATIO on poisoned edits
  if (textHitsForbidden(afterHtml, profile) && !textHitsForbidden(beforeHtml, profile)) {
    return fail('FORBIDDEN_TOPIC', 'new forbidden topic introduced');
  }

  if (newWords > budget.maxNewWords) {
    return fail('WORD_BUDGET', `+${newWords} > ${budget.maxNewWords}`);
  }
  if (deletedWords > budget.maxDeletedWords) {
    return fail('DELETE_BUDGET', `-${deletedWords} > ${budget.maxDeletedWords}`);
  }

  const modParas = modifiedParagraphCount(beforeHtml, afterHtml);
  if (modParas > budget.maxModifiedParagraphs) {
    return fail('PARAGRAPH_BUDGET', `${modParas} > ${budget.maxModifiedParagraphs}`);
  }

  if (ratio > budget.maxChangeRatio) {
    return fail('CHANGE_RATIO', `${ratio.toFixed(3)} > ${budget.maxChangeRatio}`);
  }

  if (!budget.allowNewHeading) {
    const b = countHeadings(beforeHtml);
    const a = countHeadings(afterHtml);
    if (a.h2 > b.h2 || a.h3 > b.h3) {
      return fail('UNEXPECTED_HEADING', `h2 ${b.h2}->${a.h2} h3 ${b.h3}->${a.h3}`);
    }
  }

  // Preservation: if almost everything changed but word count similar — already CHANGE_RATIO.
  // Extra: after must retain a chunk of before when before was non-trivial.
  if (beforeWords >= 40 && ratio > 0.85) {
    return fail('PRESERVATION', 'section rewritten');
  }

  return { ok: true, changeRatio: ratio, beforeWords, afterWords };
}
