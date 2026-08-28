import { createHash } from 'crypto';
import type { EmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
import { getEmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
import { semanticMatchScore } from './semanticMatch';
import { CANONICALIZE_SIM_MIN, OFFICIAL_DOMAINS, SOURCE_TIER_WEIGHTS } from './constants';
import type {
  CanonicalClaim,
  ClaimEvidence,
  GeneratedFrom,
  PriorityClass,
  SourceDiversity,
  SourceKind,
} from '@/src/core/domain/knowledgeEngine/types';
import type { RawSentence } from './extract';

export type CanonicalizeInput = {
  text: string;
  url: string;
  kind: SourceKind;
  serpPosition?: number;
  title?: string;
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export function claimId(statement: string): string {
  return `CLAIM_${createHash('sha1').update(statement.toLowerCase()).digest('hex').slice(0, 8)}`;
}

function isOfficialHost(hostname: string, official: string): boolean {
  return hostname === official || hostname.endsWith(`.${official}`);
}

function inferKind(url: string, kind: SourceKind): SourceKind {
  const d = domainOf(url);
  if (OFFICIAL_DOMAINS.some((o) => isOfficialHost(d, o))) return 'official';
  return kind;
}

export function diversityFromEvidence(evidence: ClaimEvidence[]): SourceDiversity {
  const official = evidence.some((e) => e.kind === 'official');
  const competitors = evidence.some((e) => e.kind === 'competitor' || e.kind === 'industry');
  const aiOverview = evidence.some((e) => e.kind === 'ai_overview');
  const paa = evidence.some((e) => e.kind === 'paa');
  const n = [official, competitors, aiOverview, paa].filter(Boolean).length;
  return { official, competitors, aiOverview, paa, score: n / 4 };
}

export function generatedFromEvidence(evidence: ClaimEvidence[]): GeneratedFrom[] {
  const set = new Set<GeneratedFrom>();
  for (const e of evidence) {
    if (e.kind === 'official') set.add('official');
    else if (e.kind === 'paa') set.add('paa');
    else if (e.kind === 'ai_overview') set.add('ai_overview');
    else if (e.kind === 'industry') set.add('industry');
    else set.add('serp');
  }
  return [...set];
}

export function importanceScoreHeuristic(statement: string, evidenceCount: number): number {
  let score = 40 + Math.min(40, evidenceCount * 12);
  if (/ssl|mobile-first|core web vitals|search console|robots\.txt|schema/i.test(statement)) {
    score += 15;
  }
  return Math.min(100, Math.max(0, score));
}

export function importanceLabel(score: number): PriorityClass {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function toEvidence(input: CanonicalizeInput): ClaimEvidence {
  const kind = inferKind(input.url, input.kind);
  const domain = domainOf(input.url);
  return {
    kind,
    url: input.url,
    domain,
    favicon: faviconFor(domain),
    title: input.title || domain,
    weight: SOURCE_TIER_WEIGHTS[kind],
    roles: kind === 'official' ? ['official'] : ['serp'],
    serpPositions: input.serpPosition ? [input.serpPosition] : undefined,
  };
}

/** Figures, statutes, model names, capitalised institutions — what makes a claim usable. */
function specificity(statement: string): number {
  let score = 0;
  if (/\d/.test(statement)) score += 2;
  // Proper nouns mid-sentence: MSWiA, KRS, ST-400, Kodeksu Karnego.
  if (/(?<=\s)[A-ZĄĆĘŁŃÓŚŹŻ][\wĄĆĘŁŃÓŚŹŻąćęłńóśźż-]{2,}/.test(statement)) score += 1;
  if (/\b(art|ust|§|ustaw\w+|rozporządzeni\w+|kodeks\w*)\b/i.test(statement)) score += 2;
  return score;
}

/**
 * Which of two paraphrases should represent the cluster.
 *
 * This used to keep the SHORTEST member, on the theory that the tersest phrasing is the
 * cleanest. On real SERPs it does the opposite: the shortest paraphrase is the one that
 * dropped the figures. "Ich zakres usług jest bardzo szeroki." beat every sentence naming
 * an actual service, and article 15 shipped 98 claims carrying three digits between them.
 * Prefer the member that kept the specifics; fall back to the shorter phrasing only when
 * neither is more concrete.
 */
function isMoreSpecific(candidate: string, current: string): boolean {
  const diff = specificity(candidate) - specificity(current);
  if (diff !== 0) return diff > 0;
  return candidate.length < current.length;
}

export async function canonicalizeClaims(
  inputs: CanonicalizeInput[],
  opts?: { provider?: EmbeddingProvider },
): Promise<CanonicalClaim[]> {
  const provider = opts?.provider ?? getEmbeddingProvider();
  const clusters: Array<{ statement: string; members: CanonicalizeInput[] }> = [];

  for (const input of inputs) {
    const text = input.text.trim();
    if (text.length < 20) continue;
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < clusters.length; i++) {
      const sim = await semanticMatchScore(text, clusters[i].statement, provider);
      if (sim >= CANONICALIZE_SIM_MIN && sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      clusters[bestIdx].members.push(input);
      if (isMoreSpecific(text, clusters[bestIdx].statement)) {
        clusters[bestIdx].statement = text;
      }
    } else {
      clusters.push({ statement: text, members: [input] });
    }
  }

  return clusters.map((c) => {
    const evidence = c.members.map(toEvidence);
    const sourceDiversity = diversityFromEvidence(evidence);
    const importanceScore = importanceScoreHeuristic(c.statement, evidence.length);
    return {
      id: claimId(c.statement),
      statement: c.statement,
      cluster: 'Unassigned',
      importance: importanceLabel(importanceScore),
      importanceScore,
      consensus: 0,
      evidence,
      usedByCompetitors: 0,
      competitorsTotal: 0,
      usedInSections: [],
      generatedFrom: generatedFromEvidence(evidence),
      sourceDiversity,
      consensusExplanation: { percent: 0, because: [] },
    };
  });
}

export function sentencesToCanonicalizeInputs(sentences: RawSentence[]): CanonicalizeInput[] {
  return sentences.map((s) => ({
    text: s.text,
    url: s.url,
    kind: s.kind || 'competitor',
    serpPosition: s.serpPosition || undefined,
  }));
}
