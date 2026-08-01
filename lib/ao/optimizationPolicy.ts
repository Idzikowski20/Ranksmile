/**
 * v4.1 OptimizationPolicy — strategy + gate + budgets in one place.
 * Strategies change policy only; all use runPrecisionOptimizeV4.
 */
import type { EditBudget } from './editBudget';
import {
  DEFAULT_EDIT_BUDGET,
  DEEP_EDIT_BUDGET,
  ENRICHMENT_EDIT_BUDGET,
  PRECISION_SECTION_BUDGET,
} from './editBudget';
import type { ScoreGatePolicy } from './aoScoreDelta';
import {
  DEEP_SCORE_GATE_POLICY,
  ENRICHMENT_SCORE_GATE_POLICY,
  STRICT_SCORE_GATE_POLICY,
} from './aoScoreDelta';
import type { AoScores } from './aoScoreDelta';
import { TARGET_AI, TARGET_SEO } from '../optimizeMode';
import { countWordsFromHtml } from './aoBaseline';

export type OptimizationStrategy =
  | 'precision'
  | 'enrichment'
  | 'deep_optimize'
  | 'whole_article_fallback';

export type StructuralHealth = 'strong' | 'acceptable' | 'weak';
export type IntentFitLevel = 'strong' | 'acceptable' | 'weak';

export type OptimizationPolicy = {
  strategy: OptimizationStrategy;
  gate: ScoreGatePolicy;
  maxSteps: number;
  editBudget: EditBudget;
  allowNewHeading: boolean;
  faq: { enabled: boolean; maxQuestions: number };
  seoStrong: boolean;
  aiWeak: boolean;
};

export function resolveOptimizationStrategy(
  raw: unknown,
  envFlag?: string,
): OptimizationStrategy {
  if (raw === 'whole_article_fallback') return 'whole_article_fallback';
  if (envFlag === '1' || envFlag === 'true') return 'whole_article_fallback';
  if (raw === 'enrichment' || raw === 'deep_optimize' || raw === 'precision') {
    return raw;
  }
  return 'precision'; // default; policy resolver overrides by diagnosis
}

export function assessStructuralHealth(html: string, sectionCount: number): StructuralHealth {
  const words = countWordsFromHtml(html);
  const h2 = (html.match(/<h2\b/gi) || []).length;
  // Weighted evidence — short alone ≠ deep (concise answers OK)
  let score = 0;
  if (words >= 800) score += 2;
  else if (words >= 400) score += 1;
  if (h2 >= 3 || sectionCount >= 3) score += 2;
  else if (h2 >= 1 || sectionCount >= 2) score += 1;
  if (score >= 3) return 'strong';
  if (score >= 1) return 'acceptable';
  return 'weak';
}

export function assessIntentFit(opts: {
  intentFitAvg?: number;
  keyword?: string;
  plainText?: string;
}): IntentFitLevel {
  const fit = opts.intentFitAvg;
  if (fit != null) {
    if (fit >= 0.65) return 'strong';
    if (fit >= 0.45) return 'acceptable';
    return 'weak';
  }
  const kw = (opts.keyword || '').toLowerCase().trim();
  const plain = (opts.plainText || '').toLowerCase();
  if (!kw) return 'acceptable';
  if (plain.includes(kw)) return 'strong';
  const tokens = kw.split(/\s+/).filter((w) => w.length > 3);
  const hits = tokens.filter((t) => plain.includes(t)).length;
  if (tokens.length && hits / tokens.length >= 0.5) return 'acceptable';
  return 'weak';
}

export function countHighValueGaps(opts: {
  uncoveredCoverage: number;
  criticalDefsMissing: number;
}): number {
  return opts.uncoveredCoverage + opts.criticalDefsMissing * 2;
}

/**
 * Multi-signal routing. Explicit whole_article handled by caller before this
 * when already_optimal is false.
 */
