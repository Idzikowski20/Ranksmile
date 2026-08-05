/**
 * WIE Policy Resolver — decision API (not a prompt dump).
 * Shared brain for Writer / Judge: same principles + patterns → decision bundle.
 */
import {
  readPatternStore,
  scorePatternForContext,
  applyConfidenceDecay,
  persistConfidenceDecay,
  type WritingPattern,
} from './patternStore';
import { WRITING_PRINCIPLES } from './principles';
import type { ReaderBrief } from './readerBrief';
import type { CompetitorSynthesis } from './competitorSynthesis';
import { pickDnaAbPattern } from './dnaAb';

export type PolicyContext = {
  keyword: string;
  industry: string;
  emotion: string;
  searchIntent: string;
  contentShape?: string;
};

export type PolicyDecision = {
  id: string;
  value: string;
  confidence: number;
  effectiveness: number;
  source_layer: WritingPattern['layer'] | 'principle' | 'synthesis';
  pattern_id?: string;
  principle_id?: string;
  reason: string;
  dna_version: number;
};

export type PolicyBundle = {
  decisions: PolicyDecision[];
  patternIdsUsed: string[];
  dna_version: number;
  /** Present when opening chose between competing DNA patterns */
  dna_ab_variant?: 'A' | 'B';
  dna_ab_reason?: string;
};

const LEGAL_RE = /szantaż|detektyw|prawn|kodeks|rozwod|aliment|krymina|adwokat|notariusz|legal|lawyer|blackmail/i;
const SEO_RE = /seo|canonical|backlink|ahrefs|serp|keyword|content marketing/i;
const HEALTH_RE = /zdrow|chorob|lekar|objawy|health|symptom|diet/i;
const FINANCE_RE = /kredyt|podatek|inwest|bank|finance|tax|loan/i;

export function inferIndustry(keyword: string, title = ''): string {
  const blob = `${keyword} ${title}`;
  if (LEGAL_RE.test(blob)) return 'Legal';
  if (SEO_RE.test(blob)) return 'SeoSaas';
  if (HEALTH_RE.test(blob)) return 'Health';
  if (FINANCE_RE.test(blob)) return 'Finance';
  return 'General';
}

export function buildPolicyContext(opts: {
  keyword: string;
  title?: string;
  readerBrief?: ReaderBrief | null;
  synthesis?: CompetitorSynthesis | null;
}): PolicyContext {
  const industry = inferIndustry(opts.keyword, opts.title);
  const emotion = opts.readerBrief?.emotion
    || (opts.synthesis?.opening_style?.emotion === 'high' ? 'high' : 'medium');
  const searchIntent = opts.readerBrief?.searchIntent || 'informational';
  const contentShape =
    industry === 'SeoSaas' && opts.synthesis?.opening_style?.definition_first
      ? 'technical_canonical'
      : undefined;
  return {
    keyword: opts.keyword,
    industry,
    emotion,
    searchIntent,
    contentShape,
  };
}

function bestPattern(
  patterns: WritingPattern[],
  ctx: PolicyContext,
  predicate: (p: WritingPattern) => boolean,
): { pattern: WritingPattern; score: number } | null {
  let best: { pattern: WritingPattern; score: number } | null = null;
  for (const p of patterns) {
    if (!predicate(p)) continue;
    const s = scorePatternForContext(p, ctx);
    if (s == null) continue;
    if (!best || s > best.score) best = { pattern: p, score: s };
  }
  return best;
}

