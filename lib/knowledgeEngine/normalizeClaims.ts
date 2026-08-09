/**
 * Claim Normalization — turn scraped sentences into atomic, source-neutral facts.
 *
 * Canonicalize is extractive: a claim is whichever competitor sentence survived
 * clustering, so the graph inherits their voice, their brand and their page furniture.
 * The reference tool's "FACTS TO INCLUDE" are clearly abstractive — short third-person
 * statements grouped under a topic, each carrying the sources that back it.
 *
 * This stage closes that gap, and closes the consensus gap with it. The hash-bag
 * embedder scores true paraphrases around 0.42 against a 0.82 merge threshold, so
 * `canonicalizeClaims` merges only near-identical strings and every claim reaches the
 * planner with a single source. Asking the model which inputs say the same thing merges
 * them properly, so evidence counts — and the importance ladder built on them — finally
 * mean something.
 *
 * Injected completion, not a direct provider call: `llmGateway` reaches the database for
 * cost telemetry, and importing it here would pull sequelize into every knowledgeEngine
 * unit test. The caller wires the gateway; this module stays pure.
 */
import {
  claimId,
  diversityFromEvidence,
  generatedFromEvidence,
  importanceLabel,
  importanceScoreHeuristic,
} from './canonicalize';
import type { CanonicalClaim, ClaimEvidence } from './types';

/** Returns raw model text; the caller owns provider choice, retries and telemetry. */
export type ClaimCompletion = (prompt: string) => Promise<string>;

/** Beyond this the prompt stops paying for itself and risks a truncated reply. */
const MAX_INPUT_CLAIMS = 80;
/**
 * A reply that accounts for less of the input than this is treated as truncated rather
 * than as the model judging the rest worthless — dropping claims on a `finish_reason:
 * length` would quietly gut the graph, and the planner's coverage gates would then fail
 * for a reason no diagnostic points at.
 */
const MIN_INPUT_COVERAGE = 0.5;

type ModelFact = { statement?: unknown; topic?: unknown; from?: unknown };

export function buildNormalizePrompt(statements: string[]): string {
  const numbered = statements.map((s, i) => `${i}. ${s}`).join('\n');
  return `You are a research editor building a fact sheet for a writer.

Below are numbered sentences scraped from pages that rank for one keyword. Rewrite them
into a deduplicated fact sheet.

Rules:
- Write every fact in the SAME LANGUAGE as the input sentences.
- Third person, neutral. No "we", no "our", no address to the reader, no imperatives, no
  brand names or personal names of the scraped companies, no testimonials.
- KEEP every figure, statute, institution, standard and product name exactly as written.
  A fact that drops the specifics is worthless.
- ONE fact states ONE thing. Never join unrelated points into a compound sentence —
  two separate points are two entries, each with its own "from".
- Merge only sentences that state the SAME thing; list all their numbers in "from".
- Drop sentences that are marketing, navigation or contact details.
- Group the facts under 5-10 topics and REUSE each topic label across its related facts.
  A topic is a short noun phrase naming a subject area, not a restatement of one fact.

Return ONLY JSON: {"facts":[{"statement":"...","topic":"...","from":[0,4]}]}

SENTENCES:
${numbered}`;
}

function parseFacts(raw: string): ModelFact[] {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = (fence ? fence[1] : raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== 'object' || parsed === null) return [];
    const { facts } = parsed as { facts?: unknown };
    return Array.isArray(facts) ? (facts as ModelFact[]) : [];
  } catch {
    return [];
  }
}

/** Same URL from two input claims is one source, not two votes. */
function mergeEvidence(claims: CanonicalClaim[]): ClaimEvidence[] {
  const byUrl = new Map<string, ClaimEvidence>();
  for (const claim of claims) {
    for (const e of claim.evidence) {
      if (!byUrl.has(e.url)) byUrl.set(e.url, e);
    }
  }
  return [...byUrl.values()];
}

function toClaim(statement: string, topic: string, members: CanonicalClaim[]): CanonicalClaim {
  const evidence = mergeEvidence(members);
  const importanceScore = importanceScoreHeuristic(statement, evidence.length);
  return {
    id: claimId(statement),
    statement,
    cluster: topic || 'Unassigned',
    importance: importanceLabel(importanceScore),
    importanceScore,
    consensus: 0,
    evidence,
    usedByCompetitors: 0,
    competitorsTotal: 0,
    usedInSections: [],
    generatedFrom: generatedFromEvidence(evidence),
    sourceDiversity: diversityFromEvidence(evidence),
    consensusExplanation: { percent: 0, because: [] },
  };
}

/**
 * Fail-soft by construction: no completion, too few claims, an unparseable reply or a
 * short one all return the input untouched. A degraded knowledge graph beats none, and
 * this stage runs inside article generation where an exception costs the user a run.
 */
export async function normalizeClaims(
  claims: CanonicalClaim[],
  complete?: ClaimCompletion | null,
): Promise<CanonicalClaim[]> {
  if (!complete || claims.length < 3) return claims;

  const input = claims.slice(0, MAX_INPUT_CLAIMS);
  let facts: ModelFact[];
  try {
    facts = parseFacts(await complete(buildNormalizePrompt(input.map((c) => c.statement))));
  } catch (err: unknown) {
    console.warn('[knowledgeEngine] claim normalization failed:', err);
    return claims;
  }
  if (!facts.length) return claims;

  const used = new Set<number>();
  const out: CanonicalClaim[] = [];
  const seenIds = new Set<string>();

  for (const fact of facts) {
    const statement = typeof fact.statement === 'string' ? fact.statement.replace(/\s+/g, ' ').trim() : '';
    const from = (Array.isArray(fact.from) ? fact.from : []).filter(
      (i): i is number => typeof i === 'number',
    );
    // A fact pointing at no input sentence is one the model invented rather than
    // rewrote, and nothing in the graph would back it.
    const members = from.map((i) => input[i]).filter((c): c is CanonicalClaim => Boolean(c));
    if (statement.length >= 20 && members.length > 0) {
      const topic = typeof fact.topic === 'string' ? fact.topic.trim() : '';
      const claim = toClaim(statement, topic, members);
      // Two facts collapse to the same id when the model repeats itself; the second
      // would otherwise overwrite the first's merged evidence downstream.
      if (!seenIds.has(claim.id)) {
        seenIds.add(claim.id);
        for (const i of from) used.add(i);
        out.push(claim);
      }
    }
  }

  if (!out.length || used.size < input.length * MIN_INPUT_COVERAGE) {
    console.warn(
      `[knowledgeEngine] claim normalization covered ${used.size}/${input.length} inputs — keeping raw claims`,
    );
    return claims;
  }
  // Anything past MAX_INPUT_CLAIMS was never offered to the model; keep it rather than
  // silently shrinking the graph to the slice that happened to fit.
  return [...out, ...claims.slice(MAX_INPUT_CLAIMS)];
}
