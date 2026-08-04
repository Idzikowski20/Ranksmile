import { createHash } from 'crypto';
import type { EmbeddingProvider } from './embeddingProvider';
import { getEmbeddingProvider } from './embeddingProvider';
import { semanticMatchScore } from './semanticMatch';
import { CANONICALIZE_SIM_MIN } from './constants';
import type { CanonicalClaim, KnowledgeGap, TopicBlock, TopicBlockRole } from './types';

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

  const blocks: TopicBlock[] = clusters.map((c) => {
    const consensus = opts.competitorCount
      ? c.urls.size / opts.competitorCount
      : 0;
    const role = inferTopicRole(c.title);
    const claimIds = opts.claims
      .filter((cl) => {
        const blob = `${cl.statement} ${cl.cluster}`.toLowerCase();
        const key = c.title.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
        return key.length > 3 && blob.includes(key.slice(0, Math.min(12, key.length)));
      })
      .map((cl) => cl.id);
    return {
      id: blockId(c.title),
      title: c.title,
      role,
      consensus: Math.round(consensus * 1000) / 1000,
      memberHeadings: [...new Set(c.members)].slice(0, 20),
      claimIds,
    };
  });

  // Assign cluster label onto claims when matched
  for (const b of blocks) {
    for (const id of b.claimIds) {
      const claim = opts.claims.find((c) => c.id === id);
      if (claim && claim.cluster === 'Unassigned') claim.cluster = b.title;
    }
  }

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
