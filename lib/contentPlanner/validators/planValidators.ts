/**
 * Blueprint / Outline / Brief / Execution Plan validators — compiler gates.
 */
import { computeKnowledgeCoverage } from '../knowledgeCoverage';
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  CompetitorBenchmark,
  CompetitorSynthesisMetrics,
  KnowledgeCoverageReport,
  SectionBrief,
  TargetKnowledgeGraph,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { KNOWLEDGE_COVERAGE_MIN_PCT } from '../types';

export function validateBlueprint(bp: ArticleBlueprint): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (bp.targetWords < 600) {
    issues.push({ code: 'words_too_low', message: 'targetWords below minimum 600' });
  }
  if (bp.targetH2 < 5) {
    issues.push({ code: 'h2_too_low', message: 'targetH2 below minimum 5' });
  }
  if (bp.targetClaims < 5) {
    issues.push({ code: 'claims_too_low', message: 'targetClaims below minimum 5' });
  }
  if (!bp.requiredSections.length) {
    issues.push({ code: 'no_sections', message: 'requiredSections empty' });
  }
  if (bp.budget.words !== bp.targetWords) {
    issues.push({ code: 'budget_mismatch', message: 'budget.words must equal targetWords' });
  }
  return { ok: issues.length === 0, issues };
}

