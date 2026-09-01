/**
 * Build Ranksmile-style topic groups for AI Search "Info to cover" from citations,
 * coverage items, and competitor outline headings.
 */
import type { AiVisibilitySummary } from './aiSearchScore';
import type { CoverageItem, CoverageTopicGroup, LlmCoverageSource } from './aiCoverage';
import { normalizeTerm } from './termUtils';

export type InfoSource = {
  key: string;
  url?: string;
  domain?: string;
  kind: 'web' | 'ai_overview' | 'ai_mode' | 'openai' | 'google' | 'gemini' | 'perplexity' | 'reddit';
};

function llmSourceToInfo(src: LlmCoverageSource): InfoSource {
  const key = src;
  switch (src) {
    case 'ai_overview': return { key, kind: 'ai_overview' };
    case 'chat_gpt': return { key, kind: 'openai' };
    case 'gemini': return { key, kind: 'gemini' };
    case 'perplexity': return { key, kind: 'perplexity' };
    case 'reddit': return { key, kind: 'reddit' };
    default: return { key, kind: 'web' };
  }
}

function sourcesFromItem(item: CoverageItem): InfoSource[] {
  if (!item.llmSources?.length) return [];
  return item.llmSources.map(llmSourceToInfo);
}

export type InfoFact = {
  id: string;
  text: string;
  covered: boolean;
  sources: InfoSource[];
};

export type InfoTopicGroup = {
  id: string;
  title: string;
  facts: InfoFact[];
};

function tokenize(s: string): string[] {
  return (s || '').toLowerCase().replace(/[^\wąćęłńóśźż\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
}

function overlapScore(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = tokenize(b);
  if (!A.size || !B.length) return 0;
  return B.filter((w) => A.has(w)).length;
}

function parseOutlineTopics(cache: string | null | undefined): string[] {
  if (!cache) return [];
  try {
    const parsed = JSON.parse(cache);
    const list = Array.isArray(parsed) ? parsed : (parsed.competitors || []);
    const topics: string[] = [];
    for (const c of list) {
      for (const h of c.headings || []) {
        if ((h.level === 2 || h.level === 3) && h.text) {
          const t = String(h.text).trim();
          if (t.length >= 8 && t.length <= 80) topics.push(t);
        }
      }
    }
    const seen = new Set<string>();
    return topics.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 12);
  } catch {
    return [];
  }
}

function assignTopic(text: string, topics: string[]): string {
  if (!topics.length) return 'Information to cover';
  let best = topics[0];
  let bestScore = 0;
  for (const t of topics) {
    const s = overlapScore(t, text);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return bestScore >= 1 ? best : 'Information to cover';
}

function topicsFromSnapshot(
  snapshotTopics: readonly CoverageTopicGroup[],
  items: CoverageItem[],
): InfoTopicGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const groups: InfoTopicGroup[] = [];

  for (const topic of snapshotTopics) {
    const facts: InfoFact[] = [];
    for (const id of topic.itemIds) {
      const item = byId.get(id);
      if (!item || item.category === 'intent') continue;
      used.add(id);
      facts.push({
        id: item.id,
        text: item.label,
        covered: item.covered,
        sources: sourcesFromItem(item),
      });
    }
    if (facts.length) {
      groups.push({
        id: `topic-${normalizeTerm(topic.title).slice(0, 48) || 'x'}`,
        title: topic.title,
        facts,
      });
    }
  }

  const rest = items.filter((i) => i.category !== 'intent' && !used.has(i.id));
  if (rest.length) {
    groups.push({
      id: 'topic-remaining',
      title: 'Information to cover',
      facts: rest.map((item) => ({
        id: item.id,
        text: item.label,
        covered: item.covered,
        sources: sourcesFromItem(item),
      })),
    });
  }

  return groups;
}

/** Build accordion groups for the Write & Optimize AI panel. */
export function buildInfoToCoverTopics(opts: {
  aiSummary?: AiVisibilitySummary | null;
  coverageItems?: CoverageItem[];
  competitorOutlinesCache?: string | null;
  intentItems?: CoverageItem[];
  /** Prefer harvested snapshot.topics when present. */
  snapshotTopics?: readonly CoverageTopicGroup[] | null;
}): { intent: InfoFact[]; topics: InfoTopicGroup[] } {
  const outlineTopics = parseOutlineTopics(opts.competitorOutlinesCache);

  const intentSource = (opts.intentItems && opts.intentItems.length)
    ? opts.intentItems
    : (opts.coverageItems || []).filter((i) => i.category === 'intent');

  const intent: InfoFact[] = intentSource.map((item) => ({
    id: item.id,
    text: item.label,
    covered: item.covered,
    sources: sourcesFromItem(item),
  }));

  // Prefer harvested topic grouping from the coverage snapshot.
  if (opts.snapshotTopics?.length && opts.coverageItems?.length) {
    return {
      intent,
      topics: topicsFromSnapshot(opts.snapshotTopics, opts.coverageItems),
    };
  }

  const factMap = new Map<string, InfoFact>();

  const addFact = (id: string, text: string, covered: boolean, sources: InfoSource[]) => {
    const k = text.toLowerCase().trim();
    if (!k) return;
    const prev = factMap.get(k);
    if (prev) {
      const merged = [...prev.sources];
      for (const s of sources) {
        if (!merged.some((x) => x.key === s.key)) merged.push(s);
      }
      factMap.set(k, { ...prev, covered: prev.covered || covered, sources: merged });
      return;
    }
    factMap.set(k, { id, text, covered, sources });
  };

  for (const item of opts.coverageItems || []) {
    if (item.category === 'intent') continue;
    const sources = sourcesFromItem(item);
    addFact(item.id, item.label, item.covered, sources);
  }

  // When deep analysis saved empty coverage (0 PAA + no DataForSEO) but the sidecar
  // AI-visibility stage still returned citation prompts, surface those in the panel.
  if (!factMap.size && !intent.length && opts.aiSummary?.citations?.length) {
    const seen = new Set<string>();
    for (const c of opts.aiSummary.citations) {
      const text = (c.prompt || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 10) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const covered = (c.answer_readiness_score ?? 0) >= 60;
      addFact(`ai-cite-${seen.size}`, text, covered, []);
    }
  }

  const byTopic = new Map<string, InfoFact[]>();
  const infoBucket = 'Information to cover';

  for (const fact of factMap.values()) {
    const topic = assignTopic(fact.text, outlineTopics);
    const list = byTopic.get(topic) || [];
    list.push(fact);
    byTopic.set(topic, list);
  }

  const topics: InfoTopicGroup[] = [];
  if (outlineTopics.length) {
    for (const title of outlineTopics) {
      const facts = byTopic.get(title);
      if (facts?.length) {
        topics.push({ id: `topic-${title}`, title, facts });
        byTopic.delete(title);
      }
    }
  }

  const rest = [...byTopic.entries()].flatMap(([title, facts]) => ({ title, facts }));
  for (const { title, facts } of rest) {
    if (!facts.length) continue;
    topics.push({ id: `topic-${title}`, title, facts });
  }

  if (!topics.length && factMap.size) {
    topics.push({
      id: 'topic-all',
      title: infoBucket,
      facts: [...factMap.values()],
    });
  }

  return { intent, topics };
}
