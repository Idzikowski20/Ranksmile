/**
 * Topic Research clustering — groups expanded keywords into named clusters and ideas.
 * Uses DeepSeek for cluster naming; deterministic logic for idea grouping and stats.
 */
import { generateText } from 'ai';
import { deepseek } from './ai/deepseek';
import type {
   TopicCluster,
   TopicIdea,
   TopicKeyword,
   TopicResearchResult,
   TopicResearchStats,
} from './topicResearchTypes';

export type EnrichedKeyword = {
   keyword: string;
   volume: number | null;
   kd: number | null;
   position: number | null;
};

type RawCluster = { title: string; summary: string; indexes: number[] };

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'i', 'w', 'z', 'na', 'do', 'od', 'po', 'za', 'się', 'czy', 'jak', 'co', 'to', 'nie']);

function tokens(s: string): Set<string> {
   return new Set(
      s.toLowerCase()
         .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
         .split(/\s+/)
         .filter((t) => t.length > 1 && !STOP.has(t)),
   );
}

function tokenOverlap(a: string, b: string): number {
   const ta = tokens(a);
   const tb = tokens(b);
   if (ta.size === 0 || tb.size === 0) return 0;
   let shared = 0;
   for (const t of ta) { if (tb.has(t)) shared += 1; }
   return shared / Math.min(ta.size, tb.size);
}

function normalizeClusters(parsed: unknown): RawCluster[] | null {
   if (!Array.isArray(parsed)) return null;
   const out: RawCluster[] = [];
   for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const title = typeof rec.title === 'string' ? rec.title.trim() : '';
      const summary = typeof rec.summary === 'string' ? rec.summary.trim() : '';
      const indexes = Array.isArray(rec.indexes)
         ? rec.indexes.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0)
         : Array.isArray(rec.keyword_indexes)
            ? (rec.keyword_indexes as unknown[]).filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0)
            : [];
      if (title && indexes.length > 0) out.push({ title, summary, indexes });
   }
   return out.length > 0 ? out : null;
}

function parseClusterJson(text: string): RawCluster[] | null {
   const start = text.indexOf('[');
   if (start < 0) return null;
   const body = text.slice(start);

   // Candidate 1: the full array as returned.
   const greedy = body.match(/\[[\s\S]*\]/);
   if (greedy) {
      try {
         const parsed = normalizeClusters(JSON.parse(greedy[0]));
         if (parsed) return parsed;
      } catch { /* fall through to truncation recovery */ }
   }

   // Candidate 2: recover a truncated array (model hit the token cap mid-object)
   // by closing it after the last complete object.
   const lastObj = body.lastIndexOf('}');
   if (lastObj > 0) {
      try {
         return normalizeClusters(JSON.parse(`${body.slice(0, lastObj + 1)}]`));
      } catch { /* give up — caller falls back to deterministic clustering */ }
   }
   return null;
}

/** Deterministic fallback when the LLM response can't be parsed: greedy token-overlap grouping. */
function fallbackClusters(keywords: EnrichedKeyword[]): RawCluster[] {
   const order = keywords
      .map((k, i) => ({ i, vol: k.volume ?? 0 }))
      .sort((a, b) => b.vol - a.vol)
      .map((x) => x.i);

   const clusters: { indexes: number[]; seed: number }[] = [];
   const maxClusters = Math.min(8, Math.max(4, Math.round(keywords.length / 12)));

   for (const idx of order) {
      let best = -1;
      let bestScore = 0.35;
      for (let ci = 0; ci < clusters.length; ci += 1) {
         const score = tokenOverlap(keywords[idx].keyword, keywords[clusters[ci].seed].keyword);
         if (score > bestScore) { bestScore = score; best = ci; }
      }
      if (best >= 0) {
         clusters[best].indexes.push(idx);
      } else if (clusters.length < maxClusters) {
         clusters.push({ indexes: [idx], seed: idx });
      } else {
         // No good match and no room for a new cluster: attach to closest existing one.
         let closest = 0;
         let closestScore = -1;
         for (let ci = 0; ci < clusters.length; ci += 1) {
            const score = tokenOverlap(keywords[idx].keyword, keywords[clusters[ci].seed].keyword);
            if (score > closestScore) { closestScore = score; closest = ci; }
         }
         clusters[closest].indexes.push(idx);
      }
   }

   return clusters.map((c) => ({
      title: keywords[c.seed].keyword,
      summary: `Keywords related to "${keywords[c.seed].keyword}"`,
      indexes: c.indexes,
   }));
}

