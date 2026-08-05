import { isCorpusNoiseSentence } from '../corpusNoiseFilter';
import type { CompetitorDocument, SourceKind } from './types';

export type RawSentence = {
  text: string;
  url: string;
  serpPosition: number;
  score: number;
  authority: number;
  kind?: SourceKind;
};

function kindFromExtra(kind?: string): SourceKind {
  if (kind === 'official' || kind === 'industry' || kind === 'competitor'
    || kind === 'ai_overview' || kind === 'paa') {
    return kind;
  }
  return 'competitor';
}

export type RawExtract = {
  sentences: RawSentence[];
  entityCandidates: string[];
  headings: Array<{ text: string; url: string; serpPosition: number }>;
};

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

export function extractRawKnowledge(opts: {
  docs: CompetitorDocument[];
  /** Extra strings from WIE / PAA when bodies thin. */
  extraTexts?: Array<{ text: string; url: string; kind?: string }>;
}): RawExtract {
  const sentences: RawSentence[] = [];
  const entityCandidates: string[] = [];
  const headings: RawExtract['headings'] = [];

  for (const d of opts.docs) {
    for (const h of d.headings) {
      headings.push({ text: h, url: d.url, serpPosition: d.serpPosition });
      // Headings often are concept labels
      if (h.split(/\s+/).length <= 6) entityCandidates.push(h);
    }
    for (const e of d.entities) {
      if (e.trim()) entityCandidates.push(e.trim());
    }
  }

  for (const extra of opts.extraTexts || []) {
    const kind = kindFromExtra(extra.kind);
    for (const part of extra.text.split(SENTENCE_SPLIT)) {
      const t = part.trim();
      if (t.length >= 20) {
        sentences.push({
          text: t,
          url: extra.url || 'synthetic://extra',
          // Non-SERP extras are not ranked results — leave unset (0).
          serpPosition: 0,
          score: 50,
          authority: 0.5,
          kind,
        });
      }
    }
  }

  return { sentences, entityCandidates, headings };
}

const CITY_RE = /\b(warszawa|kraków|krakow|wrocław|wroclaw|poznań|poznan|gdańsk|gdansk|łódź|lodz|katowice|szczecin|lublin|białystok|bialystok|gdynia|rzeszów|rzeszow|częstochowa|czestochowa|radom|gliwic|zabrze|tychy|bielsko)\b/i;
const HOLIDAY_RE = /\b(wesołych\s+świąt|wielkanoc|boże\s+narodzenie|święta\s+202\d)\b/i;
const LOCAL_SERVICE_RE = /\b(pozycjonowanie|projektowanie|tworzenie)\s+(stron|sklepów|strony).{0,40}\b(warszawa|kraków|wrocław|poznań|gdańsk|łódź|katowice)\b/i;

export function isLocalLeftoverEntity(term: string): boolean {
  const t = term.trim();
  if (t.length < 2) return true;
  if (CITY_RE.test(t) && t.split(/\s+/).length <= 2) return true;
  if (HOLIDAY_RE.test(t)) return true;
  if (LOCAL_SERVICE_RE.test(t)) return true;
  return false;
}

export function normalizeCandidates(extract: RawExtract): RawExtract {
  const sentences = extract.sentences.filter((s) => !isCorpusNoiseSentence(s.text));
  const entityCandidates = [...new Set(
    extract.entityCandidates
      .map((e) => e.trim())
      .filter((e) => e.length >= 3 && !isLocalLeftoverEntity(e)),
  )];
  const headings = extract.headings.filter((h) => h.text.trim().length >= 3);
  return { sentences, entityCandidates, headings };
}
