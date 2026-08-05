/**
 * Post-write validators: Flow, Claim coverage+quality, Questions, SEO-vs-benchmark.
 */
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  CoverageQuality,
  TargetClaim,
  TargetKnowledgeGraph,
  TargetQuestion,
  ValidationIssue,
  ValidationResult,
} from '../types';

function plain(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(html: string): number {
  const t = plain(html);
  return t ? t.split(/\s+/).length : 0;
}

export function validateFlow(html: string, outline: AdaptiveOutline): ValidationResult {
  const issues: ValidationIssue[] = [];
  const text = plain(html).toLowerCase();
  const hasH1 = /<h1[\s>]/i.test(html);
  if (!hasH1) issues.push({ code: 'no_h1', message: 'Missing H1' });

  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim().toLowerCase(),
  );
  const quickIdx = h2s.findIndex((h) => /quick|szyb|start|7 dni|pierwsze/i.test(h));
  const theoryIdx = h2s.findIndex((h) => /podstaw|definic|czym jest|foundation/i.test(h));
  if (quickIdx >= 0 && theoryIdx >= 0 && quickIdx > theoryIdx) {
    issues.push({ code: 'quick_after_theory', message: 'Quick Answer/Start should precede theory' });
  }

  const faqHeadings = h2s.filter((h) => /faq|pytan/i.test(h));
  if (faqHeadings.length && outline.sections.some((s) => /faq/i.test(s.role))) {
    // soft: FAQ repeating exact other H2 titles
    for (const fh of faqHeadings) {
      if (h2s.filter((h) => h === fh).length > 1) {
        issues.push({ code: 'faq_dup_h2', message: 'FAQ duplicates another H2 title' });
      }
    }
  }

  if (!/(podsum|summary|wdrażaj|mierz)/i.test(text)) {
    issues.push({ code: 'weak_summary', message: 'Summary/closing signal weak or missing' });
  }

  return { ok: issues.length === 0, issues };
}

export type ClaimValidationItem = {
  claimId: string;
  coverage: CoverageQuality;
  quality: CoverageQuality;
};

function claimPresence(articleText: string, claim: TargetClaim): CoverageQuality {
  const words = claim.statement.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return 'missing';
  const hits = words.filter((w) => articleText.includes(w)).length;
  const ratio = hits / words.length;
  if (ratio >= 0.55) return 'covered';
  if (ratio >= 0.3) return 'partial';
  return 'missing';
}

function claimQuality(articleText: string, claim: TargetClaim, coverage: CoverageQuality): CoverageQuality {
  if (coverage === 'missing') return 'missing';
  // One-liner detection: statement appears but surrounding context too thin.
  const idx = articleText.indexOf(claim.statement.toLowerCase().slice(0, 40));
  if (idx < 0) {
    // fuzzy covered via tokens — require nearby length
    return coverage === 'covered' ? 'partial' : coverage;
  }
  const window = articleText.slice(Math.max(0, idx - 40), idx + claim.statement.length + 120);
  if (window.split(/\s+/).length < 18) return 'partial';
  return 'covered';
}

export function validateClaims(
  html: string,
  kg: TargetKnowledgeGraph,
): { result: ValidationResult; items: ClaimValidationItem[] } {
  const text = plain(html).toLowerCase();
  const items: ClaimValidationItem[] = [];
  const issues: ValidationIssue[] = [];
  const required = kg.claims.filter((c) => c.importance === 'required');
  for (const claim of required) {
    const coverage = claimPresence(text, claim);
    const quality = claimQuality(text, claim, coverage);
    items.push({ claimId: claim.id, coverage, quality });
    if (coverage === 'missing') {
      issues.push({ code: 'claim_missing', message: `Missing claim: ${claim.statement}` });
    } else if (quality === 'partial' || quality === 'missing') {
      issues.push({ code: 'claim_weak', message: `Weak explanation: ${claim.statement}` });
    }
  }
  return { result: { ok: issues.length === 0, issues }, items };
}

export function validateQuestions(
  html: string,
  kg: TargetKnowledgeGraph,
): { result: ValidationResult; statuses: Array<{ questionId: string; status: CoverageQuality }> } {
  const text = plain(html).toLowerCase();
  const statuses: Array<{ questionId: string; status: CoverageQuality }> = [];
  const issues: ValidationIssue[] = [];
  for (const q of kg.questions.filter((x) => x.importance === 'required')) {
    const tokens = q.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hits = tokens.filter((t) => text.includes(t)).length;
    const ratio = tokens.length ? hits / tokens.length : 0;
    const status: CoverageQuality = ratio >= 0.5 ? 'covered' : ratio >= 0.25 ? 'partial' : 'missing';
    statuses.push({ questionId: q.id, status });
    if (status === 'missing') {
      issues.push({ code: 'question_missing', message: `Unanswered: ${q.question}` });
    }
  }
  return { result: { ok: issues.length === 0, issues }, statuses };
}

export function validateSeoAgainstBlueprint(
  html: string,
  blueprint: ArticleBlueprint,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const words = wordCount(html);
  const h2 = (html.match(/<h2\b/gi) || []).length;
  const lists = (html.match(/<(ul|ol)\b/gi) || []).length;
  const low = blueprint.targetWords * 0.85;
  const high = blueprint.targetWords * 1.25;
  if (words < low) {
    issues.push({
      code: 'words_below_benchmark',
      message: `Words ${words} < ${Math.round(low)}`,
      missing: Math.round(low - words),
    });
  }
  if (words > high) {
    issues.push({ code: 'words_above_benchmark', message: `Words ${words} > ${Math.round(high)}` });
  }
  if (h2 < Math.ceil(blueprint.targetH2 * 0.7)) {
    issues.push({
      code: 'h2_below',
      message: `H2 ${h2} below blueprint ${blueprint.targetH2}`,
      missing: blueprint.targetH2 - h2,
    });
  }
  if (lists < Math.ceil(blueprint.targetLists * 0.4)) {
    issues.push({
      code: 'lists_below',
      message: `Lists ${lists} below expected`,
      missing: Math.ceil(blueprint.targetLists * 0.4) - lists,
    });
  }
  return { ok: issues.length === 0, issues };
}

/** Post-write: H2 set must be ⊆ plan headings (Writer must not invent outline). */
export function validatePlanConformity(
  html: string,
  plannedHeadings: string[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim().toLowerCase(),
  );
  const planned = plannedHeadings.map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (!planned.length) {
    return { ok: false, issues: [{ code: 'no_plan_headings', message: 'No planned H2 for conformity' }] };
  }
  for (const h of h2s) {
    const hit = planned.some((p) => h === p);
    if (!hit) {
      issues.push({
        code: 'h2_not_in_plan',
        message: `Output H2 not in Execution Plan: ${h.slice(0, 80)}`,
      });
    }
  }
  const coveredPlan = planned.filter((p) => h2s.some((h) => h === p)).length;
  const coverage = planned.length ? coveredPlan / planned.length : 0;
  if (coverage < 0.7) {
    issues.push({
      code: 'plan_h2_coverage_low',
      message: `Only ${Math.round(coverage * 100)}% of planned H2 present in HTML`,
      missing: planned.length - coveredPlan,
    });
  }
  return { ok: issues.length === 0, issues };
}

export function requiredCoverageRate(
  items: Array<{ coverage: CoverageQuality; quality?: CoverageQuality }>,
): number {
  if (!items.length) return 1;
  const ok = items.filter((i) => i.coverage === 'covered' && (i.quality ?? 'covered') === 'covered').length;
  return ok / items.length;
}