/** Resolve opening + examples + voice into a compact decision bundle. */
export async function resolvePolicyBundle(opts: {
  ctx: PolicyContext;
  synthesis?: CompetitorSynthesis | null;
}): Promise<PolicyBundle> {
  const store = await readPatternStore();
  void persistConfidenceDecay();
  const decisions: PolicyDecision[] = [];
  const patternIdsUsed: string[] = [];
  let dnaAbVariant: 'A' | 'B' | undefined;
  let dnaAbReason: string | undefined;

  const p0 = WRITING_PRINCIPLES[0];
  decisions.push({
    id: 'principle_primary',
    value: p0.statement,
    confidence: 1,
    effectiveness: 1,
    source_layer: 'principle',
    principle_id: p0.id,
    reason: 'Immutable writing principle',
    dna_version: store.dna_version,
  });

  const problemPat = bestPattern(
    store.patterns,
    opts.ctx,
    (p) => /problem before definition/i.test(p.pattern),
  );
  const definitionPat = bestPattern(
    store.patterns,
    opts.ctx,
    (p) => /definition first/i.test(p.pattern),
  );

  let opening: { pattern: WritingPattern; score: number } | null = null;
  if (problemPat && definitionPat) {
    const ab = pickDnaAbPattern(problemPat, definitionPat);
    opening = {
      pattern: ab.winner,
      score: ab.winner === problemPat.pattern ? problemPat.score : definitionPat.score,
    };
    dnaAbVariant = ab.variant;
    dnaAbReason = ab.reason;
  } else {
    opening = problemPat || definitionPat;
  }

  let openingValue = 'problem_first';
  let openingSrc: PolicyDecision['source_layer'] = 'global';
  let openingReason = 'Default for informational content';
  let openingConf = 0.6;
  let openingEff = 0.5;
  let openingPatternId: string | undefined;

  if (opening) {
    openingValue = /definition first/i.test(opening.pattern.pattern) ? 'definition_first' : 'problem_first';
    openingSrc = opening.pattern.layer;
    openingReason = dnaAbReason || opening.pattern.reason;
    openingConf = applyConfidenceDecay(opening.pattern);
    openingEff = opening.pattern.effectiveness.success_rate;
    openingPatternId = opening.pattern.id;
    patternIdsUsed.push(opening.pattern.id);
  } else if (opts.synthesis?.opening_style?.definition_first && !opts.synthesis.opening_style.problem_first) {
    openingValue = 'definition_first';
    openingSrc = 'synthesis';
    openingReason = 'Competitor synthesis favors definition-first';
    openingConf = 0.7;
  } else if (opts.synthesis?.opening_style?.problem_first) {
    openingValue = 'problem_first';
    openingSrc = 'synthesis';
    openingReason = 'Competitor synthesis favors problem-first';
    openingConf = 0.75;
  }

  decisions.push({
    id: 'opening',
    value: openingValue,
    confidence: openingConf,
    effectiveness: openingEff,
    source_layer: openingSrc,
    pattern_id: openingPatternId,
    principle_id: 'answer_user_problem_first',
    reason: openingReason,
    dna_version: store.dna_version,
  });

  const ex = bestPattern(store.patterns, opts.ctx, (p) => /example/i.test(p.pattern));
  if (ex) {
    patternIdsUsed.push(ex.pattern.id);
    decisions.push({
      id: 'examples_min',
      value: '1',
      confidence: applyConfidenceDecay(ex.pattern),
      effectiveness: ex.pattern.effectiveness.success_rate,
      source_layer: ex.pattern.layer,
      pattern_id: ex.pattern.id,
      principle_id: ex.pattern.principle_id,
      reason: ex.pattern.reason,
      dna_version: store.dna_version,
    });
  }

  const voice = bestPattern(store.patterns, opts.ctx, (p) => /expert voice/i.test(p.pattern));
  if (voice) {
    patternIdsUsed.push(voice.pattern.id);
    decisions.push({
      id: 'expert_voice',
      value: 'use_markers',
      confidence: applyConfidenceDecay(voice.pattern),
      effectiveness: voice.pattern.effectiveness.success_rate,
      source_layer: voice.pattern.layer,
      pattern_id: voice.pattern.id,
      principle_id: voice.pattern.principle_id,
      reason: voice.pattern.reason,
      dna_version: store.dna_version,
    });
  }

  return {
    decisions,
    patternIdsUsed: [...new Set(patternIdsUsed)],
    dna_version: store.dna_version,
    dna_ab_variant: dnaAbVariant,
    dna_ab_reason: dnaAbReason,
  };
}

/** Compact POLICY block for Writer prompt + explainability. */
export function formatPolicyBundleForPrompt(bundle: PolicyBundle | null | undefined): string {
  if (!bundle?.decisions.length) return '';
  const lines = ['POLICY (Writing Intelligence — follow these decisions):'];
  for (const d of bundle.decisions) {
    lines.push(
      `- ${d.id}: ${d.value} (conf ${(d.confidence * 100).toFixed(0)}%, `
      + `eff ${(d.effectiveness * 100).toFixed(0)}%, ${d.source_layer}) — ${d.reason}`,
    );
  }
  lines.push('- Do not violate principles. Patterns refine how, not whether.');
  return lines.join('\n');
}