/** LLM groups top keywords into 4–8 named topic clusters. */
export async function clusterKeywords(seed: string, keywords: EnrichedKeyword[]): Promise<RawCluster[]> {
   if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
   }
   const top = keywords.slice(0, 150);
   const lines = top.map((k, i) => `${i}. ${k.keyword} (vol: ${k.volume ?? 0}, kd: ${k.kd ?? 0})`).join('\n');

   const prompt = `You are an SEO topic clustering expert. Group these keywords (seed topic: "${seed}") into 4-8 semantic topic clusters.

Keywords:
${lines}

Return ONLY a JSON array (no markdown). Each element:
{"title": "Cluster name", "summary": "One sentence", "indexes": [0, 1, 5]}

Rules:
- Every index 0-${top.length - 1} must appear in exactly one cluster
- Cluster titles should be concise (2-5 words)
- Group by search intent and semantic similarity`;

   const { text } = await generateText({ model: deepseek('deepseek-chat'), prompt, maxOutputTokens: 4000 });
   const parsed = parseClusterJson(text) ?? fallbackClusters(top);

   const assigned = new Set<number>();
   for (const c of parsed) {
      for (const idx of c.indexes) {
         if (idx < top.length) assigned.add(idx);
      }
   }

   // Attach unassigned keywords to nearest cluster by token overlap
   for (let i = 0; i < top.length; i += 1) {
      if (assigned.has(i)) continue;
      let best = 0;
      let bestScore = 0;
      for (let ci = 0; ci < parsed.length; ci += 1) {
         const rep = parsed[ci].indexes[0];
         if (rep == null || rep >= top.length) continue;
         const score = tokenOverlap(top[i].keyword, top[rep].keyword);
         if (score > bestScore) { bestScore = score; best = ci; }
      }
      parsed[best].indexes.push(i);
   }

   return parsed;
}

