/**
 * Build Surfer-style topic groups for AI Search "Info to cover" from citations,
 * coverage items, and competitor outline headings.
 */
import type { AiVisibilitySummary } from './aiSearchScore';
import type { CoverageItem } from './aiCoverage';

export type InfoSource = {
  key: string;
  url?: string;
  domain?: string;
  kind: 'web' | 'ai_overview' | 'ai_mode' | 'openai' | 'google';
};

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

function sourceFromUrl(url: string, domain?: string): InfoSource {
  const d = (domain || '').replace(/^www\./, '');
  const host = d || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  return { key: url || host, url: url || undefined, domain: host || undefined, kind: 'web' };
}

function sourcesFromCitations(citations: AiVisibilitySummary['citations'], prompt: string): InfoSource[] {
  const out: InfoSource[] = [];
  const seen = new Set<string>();
  for (const c of citations || []) {
    if (c.prompt !== prompt) continue;
    const url = c.cited_url || '';
    const domain = (c.cited_domain || '').replace(/^www\./, '');
    const key = url || domain;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (url) out.push(sourceFromUrl(url, domain));
    else if (domain) out.push({ key: domain, domain, kind: 'web' });
  }
  return out;
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

/** Build accordion groups for the Write & Optimize AI panel. */
export function buildInfoToCoverTopics(opts: {
  aiSummary?: AiVisibilitySummary | null;
  coverageItems?: CoverageItem[];
  competitorOutlinesCache?: string | null;
  intentItems?: CoverageItem[];
}): { intent: InfoFact[]; topics: InfoTopicGroup[] } {
  const outlineTopics = parseOutlineTopics(opts.competitorOutlinesCache);
  const citations = opts.aiSummary?.citations || [];

  const intentSource = (opts.intentItems && opts.intentItems.length)
    ? opts.intentItems
    : (opts.coverageItems || []).filter((i) => i.category === 'intent');

  const intent: InfoFact[] = intentSource.map((item) => ({
    id: item.id,
    text: item.label,
    covered: item.covered,
    sources: [],
  }));

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
    const sources: InfoSource[] = [];
    for (const c of citations) {
      if (!c.prompt) continue;
      if (c.prompt === item.label || (c.answer && c.answer === item.label)) {
        sources.push(...sourcesFromCitations(citations, c.prompt));
      }
    }
    addFact(item.id, item.label, item.covered, sources);
  }

  for (const c of citations) {
    if (!c.prompt) continue;
    const covered = (c.answer_readiness_score ?? 0) >= 60;
    const sources = sourcesFromCitations(citations, c.prompt);
    if (c.answer && c.answer.length > 20) {
      addFact(`ans-${c.prompt}`, c.answer, covered, sources);
    } else {
      addFact(`paa-${c.prompt}`, c.prompt, covered, sources);
    }
  }

  const byTopic = new Map<string, InfoFact[]>();
  const upfront = 'Upfront Intent Alignment';
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
