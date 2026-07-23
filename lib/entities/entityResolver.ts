/**
 * Heuristic Entity Resolver — canonicalize NER spans (no spaCy runtime in Node).
 * Real spaCy/GLiNER runs in sidecar; this resolves aliases for pipeline artifacts.
 */
import { normalizeTerm } from '../termUtils';

export type RawEntitySpan = {
  text: string;
  label?: string;
  start?: number;
  end?: number;
  score?: number;
};

export type ResolvedEntity = {
  id: string;
  canonical: string;
  label: string;
  aliases: string[];
  type: string;
  confidence: number;
};

const TYPE_MAP: Record<string, string> = {
  PER: 'person',
  PERSON: 'person',
  ORG: 'organization',
  ORGANIZATION: 'organization',
  LOC: 'location',
  GPE: 'location',
  PRODUCT: 'product',
  WORK_OF_ART: 'work',
  EVENT: 'event',
  MISC: 'misc',
};

export function resolveEntities(spans: RawEntitySpan[]): ResolvedEntity[] {
  const byCanon = new Map<string, ResolvedEntity>();

  for (const s of spans) {
    const text = (s.text || '').trim();
    if (text.length < 2) continue;
    const canon = normalizeTerm(text);
    if (!canon || canon.length < 2) continue;
    const type = TYPE_MAP[(s.label || 'MISC').toUpperCase()] || 'misc';
    const conf = Math.min(1, Math.max(0.3, s.score ?? 0.7));
    const existing = byCanon.get(canon);
    if (existing) {
      if (!existing.aliases.includes(text) && text !== existing.canonical) {
        existing.aliases.push(text);
      }
      existing.confidence = Math.max(existing.confidence, conf);
      continue;
    }
    byCanon.set(canon, {
      id: `ent-${canon.slice(0, 48)}`,
      canonical: text,
      label: text,
      aliases: [],
      type,
      confidence: conf,
    });
  }

  return [...byCanon.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Extract crude NER-like spans from title-case / known patterns (bootstrap without ML). */
export function heuristicNerExtract(text: string): RawEntitySpan[] {
  const spans: RawEntitySpan[] = [];
  const seen = new Set<string>();
  const re = /\b([A-ZÁĄĆĘŁŃÓŚŹŻ][\p{L}]+(?:\s+[A-ZÁĄĆĘŁŃÓŚŹŻ][\p{L}]+){0,3})\b/gu;
  let m: RegExpExecArray | null = re.exec(text);
  while (m) {
    const t = m[1];
    const key = normalizeTerm(t);
    if (key && !seen.has(key) && t.length >= 3 && !/^(The|A|An|I|To|In|On|Of|And)$/i.test(t)) {
      seen.add(key);
      spans.push({ text: t, label: 'MISC', start: m.index, end: m.index + t.length, score: 0.55 });
    }
    m = re.exec(text);
  }
  return spans.slice(0, 40);
}
