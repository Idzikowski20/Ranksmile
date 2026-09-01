import { isCorpusNoiseSentence } from '../corpusNoiseFilter';
import { foldPolishLetters } from '../termUtils';
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

/** Contact labels, testimonial furniture and letter-spaced banners scraped as headings. */
const NOISE_ENTITY_RE = /^(adres|telefon|e-?mail|kontakt|menu|nawigacja)\b|(nasz\w*|o nas|opinie|klient\w*)\b/i;

export function isNoiseEntity(term: string): boolean {
  const t = term.replace(/\s+/g, ' ').trim();
  if (t.endsWith(':') || t.endsWith('?')) return true;
  // "a l e r t" — letter-spaced display text: every token is a single character.
  const tokens = t.split(/\s+/);
  if (tokens.length >= 3 && tokens.every((w) => w.length === 1)) return true;
  return NOISE_ENTITY_RE.test(foldPolishLetters(t));
}

export function isLocalLeftoverEntity(term: string): boolean {
  const t = term.trim();
  if (t.length < 2) return true;
  if (CITY_RE.test(t) && t.split(/\s+/).length <= 2) return true;
  if (HOLIDAY_RE.test(t)) return true;
  if (LOCAL_SERVICE_RE.test(t)) return true;
  return false;
}

/** Competitor speaking as itself: "nasi detektywi", "gwarantujemy", "zatrudniamy". */
const SELF_PROMOTION_RE = new RegExp(
  '\\b(nasi|nasz\\w*|oferujemy|zapewniamy|gwarantujemy|zatrudniamy'
  + '|dysponujemy|dzialamy|specjalizujemy|posiadamy|realizujemy|swiadczymy)\\b',
  'i',
);
/** Sales copy addressed at the reader — a landing page's voice, not a fact. */
const DIRECT_ADDRESS_RE = /\b(chcecie|chcesz|panstwa|panstwu|zapytaj|zadzwon|skontaktuj|napisz|wybierz|czujesz|potrzebujesz|twoj\w*|tobie|ciebie)\b/i;
/** `Agencja Detektywistyczna Ochrony Biznesu ds.` — a heading cut at an abbreviation. */
const TRUNCATED_TAIL_RE = /\b(ds|sp|z\s*o\.o|itp|itd|np|tzn|m\.in)\.\s*$/i;

/**
 * A scraped sentence that cannot serve as a claim about the topic.
 *
 * `isCorpusNoiseSentence` is a boilerplate denylist and is also applied to questions
 * elsewhere, so it cannot reject these shapes. Without this pass the graph filled with
 * competitor marketing ("Nasi detektywi zagwarantują Państwu dyskrecję"), FAQ headings
 * ("Ile kosztuje godzina pracy detektywa?") and heading fragments — and the writer,
 * handed them as "Must cover", welded them into the article verbatim.
 */
export function isNonClaimSentence(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  // Questions reach the graph through `paaQuestions` and `discoverGaps`; as claims they
  // are only a competitor's FAQ heading, which the writer then answered as a statement.
  if (t.endsWith('?')) return true;
  if (TRUNCATED_TAIL_RE.test(t)) return true;
  // Six words or fewer carries no fact worth covering: "Ich zakres usług jest bardzo
  // szeroki." passes the boilerplate filter's four-word floor but says nothing.
  if (t.split(/\s+/).length < 7) return true;
  const folded = foldPolishLetters(t);
  return SELF_PROMOTION_RE.test(folded) || DIRECT_ADDRESS_RE.test(folded);
}

export function normalizeCandidates(extract: RawExtract): RawExtract {
  const sentences = extract.sentences.filter(
    (s) => !isCorpusNoiseSentence(s.text) && !isNonClaimSentence(s.text),
  );
  const entityCandidates = [...new Set(
    extract.entityCandidates
      .map((e) => e.trim())
      // Competitor page headings arrive here as entity candidates, which is how
      // "adres:", "opinie naszych klientów" and "a l e r t" became named entities.
      .filter((e) => e.length >= 3 && !isLocalLeftoverEntity(e) && !isNoiseEntity(e)),
  )];
  const headings = extract.headings.filter((h) => h.text.trim().length >= 3);
  return { sentences, entityCandidates, headings };
}