/** Group cluster keywords into content ideas (head + long-tail variants). */
export function buildIdeas(clusterKeywords: EnrichedKeyword[], clusterIndex: number): TopicIdea[] {
   if (clusterKeywords.length === 0) return [];

   const sorted = [...clusterKeywords].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
   const used = new Set<string>();
   const ideas: TopicIdea[] = [];

   for (const head of sorted) {
      const key = head.keyword.toLowerCase();
      if (used.has(key)) continue;

      const group: EnrichedKeyword[] = [head];
      used.add(key);

      for (const other of sorted) {
         const ok = other.keyword.toLowerCase();
         if (used.has(ok)) continue;
         if (tokenOverlap(head.keyword, other.keyword) >= 0.35 || ok.includes(key) || key.includes(ok)) {
            group.push(other);
            used.add(ok);
         }
      }

      const kwList: TopicKeyword[] = group.map((k) => ({
         keyword: k.keyword,
         volume: k.volume,
         kd: k.kd,
         position: k.position,
      }));

      const mainVol = head.volume ?? 0;
      const mainKd = head.kd ?? 50;
      const hasPosition = head.position != null && head.position > 0;
      const volScore = Math.min(10, mainVol / 5000);
      const kdScore = Math.max(0, 10 - mainKd / 10);
      const uncoveredBonus = hasPosition ? 0 : 3;
      const score = Math.round(Math.min(10, Math.max(0, volScore * 0.4 + kdScore * 0.4 + uncoveredBonus)) * 10) / 10;

      ideas.push({
         main: head.keyword,
         volume: head.volume,
         kd: head.kd,
         position: head.position,
         keywords: kwList,
         score,
         recommended: !hasPosition && mainVol >= 500 && (head.kd ?? 100) <= 40,
         clusterIndex,
      });
   }

   return ideas.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

function avg(nums: number[]): number {
   if (nums.length === 0) return 0;
   return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function computeStats(clusters: TopicCluster[]): TopicResearchStats {
   const allIdeas = clusters.flatMap((c) => c.ideas);
   const allKws = allIdeas.flatMap((i) => i.keywords);
   const coveredIdeas = allIdeas.filter((i) => i.position != null && i.position > 0).length;
   const recommendations = allIdeas.filter((i) => i.recommended).length;

   let kwTop3 = 0;
   let kwTop10 = 0;
   let kwTop50 = 0;
   for (const kw of allKws) {
      const p = kw.position;
      if (p == null || p <= 0) continue;
      if (p <= 3) kwTop3 += 1;
      if (p <= 10) kwTop10 += 1;
      if (p <= 50) kwTop50 += 1;
   }

   const totalVol = allKws.reduce((s, k) => s + (k.volume ?? 0), 0);
   const coveredRatio = allIdeas.length > 0 ? coveredIdeas / allIdeas.length : 0;
   const topicalAuthority = Math.round(coveredRatio * 100);

   return {
      topicalAuthority,
      coveredIdeas,
      totalIdeas: allIdeas.length,
      kwTop3,
      kwTop10,
      kwTop50,
      searchVolume: totalVol,
      clusterCount: clusters.length,
      recommendationCount: recommendations,
   };
}

/** Build full result from raw clusters + enriched keywords. */
export function assembleResult(
   seed: string,
   country: string,
   rawClusters: RawCluster[],
   allKeywords: EnrichedKeyword[],
): TopicResearchResult {
   const clusters: TopicCluster[] = rawClusters.map((rc, idx) => {
      const kws = rc.indexes
         .filter((i) => i >= 0 && i < allKeywords.length)
         .map((i) => allKeywords[i]);
      const ideas = buildIdeas(kws, idx);
      const covered = ideas.filter((i) => i.position != null && i.position > 0).length;
      return {
         index: idx,
         title: rc.title,
         summary: rc.summary,
         kd: Math.round(avg(kws.map((k) => k.kd ?? 0).filter((v) => v > 0)) * 10) / 10,
         volume: kws.reduce((s, k) => s + (k.volume ?? 0), 0),
         covered,
         total: ideas.length,
         ideas,
      };
   });

   const stats = computeStats(clusters);
   return { seed, country, clusters, stats };
}

/** Map position for hex visualization: KD → ring (0=HIGH inner, 2=LOW outer), volume → angle spread. */
export function ideaMapCoords(idea: TopicIdea, clusterIdx: number, ideaIdx: number, clusterCount: number): { x: number; y: number; ring: 'HIGH' | 'MEDIUM' | 'LOW' } {
   const kd = idea.kd ?? 50;
   const ring: 'HIGH' | 'MEDIUM' | 'LOW' = kd <= 30 ? 'HIGH' : kd <= 60 ? 'MEDIUM' : 'LOW';
   const ringR = ring === 'HIGH' ? 0.25 : ring === 'MEDIUM' ? 0.55 : 0.85;
   const clusterAngle = (clusterIdx / Math.max(clusterCount, 1)) * Math.PI * 2 - Math.PI / 2;
   const spread = 0.15;
   const angle = clusterAngle + (ideaIdx - 2) * spread;
   return {
      x: 0.5 + Math.cos(angle) * ringR * 0.45,
      y: 0.5 + Math.sin(angle) * ringR * 0.45,
      ring,
   };
}
