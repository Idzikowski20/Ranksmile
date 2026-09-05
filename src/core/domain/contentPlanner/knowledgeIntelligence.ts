/**
 * Knowledge Intelligence — merge competitor + AI claims into Target KG.
 *
 * Also the one place page chrome is filtered out. Claims arrive from three routes —
 * the sidecar's structural extraction, `score_data.competitor_claims` replayed by
 * enrichWithCorpusClaims, and AI Search — and only the first ever ran a noise check.
 * Opening hours, bylines, breadcrumbs and stock-photo credits therefore reached reviewed
 * outlines as "Cover: …" instructions. Every route funnels through the loop below, so
 * the guard belongs here rather than in each caller.
 *
 * The claim variant, not the sentence one: a claim is a fragment ("Kara do 2 lat."), and
 * the sentence guards drop anything under 20 characters or 4 words — which would have
 * quietly emptied the knowledge graph of its shortest facts.
 */
import { isCorpusNoiseClaim } from '@/src/core/domain/corpus/corpusNoiseFilter';
import type {
  ClaimImportance,
  GainClass,
  PriorityClass,
  TargetClaim,
  TargetKnowledgeGraph,
  TargetQuestion,
 CompetitorProfile } from '@/src/core/domain/contentPlanner/types';

export type AiSearchIntelInput = {
  answers?: string[];
  claims?: string[];
  questions?: string[];
  sources?: Array<{ url: string; label?: string; confidence?: number }>;
};

/** Surfer's guideline for the test keyword grades 37 facts; 40 leaves headroom. */
const MAX_TARGET_CLAIMS = 40;

function slugId(prefix: string, text: string, i: number): string {
  const base = text.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-').slice(0, 40);
  // Always append index so long/punctuation-variant collisions cannot overwrite map keys.
  return `${prefix}-${base || 'x'}-${i}`;
}

function sourceConfidence(url: string): number {
  const u = url.toLowerCase();
  if (/developers\.google|support\.google|google\.com\/search/.test(u)) return 1;
  if (/ahrefs|semrush|moz\.com/.test(u)) return 0.95;
  if (/searchengineland|searchenginejournal|surferseo/.test(u)) return 0.9;
  return 0.55;
}

export function classifyGain(
  claimNorm: string,
  competitorCount: number,
  claimCounts: Map<string, number>,
): GainClass {
  const c = claimCounts.get(claimNorm) || 0;
  if (competitorCount <= 0) return 'expected';
  const ratio = c / competitorCount;
  if (ratio >= 0.6) return 'core';
  if (ratio >= 0.25) return 'expected';
  return 'opportunity';
}

/**
 * A claim survives extraction only if it says something about the topic, so every class
 * is required — including `core`, which used to be `nice_to_have`: what most of the SERP
 * states is the last thing an article can skip. Gain separates claims by priority below,
 * not by whether they are needed at all.
 */
export function importanceFromGain(g: GainClass): ClaimImportance {
  return g === 'core' || g === 'expected' || g === 'opportunity' ? 'required' : 'nice_to_have';
}

/**
 * `critical` is the hard gate: the planner refuses to write when one is left unassigned.
 * It therefore has to mean something, and `opportunity` does not.
 *
 * `classifyGain` counts how many competitors state a claim, matched as normalised whole
 * sentences — and two sites never phrase a sentence identically. Measured on a real SERP
 * (5 competitors, 58 claims) the split was `opportunity` 58, `core` 0, `expected` 0. So
 * "appears on few pages" was not a differentiator, it was the absence of a signal, and it
 * promoted every single claim to critical. The outline holds 7 sections × 8 claims = 56,
 * and generation then failed on the two that did not fit — an arithmetic overflow reported
 * as a knowledge gap.
 *
 * Consensus still earns `critical` when it is actually observed. Everything else stays
 * `required`, so the claim budget and the 95% knowledge-coverage gate are unchanged — that
 * gate measures a ratio and is the check with data behind it.
 */
export function priorityFromGainAndImportance(
  g: GainClass,
  imp: ClaimImportance,
): PriorityClass {
  if (imp === 'required' && g === 'core') return 'critical';
  if (imp === 'required') return 'high';
  if (imp === 'nice_to_have') return 'medium';
  return 'low';
}

