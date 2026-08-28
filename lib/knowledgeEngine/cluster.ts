import { createHash } from 'crypto';
import type { EmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
import { getEmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
import { semanticMatchScore } from './semanticMatch';
import { CANONICALIZE_SIM_MIN } from './constants';
import { tokensShareStem } from '../topicRelevance';
import type { CanonicalClaim, KnowledgeGap, TopicBlock, TopicBlockRole } from '@/src/core/domain/knowledgeEngine/types';

function blockId(title: string): string {
  return `TB_${createHash('sha1').update(title.toLowerCase()).digest('hex').slice(0, 8)}`;
}

export function inferTopicRole(title: string): TopicBlockRole {
  const t = title.toLowerCase();
  if (/ai overview|geo|llm|generative|ai search|ai mode/i.test(t)) return 'ADVANCED';
  if (/monitor|anality|analytics|pomiar|search console|wynik/i.test(t)) return 'MONITORING';
  if (/technical|technicz|ssl|indeks|cwv|core web|robots|canonical|fundament/i.test(t)) {
    return 'FOUNDATION';
  }
  return 'ACTION';
}

export async function buildTopicBlocks(opts: {
  headings: Array<{ text: string; url: string; serpPosition: number }>;
  claims: CanonicalClaim[];
  competitorCount: number;
  provider?: EmbeddingProvider;
}): Promise<TopicBlock[]> {
  const provider = opts.provider ?? getEmbeddingProvider();
  const clusters: Array<{ title: string; members: string[]; urls: Set<string> }> = [];

  for (const h of opts.headings) {
    const text = h.text.trim();
    if (text.length < 3) continue;
    let best = -1;
    let bestSim = 0;
    for (let i = 0; i < clusters.length; i++) {
      const sim = await semanticMatchScore(text, clusters[i].title, provider);
      if (sim >= CANONICALIZE_SIM_MIN && sim > bestSim) {
        bestSim = sim;
        best = i;
      }
    }
    if (best >= 0) {
      clusters[best].members.push(text);
      clusters[best].urls.add(h.url);
    } else {
      clusters.push({ title: text, members: [text], urls: new Set([h.url]) });
    }
  }

  const tokensOf = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4);

  // How many of a title's tokens the claim shares (by stem). Stem overlap replaces the
  // old 12-char-prefix match, which never fired because competitor headings ("Sprawy
  // cywilne – jak pomaga detektyw") do not appear verbatim inside a claim.
  //
  // Pairing is one-to-one: a claim token is consumed once. Counting title tokens that
  // match *any* claim token let a heading repeating an inflection ("detektyw",
  // "detektywi") clear the two-token floor against a single claim word, which is exactly
  // the generic-word case the floor exists to reject.
  const sharedTokenCount = (titleTokens: string[], claimTokens: string[]): number => {
    const unused = [...claimTokens];
    let shared = 0;
    for (const tt of titleTokens) {
      const at = unused.findIndex((ct) => tokensShareStem(tt, ct));
      if (at >= 0) {
        unused.splice(at, 1);
        shared += 1;
      }
    }
    return shared;
  };

  const blockMeta = clusters.map((c) => ({
    cluster: c,
    titleTokens: tokensOf(c.title),
  }));

  const claimIdsByBlock: string[][] = blockMeta.map(() => []);

  // A claim goes to its SINGLE best-matching block, not every block that shares one
  // word. Two shared tokens is the confidence floor — one shared token is usually a
  // location ("Warszawa") or a generic ("detektyw") that appears in half the headings.
  //
  // ponytail: ceiling = a claim sharing exactly one stem with every heading is dropped
  // rather than placed, and the scan is O(blocks x claims x tokens) held in memory.
  // Upgrade = embed headings and claims once and assign by cosine similarity, which also
  // gives the single-token cases a real score instead of a floor.
  for (const claim of opts.claims) {
    const claimTokens = tokensOf(claim.statement);
    let bestIdx = -1;
    let bestScore = 1;
    for (let i = 0; i < blockMeta.length; i += 1) {
      const score = sharedTokenCount(blockMeta[i].titleTokens, claimTokens);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      claimIdsByBlock[bestIdx].push(claim.id);
      if (claim.cluster === 'Unassigned') claim.cluster = blockMeta[bestIdx].cluster.title;
    }
  }

  const blocks: TopicBlock[] = blockMeta.map(({ cluster: c }, i) => ({
    id: blockId(c.title),
    title: c.title,
    role: inferTopicRole(c.title),
    consensus: Math.round((opts.competitorCount ? c.urls.size / opts.competitorCount : 0) * 1000) / 1000,
    memberHeadings: [...new Set(c.members)].slice(0, 20),
    claimIds: claimIdsByBlock[i],
  }));

  return blocks.sort((a, b) => b.consensus - a.consensus);
}

export function discoverGaps(opts: {
  claims: CanonicalClaim[];
  topicBlocks: TopicBlock[];
  paaQuestions?: string[];
}): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  // Opportunity: PAA without matching topic block
  for (const q of opts.paaQuestions || []) {
    const hit = opts.topicBlocks.some((b) =>
      b.title.toLowerCase().includes(q.toLowerCase().slice(0, 12))
      || q.toLowerCase().includes(b.title.toLowerCase().slice(0, 12)),
    );
    if (!hit) {
      gaps.push({
        id: `GAP_opp_${createHash('sha1').update(q).digest('hex').slice(0, 6)}`,
        kind: 'opportunity_gap',
        topic: q,
        importance: 'high',
        novelty: 0.85,
        relatedClaimIds: [],
      });
    }
  }
  // Consensus gaps are filled post-coverage; placeholder high-consensus unassigned clusters
  for (const b of opts.topicBlocks) {
    if (b.consensus >= 0.75 && b.claimIds.length === 0) {
      gaps.push({
        id: `GAP_con_${b.id}`,
        kind: 'consensus_gap',
        topic: b.title,
        importance: 'high',
        novelty: 0.2,
        relatedClaimIds: [],
      });
    }
  }
  return gaps.slice(0, 40);
}