export function validateOutline(
  outline: AdaptiveOutline,
  blueprint: ArticleBlueprint,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const claimsAssigned = new Set(outline.sections.flatMap((s) => s.assignedClaimIds)).size;
  const questionsAssigned = new Set(outline.sections.flatMap((s) => s.assignedQuestionIds)).size;
  const examples = outline.sections.filter((s) => s.requiredBlocks.includes('example')).length;
  const checklists = outline.sections.filter((s) => s.requiredBlocks.includes('checklist')).length;

  if (outline.sections.length < Math.min(5, blueprint.targetH2)) {
    issues.push({
      code: 'h2_short',
      message: `Outline has ${outline.sections.length} H2, need ~${blueprint.targetH2}`,
      missing: blueprint.targetH2 - outline.sections.length,
    });
  }
  const claimFloor = Math.max(1, Math.ceil(blueprint.targetClaims * 0.9));
  if (claimsAssigned < claimFloor) {
    issues.push({
      code: 'claims_underassigned',
      message: `Assigned ${claimsAssigned} claims, need ≥${claimFloor}`,
      missing: claimFloor - claimsAssigned,
    });
  }
  const questionFloor = Math.max(1, Math.ceil(blueprint.targetQuestions * 0.8));
  if (questionsAssigned < questionFloor) {
    issues.push({
      code: 'questions_underassigned',
      message: `Assigned ${questionsAssigned} questions, need ≥${questionFloor}`,
      missing: questionFloor - questionsAssigned,
    });
  }
  const exampleFloor = Math.max(1, Math.min(outline.sections.length, Math.ceil(blueprint.targetExamples * 0.4)));
  if (examples < exampleFloor) {
    issues.push({
      code: 'examples_low',
      message: `Only ${examples} example blocks`,
      missing: exampleFloor - examples,
    });
  }
  const checklistFloor = Math.max(1, Math.min(outline.sections.length, Math.ceil(blueprint.targetChecklists * 0.4)));
  if (checklists < checklistFloor) {
    issues.push({
      code: 'checklists_low',
      message: `Only ${checklists} checklist blocks`,
      missing: checklistFloor - checklists,
    });
  }
  for (const req of blueprint.requiredSections) {
    const hit = outline.sections.some((s) =>
      s.heading.toLowerCase().includes(req.toLowerCase())
      || s.role.toLowerCase().includes(req.toLowerCase().replace(/\s+/g, '_')),
    );
    if (!hit) {
      issues.push({ code: 'missing_required_section', message: `Missing required section: ${req}` });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateBrief(brief: SectionBrief): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!brief.blocks.length) {
    issues.push({ code: 'no_blocks', message: 'Brief has no content blocks' });
  }
  if (brief.budget.words < 40) {
    issues.push({ code: 'budget_words_low', message: 'Section budget words too low' });
  }
  if (brief.budget.claims > 0 && brief.claimIds.length === 0) {
    issues.push({ code: 'no_claims', message: 'Budget expects claims but none assigned' });
  }
  if (brief.evidence.length === 0 && brief.budget.examples > 0) {
    issues.push({ code: 'no_evidence', message: 'Examples required but evidence empty' });
  }
  return { ok: issues.length === 0, issues };
}

export function validateBriefs(briefs: SectionBrief[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const b of briefs) {
    const r = validateBrief(b);
    for (const issue of r.issues) {
      issues.push({ ...issue, message: `[${b.heading}] ${issue.message}` });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Hard gate: plan must meet Competitor Benchmark (never authorize thin plans). */
export function validateAgainstBenchmark(opts: {
  blueprint: ArticleBlueprint;
  outline: AdaptiveOutline | null;
  benchmark: CompetitorBenchmark;
  synthesis?: CompetitorSynthesisMetrics | null;
  /** When set, claim/question floors cannot exceed KG size. */
  kg?: TargetKnowledgeGraph | null;
}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { blueprint, outline, benchmark, synthesis, kg } = opts;
  const wordsTarget = benchmark.targetWords;
  if (blueprint.budget.words < wordsTarget || blueprint.targetWords < wordsTarget) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan words ${blueprint.budget.words} < benchmark ${wordsTarget}`,
      missing: wordsTarget - blueprint.budget.words,
    });
  }
  const h2Count = outline?.sections.length ?? 0;
  if (h2Count < benchmark.targetH2) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan H2 ${h2Count} < benchmark ${benchmark.targetH2}`,
      missing: benchmark.targetH2 - h2Count,
    });
  }
  const paraFloor = Math.max(
    benchmark.averageParagraphs,
    Math.round(synthesis?.averageParagraphs || 0),
  );
  if (paraFloor > 0 && blueprint.targetParagraphs < Math.round(paraFloor * 0.9)) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan paragraphs ${blueprint.targetParagraphs} below recommended ~${paraFloor}`,
      missing: paraFloor - blueprint.targetParagraphs,
    });
  }
  if (blueprint.targetLists < Math.round(benchmark.averageLists * 0.85)) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan lists ${blueprint.targetLists} < benchmark lists ~${benchmark.averageLists}`,
    });
  }
  if (blueprint.targetTables < Math.max(1, Math.round(benchmark.averageTables * 0.8))) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan tables ${blueprint.targetTables} below benchmark`,
    });
  }
  if (blueprint.targetFaqs < Math.round(benchmark.averageFaq * 0.8)) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan FAQ ${blueprint.targetFaqs} < benchmark ~${benchmark.averageFaq}`,
    });
  }
  if (blueprint.targetExamples < Math.round(benchmark.averageExamples * 0.7)) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan examples ${blueprint.targetExamples} below benchmark`,
    });
  }
  const claimCap = kg ? Math.max(kg.claims.length, 1) : Number.POSITIVE_INFINITY;
  const claimFloor = Math.min(Math.round(benchmark.averageClaims * 0.7), claimCap);
  if (blueprint.targetClaims < claimFloor) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan claims ${blueprint.targetClaims} below benchmark`,
    });
  }
  const questionCap = kg ? Math.max(kg.questions.length, 1) : Number.POSITIVE_INFINITY;
  const questionFloor = Math.min(Math.round(benchmark.averageQuestions * 0.7), questionCap);
  if (blueprint.targetQuestions < questionFloor) {
    issues.push({
      code: 'below_competitor_benchmark',
      message: `Plan questions ${blueprint.targetQuestions} below benchmark`,
    });
  }
  return { ok: issues.length === 0, issues };
}

export function validateKnowledgeCoverageGate(
  report: KnowledgeCoverageReport | null,
): ValidationResult {
  if (!report) {
    return {
      ok: false,
      issues: [{ code: 'knowledge_coverage_missing', message: 'KnowledgeCoverageReport missing' }],
    };
  }
  if (report.knowledgeCoveragePct < KNOWLEDGE_COVERAGE_MIN_PCT) {
    return {
      ok: false,
      issues: [{
        code: 'knowledge_coverage_below_min',
        message: `knowledgeCoveragePct ${report.knowledgeCoveragePct} < ${KNOWLEDGE_COVERAGE_MIN_PCT}`,
        missing: KNOWLEDGE_COVERAGE_MIN_PCT - report.knowledgeCoveragePct,
      }],
    };
  }
  return { ok: true, issues: [] };
}