export function buildTargetKnowledgeGraph(opts: {
  profiles: CompetitorProfile[];
  ai?: AiSearchIntelInput;
  paaQuestions?: string[];
}): TargetKnowledgeGraph {
  const { profiles, ai, paaQuestions = [] } = opts;
  const claimCounts = new Map<string, number>();
  for (const p of profiles) {
    const seen = new Set<string>();
    for (const c of p.claims) {
      const k = c.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      claimCounts.set(k, (claimCounts.get(k) || 0) + 1);
    }
  }
  // Gain-frequency stays competitor-only — AI claims must not inflate core promotion.

  // AI-engine facts BEFORE competitor sentences. The reference tool's fact pool is what
  // the engines cite — atomic, sourced statements — and its articles are written from
  // those, not from prose scraped off ranking pages. Inserting AI facts first means that
  // when both routes carry the same statement, the clean phrasing survives the dedup
  // instead of whichever sentence a competitor page happened to word it as.
  const statements = new Map<string, string>();
  const claimHasAi = new Set<string>();
  for (const c of ai?.claims ?? []) {
    if (isCorpusNoiseClaim(c)) continue;
    const k = c.trim().toLowerCase();
    if (!k) continue;
    claimHasAi.add(k);
    if (!statements.has(k)) statements.set(k, c.trim());
  }
  for (const p of profiles) {
    for (const c of p.claims) {
      if (isCorpusNoiseClaim(c)) continue;
      const k = c.trim().toLowerCase();
      if (k && !statements.has(k)) statements.set(k, c.trim());
    }
  }

  const aiSources = (ai?.sources ?? []).map((s) => ({
    url: s.url,
    label: s.label || s.url,
    confidence: s.confidence ?? sourceConfidence(s.url),
  }));

  const allClaims: TargetClaim[] = [];
  let i = 0;
  for (const [norm, statement] of statements) {
    const gainClass = classifyGain(norm, profiles.length, claimCounts);
    const importance = importanceFromGain(gainClass);
    const priority = priorityFromGainAndImportance(gainClass, importance);
    allClaims.push({
      id: slugId('claim', norm, i++),
      statement,
      topic: statement.split(/\s+/).slice(0, 3).join(' ').toLowerCase(),
      type: /%|\d/.test(statement) ? 'stat' : 'fact',
      importance,
      gainClass,
      priority,
      // AI citation URLs only for claims backed by AI evidence.
      sources: claimHasAi.has(norm) ? aiSources.slice(0, 3) : [],
      citationHint: profiles.find((p) => p.claims.some((x) => x.toLowerCase() === norm))?.url,
    });
  }

  // Surfer-sized pool. The reference guideline grades ~37 facts; article 147's plan
  // carried 75 claims and the surplus was scraped competitor prose — the writer covered
  // it all, verbatim. AI-engine facts are the grading standard so they are never cut;
  // scraped claims fill the remaining budget best-consensus-first.
  const gainRank: Record<GainClass, number> = { core: 0, expected: 1, opportunity: 2 };
  const aiBacked = allClaims.filter((c) => claimHasAi.has(c.statement.trim().toLowerCase()));
  const scraped = allClaims
    .filter((c) => !claimHasAi.has(c.statement.trim().toLowerCase()))
    .sort((a, b) => gainRank[a.gainClass] - gainRank[b.gainClass]);
  const claims = [
    ...aiBacked,
    ...scraped.slice(0, Math.max(0, MAX_TARGET_CLAIMS - aiBacked.length)),
  ];

  const qSet = new Map<string, string>();
  for (const p of profiles) {
    for (const q of p.questions) {
      const k = q.trim().toLowerCase();
      if (k) qSet.set(k, q.trim());
    }
  }
  for (const q of [...(ai?.questions ?? []), ...paaQuestions]) {
    const k = q.trim().toLowerCase();
    if (k) qSet.set(k, q.trim());
  }

  const questions: TargetQuestion[] = [];
  let qi = 0;
  for (const [, question] of qSet) {
    questions.push({
      id: slugId('q', question, qi++),
      question,
      requiredAnswerBrief: `Odpowiedz konkretnie na: ${question}`,
      importance: 'required',
      priority: qi <= 8 ? 'critical' : 'high',
      answeredByClaimIds: [],
      status: 'missing',
    });
  }

  const entities = [
    ...new Set(profiles.flatMap((p) => p.entities).map((e) => e.trim()).filter(Boolean)),
  ].slice(0, 80);

  return { claims, questions, entities };
}

/** Apply Priority Engine ordering for Blueprint quotas. */
export function applyPriorityOrder(kg: TargetKnowledgeGraph): TargetKnowledgeGraph {
  const rank: Record<PriorityClass, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return {
    ...kg,
    claims: [...kg.claims].sort((a, b) => rank[a.priority] - rank[b.priority]),
    questions: [...kg.questions].sort((a, b) => rank[a.priority] - rank[b.priority]),
  };
}
