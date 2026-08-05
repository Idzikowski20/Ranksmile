/**
 * Knowledge Intelligence — merge competitor + AI claims into Target KG.
 */
import type {
  ClaimImportance,
  GainClass,
  PriorityClass,
  TargetClaim,
  TargetKnowledgeGraph,
  TargetQuestion,
} from './types';
import type { CompetitorProfile } from './types';

export type AiSearchIntelInput = {
  answers?: string[];
  claims?: string[];
  questions?: string[];
  sources?: Array<{ url: string; label?: string; confidence?: number }>;
};

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

export function importanceFromGain(g: GainClass): ClaimImportance {
  if (g === 'opportunity') return 'required';
  if (g === 'expected') return 'required';
  return 'nice_to_have';
}

export function priorityFromGainAndImportance(
  g: GainClass,
  imp: ClaimImportance,
): PriorityClass {
  if (imp === 'required' && g === 'opportunity') return 'critical';
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

  const statements = new Map<string, string>();
  const claimHasAi = new Set<string>();
  for (const p of profiles) {
    for (const c of p.claims) {
      const k = c.trim().toLowerCase();
      if (k && !statements.has(k)) statements.set(k, c.trim());
    }
  }
  for (const c of ai?.claims ?? []) {
    const k = c.trim().toLowerCase();
    if (!k) continue;
    claimHasAi.add(k);
    if (!statements.has(k)) statements.set(k, c.trim());
  }

  const aiSources = (ai?.sources ?? []).map((s) => ({
    url: s.url,
    label: s.label || s.url,
    confidence: s.confidence ?? sourceConfidence(s.url),
  }));

  const claims: TargetClaim[] = [];
  let i = 0;
  for (const [norm, statement] of statements) {
    const gainClass = classifyGain(norm, profiles.length, claimCounts);
    const importance = importanceFromGain(gainClass);
    const priority = priorityFromGainAndImportance(gainClass, importance);
    claims.push({
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