export function chooseStrategyFromDiagnosis(opts: {
  scores: AoScores;
  structural: StructuralHealth;
  intent: IntentFitLevel;
  highValueGaps: number;
}): OptimizationStrategy {
  const { scores, structural, intent, highValueGaps } = opts;
  const seoStrong = Math.round(scores.seo) >= 85;
  const aiWeak = Math.round(scores.ai) < TARGET_AI;
  const content = Math.round(scores.content);

  // SEO strong + AI weak → precision (AI-focused), never NLP dump enrichment
  if (seoStrong && aiWeak) return 'precision';

  if (content >= 85 && highValueGaps <= 2) return 'precision';

  if (
    content >= 60
    && (structural === 'strong' || structural === 'acceptable')
    && (intent === 'strong' || intent === 'acceptable')
  ) {
    return 'enrichment';
  }

  // Weak scores stay on deep_optimize (section dual-gate + SEO fallback).
  // Auto whole_article_fallback produced thin one-shot rewrites (SEO~58/AI~28)
  // vs section path that previously reached SEO~90 — keep whole_article explicit/flag only.
  return 'deep_optimize';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function resolveOptimizationPolicy(opts: {
  strategy?: OptimizationStrategy;
  scores: AoScores;
  html: string;
  sectionCount: number;
  uncoveredCoverage: number;
  criticalDefsMissing?: number;
  keyword?: string;
  plainText?: string;
}): OptimizationPolicy {
  const structural = assessStructuralHealth(opts.html, opts.sectionCount);
  const intent = assessIntentFit({
    keyword: opts.keyword,
    plainText: opts.plainText,
  });
  const highValueGaps = countHighValueGaps({
    uncoveredCoverage: opts.uncoveredCoverage,
    criticalDefsMissing: opts.criticalDefsMissing ?? 0,
  });

  let strategy = opts.strategy;
  if (!strategy || strategy === 'precision') {
    // Re-diagnose unless explicitly enrichment/deep/whole from caller
    if (!opts.strategy) {
      strategy = chooseStrategyFromDiagnosis({
        scores: opts.scores,
        structural,
        intent,
        highValueGaps,
      });
    } else {
      strategy = opts.strategy;
    }
  }

  const seoStrong = Math.round(opts.scores.seo) >= 85;
  const aiWeak = Math.round(opts.scores.ai) < TARGET_AI;
  const workUnits = opts.sectionCount + highValueGaps + (structural === 'weak' ? 3 : 0);

  if (strategy === 'whole_article_fallback') {
    return {
      strategy,
      gate: DEEP_SCORE_GATE_POLICY,
      maxSteps: 2,
      editBudget: DEEP_EDIT_BUDGET,
      allowNewHeading: true,
      faq: { enabled: true, maxQuestions: 5 },
      seoStrong,
      aiWeak,
    };
  }

  if (strategy === 'deep_optimize') {
    const maxSteps = clamp(12 + Math.floor(workUnits / 3), 12, 20);
    return {
      strategy,
      gate: DEEP_SCORE_GATE_POLICY,
      maxSteps,
      editBudget: DEEP_EDIT_BUDGET,
      allowNewHeading: true,
      faq: { enabled: true, maxQuestions: 5 },
      seoStrong,
      aiWeak,
    };
  }

  if (strategy === 'enrichment') {
    const maxSteps = clamp(8 + Math.floor(workUnits / 4), 8, 12);
    return {
      strategy,
      gate: ENRICHMENT_SCORE_GATE_POLICY,
      maxSteps,
      editBudget: ENRICHMENT_EDIT_BUDGET,
      allowNewHeading: true,
      faq: { enabled: true, maxQuestions: 5 },
      seoStrong,
      aiWeak,
    };
  }

  // precision — targeted (may substantial-rewrite); smaller default steps
  const maxSteps = clamp(3 + Math.min(3, highValueGaps), 3, 6);
  return {
    strategy: 'precision',
    gate: STRICT_SCORE_GATE_POLICY,
    maxSteps,
    editBudget: seoStrong && aiWeak ? PRECISION_SECTION_BUDGET : DEFAULT_EDIT_BUDGET,
    allowNewHeading: seoStrong && aiWeak,
    faq: { enabled: highValueGaps > 0, maxQuestions: 3 },
    seoStrong,
    aiWeak,
  };
}

export { TARGET_SEO, TARGET_AI };