export function validateWordBudgetAlignment(
  briefs: SectionBrief[],
  articleWords: number,
): ValidationResult {
  if (!briefs.length) {
    return { ok: false, issues: [{ code: 'no_briefs', message: 'No section briefs for budget sum' }] };
  }
  const sum = briefs.reduce((n, b) => n + (b.budget.words || 0), 0);
  const tolerance = Math.max(200, Math.round(articleWords * 0.12));
  if (Math.abs(sum - articleWords) > tolerance) {
    return {
      ok: false,
      issues: [{
        code: 'section_budget_sum_mismatch',
        message: `Sum section words ${sum} vs article ${articleWords} (tol ${tolerance})`,
        missing: Math.abs(sum - articleWords),
      }],
    };
  }
  return { ok: true, issues: [] };
}

export function validateQuickAnswer(quickAnswer: string | null | undefined): ValidationResult {
  const text = (quickAnswer || '').trim();
  if (text.length < 40) {
    return {
      ok: false,
      issues: [{ code: 'quick_answer_empty', message: 'Quick Answer missing or too short' }],
    };
  }
  if (/^(seo|pozycjonowanie)\s+(to|jest|oznacza)\b/i.test(text)) {
    return {
      ok: false,
      issues: [{ code: 'quick_answer_definition_first', message: 'Quick Answer must be action-first' }],
    };
  }
  return { ok: true, issues: [] };
}

export function validateMustAnswerComplete(briefs: SectionBrief[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const b of briefs) {
    if (b.questionIds.length > 0 && (!b.mustAnswer || b.mustAnswer.length === 0)) {
      issues.push({
        code: 'must_answer_incomplete',
        message: `[${b.heading}] has questions but empty mustAnswer`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateRequiredAssignments(opts: {
  kg: TargetKnowledgeGraph;
  outline: AdaptiveOutline | null;
}): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!opts.outline) {
    return { ok: false, issues: [{ code: 'no_outline', message: 'Outline missing' }] };
  }
  const assignedClaims = new Set(opts.outline.sections.flatMap((s) => s.assignedClaimIds));
  const assignedQuestions = new Set(opts.outline.sections.flatMap((s) => s.assignedQuestionIds));
  for (const c of opts.kg.claims) {
    if ((c.importance === 'required' || c.priority === 'critical') && !assignedClaims.has(c.id)) {
      issues.push({
        code: 'required_claim_unassigned',
        message: `Required/critical claim unassigned: ${c.id}`,
      });
    }
  }
  for (const q of opts.kg.questions) {
    if ((q.importance === 'required' || q.priority === 'critical') && !assignedQuestions.has(q.id)) {
      issues.push({
        code: 'required_question_unassigned',
        message: `Required/critical question unassigned: ${q.id}`,
      });
    }
  }
  for (const s of opts.outline.sections) {
    // Critical sections must declare evidence needs (empty needs previously bypassed this).
    if (s.importance >= 8 && s.evidenceNeeds.length === 0) {
      issues.push({
        code: 'evidence_need_missing',
        message: `Critical section ${s.id} has no evidenceNeeds`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Aggregate Plan Validator before Write Engine. */
export function validatePlanForWrite(opts: {
  blueprint: ArticleBlueprint;
  outline: AdaptiveOutline | null;
  briefs: SectionBrief[];
  kg: TargetKnowledgeGraph;
  benchmark: CompetitorBenchmark;
  synthesis?: CompetitorSynthesisMetrics | null;
  quickAnswer: string | null;
  knowledgeCoverage?: KnowledgeCoverageReport | null;
}): ValidationResult {
  const coverage = opts.knowledgeCoverage
    ?? (opts.outline
      ? computeKnowledgeCoverage({ kg: opts.kg, outline: opts.outline, briefs: opts.briefs })
      : null);

  const parts = [
    validateAgainstBenchmark({
      blueprint: opts.blueprint,
      outline: opts.outline,
      benchmark: opts.benchmark,
      synthesis: opts.synthesis,
      kg: opts.kg,
    }),
    validateKnowledgeCoverageGate(coverage),
    validateWordBudgetAlignment(opts.briefs, opts.blueprint.budget.words),
    validateQuickAnswer(opts.quickAnswer),
    validateMustAnswerComplete(opts.briefs),
    validateRequiredAssignments({ kg: opts.kg, outline: opts.outline }),
  ];
  const issues = parts.flatMap((p) => p.issues);
  return { ok: issues.length === 0, issues };
}
