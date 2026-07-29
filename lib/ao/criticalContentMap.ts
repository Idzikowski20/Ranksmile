/**
 * Critical Content Map — multi-candidate definition detection (no LLM).
 * Lead = semantic role, not first-paragraph-only.
 */
import type { ArticleIntentProfile } from './intentProfile';

export type CriticalUnitType =
  | 'definition'
  | 'direct_answer'
  | 'entity'
  | 'claim'
  | 'intent'
  | 'commercial';

export type PreservationMode = 'exact' | 'semantic' | 'presence';

export type CriticalUnit = {
  id: string;
  sectionId: string;
  type: CriticalUnitType;
  text: string;
  importance: 'critical' | 'high' | 'medium';
  preservationMode: PreservationMode;
  score: number;
};

export type CriticalContentMap = {
  primaryTopic: string;
  primaryQuery: string;
  definitions: CriticalUnit[];
  directAnswers: CriticalUnit[];
  keyEntities: CriticalUnit[];
  importantClaims: CriticalUnit[];
  intentSections: CriticalUnit[];
  commercialSections: CriticalUnit[];
  protectedSectionIds: string[];
};

const DEF_H2 = /na\s+czym\s+polega|co\s+to\s+jest|czym\s+jest|definicj|what\s+is|definition/i;
const DEF_PATTERN = /\b(to\s+(zaburzenie|praktyka|stan|zjawisko)|oznacza|jest\s+to|ang\.\s*\w+)/i;
const COMMERCIAL_H2 = /detektyw|tester\s+wierno|kontakt|usług|uslug|agencj/i;

type Para = { sectionId: string; text: string; isLead: boolean; underDefH2: boolean };

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function topicTokens(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function topicOverlap(text: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const low = text.toLowerCase();
  const hits = tokens.filter((t) => low.includes(t)).length;
  return hits / tokens.length;
}

/** Extract paragraphs with section context from HTML. */
export function extractParagraphUnits(html: string, sectionIds: string[]): Para[] {
  const parts = html.split(/(?=<h2\b)/i);
  const out: Para[] = [];
  let sectionIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (!chunk.trim()) continue;
    const sid = sectionIds[Math.min(sectionIdx, sectionIds.length - 1)] || `sec_${sectionIdx}`;
    const h2m = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const heading = h2m ? stripTags(h2m[1]) : '';
    const underDefH2 = DEF_H2.test(heading);
    const isLead = sectionIdx === 0 && !h2m;
    const paras = [...chunk.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
    for (const text of paras) {
      if (text.length < 40) continue;
      out.push({ sectionId: sid, text, isLead, underDefH2 });
    }
    sectionIdx += 1;
  }
  return out;
}

function scoreDefinitionCandidate(p: Para, tokens: string[]): number {
  let s = 0;
  s += topicOverlap(p.text, tokens) * 40;
  if (p.isLead) s += 25;
  if (p.underDefH2) s += 30;
  if (DEF_PATTERN.test(p.text)) s += 20;
  if (p.text.length >= 120 && p.text.length <= 600) s += 10;
  return s;
}

export function buildCriticalContentMap(opts: {
  html: string;
  profile: ArticleIntentProfile;
  sectionIds: string[];
}): CriticalContentMap {
  const topic = opts.profile.primaryTopic;
  const tokens = topicTokens(topic);
  const paras = extractParagraphUnits(opts.html, opts.sectionIds);

  const scored = paras
    .map((p) => ({ p, score: scoreDefinitionCandidate(p, tokens) }))
    .filter((x) => x.score >= 25)
    .sort((a, b) => b.score - a.score);

  const definitions: CriticalUnit[] = scored.slice(0, 3).map((x, i) => ({
    id: `def-${i}`,
    sectionId: x.p.sectionId,
    type: 'definition',
    text: x.p.text,
    importance: i === 0 ? 'critical' : 'high',
    preservationMode: 'semantic',
    score: x.score,
  }));

  const leadParas = paras.filter((p) => p.isLead);
  const directAnswers: CriticalUnit[] = leadParas.slice(0, 2).map((p, i) => ({
    id: `answer-${i}`,
    sectionId: p.sectionId,
    type: 'direct_answer',
    text: p.text,
    importance: 'critical',
    preservationMode: 'semantic',
    score: scoreDefinitionCandidate(p, tokens),
  }));

  const keyEntities: CriticalUnit[] = tokens.slice(0, 8).map((t, i) => ({
    id: `ent-${i}`,
    sectionId: opts.sectionIds[0] || 'sec_0',
    type: 'entity',
    text: t,
    importance: i < 2 ? 'critical' : 'high',
    preservationMode: 'presence',
    score: 50,
  }));

  const commercialSections: CriticalUnit[] = [];
  const intentSections: CriticalUnit[] = [];
  // Scan H2 chunks
  const h2re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null = h2re.exec(opts.html);
  let hi = 0;
  while (m) {
    const heading = stripTags(m[1]);
    const sid = opts.sectionIds[Math.min(hi + 1, opts.sectionIds.length - 1)] || `sec_${hi}`;
    if (COMMERCIAL_H2.test(heading) || opts.profile.forbiddenSubtopics.some((f) => heading.toLowerCase().includes(f))) {
      commercialSections.push({
        id: `com-${hi}`,
        sectionId: sid,
        type: 'commercial',
        text: heading,
        importance: 'high',
        preservationMode: 'presence',
        score: 40,
      });
    } else {
      intentSections.push({
        id: `intent-${hi}`,
        sectionId: sid,
        type: 'intent',
        text: heading,
        importance: 'medium',
        preservationMode: 'presence',
        score: 30,
      });
    }
    hi += 1;
    m = h2re.exec(opts.html);
  }

  const protectedSectionIds = Array.from(
    new Set([
      ...definitions.map((d) => d.sectionId),
      ...directAnswers.map((d) => d.sectionId),
    ]),
  );

  return {
    primaryTopic: topic,
    primaryQuery: topic,
    definitions,
    directAnswers,
    keyEntities,
    importantClaims: [],
    intentSections,
    commercialSections,
    protectedSectionIds,
  };
}

/** Semantic presence: enough topic tokens + optional key phrase overlap. */
export function unitSemanticallyPresent(unit: CriticalUnit, html: string): boolean {
  const plain = stripTags(html).toLowerCase();
  if (unit.preservationMode === 'presence') {
    return plain.includes(unit.text.toLowerCase());
  }
  // semantic: keep majority of content words (len>=4) from unit
  const words = unit.text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (words.length < 4) {
    return words.every((w) => plain.includes(w));
  }
  const hits = words.filter((w) => plain.includes(w)).length;
  return hits / words.length >= 0.55;
}
