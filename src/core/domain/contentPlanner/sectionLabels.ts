/**
 * Localized outline skeleton + H1 titleizer + FAQ/Summary order.
 * No product-SEO meta headings (keywords/links/CWV) in article outlines.
 */
import { tokensShareStem } from '@/src/core/domain/relevance/topicRelevance';

export type OutlineLang = 'pl' | 'en';

const TAIL_ROLES = /^(faq|summary|podsumowanie|podsum|contact|kontakt)$/i;

/** Closing sections, in the order they must appear after the body. */
const CLOSING = /faq/i;
// Polish stems ("podsumowanie", "dane kontaktowe") but whole-word English, so
// "Contactless payments" stays in the body instead of being filed as a sign-off.
//
// The plural noun means connections in an industry, not the contact section, so every
// case of it is excluded: "kontakty", "kontaktów", "kontaktom", "kontaktami",
// "kontaktach". Matching the stem anywhere sent the body section "Szerokie kontakty z
// wielu branż" to the very end of a real outline, after both the FAQ and Kontakt; the
// dative was still slipping through after the first pass at this.
const SIGN_OFF = /(?:^|[^\p{L}])(?:podsum\p{L}*|kontakt(?!y|ów|om|ami|ach)\p{L}*|summary|contact)(?!\p{L})/iu;

/** Guide / help skeleton — action path, no SEO meta sections. */
export function localizedRequiredSections(
  articleType: string,
  lang: OutlineLang,
  opts?: { hasCostFear?: boolean },
): string[] {
  // No article type carries a forced skeleton — not even hiring intent. The service
  // branch used to return a fixed "Kim jesteśmy / Zakres usług / Dlaczego my / Kontakt"
  // page, and it read as a landing page, not an article: article 160 shipped exactly
  // those headings for "prywatny detektyw warszawa". Every Surfer content editor in this
  // detective-agency workspace is instead a topical article — "szantaż emocjonalny",
  // "kradzież z włamaniem" — with the agency woven in as one section, never a service CV.
  //
  // So the outline is driven entirely by the real competitor + PAA headings for every
  // type, exactly as the reference tool does. The single brand-help section still arrives
  // via brandSections() in the blueprint; the query's commercial intent shapes the angle
  // of the topical headings, not a canned structure. `hasCostFear` no longer forces a
  // "Cennik" heading — a paragraph covers price.
  void articleType;
  void opts;
  return [];
}

/**
 * Brand sections, Surfer-parity. The reference article for "szantaż emocjonalny"
 * dedicates a third of its body to the brand: a services section ("Wsparcie
 * ProDetektyw w sprawach szantażu") and anonymized case studies ("Studium
 * przypadku: realne sprawy"). Our planner treated brand as mentions, not
 * sections — these two H2s close that gap. Injected before FAQ/summary, only
 * when a brand document exists (briefWriter refuses to invent brand facts).
 */
export function brandSections(brandName: string, lang: OutlineLang): string[] {
  const name = brandName.trim();
  if (!name) return [];
  return lang === 'pl'
    ? [`Jak ${name} pomaga w takich sprawach`, 'Studium przypadku: przykladowe sprawy']
    : [`How ${name} helps in cases like this`, 'Case studies'];
}

/** Human H1 — never raw keyword alone. */
export function titleizeH1(opts: {
  keyword: string;
  lang: OutlineLang;
  year?: number;
  quickAnswer?: string | null;
}): string {
  const keyword = opts.keyword.trim().replace(/\s+/g, ' ');
  if (!keyword) return opts.lang === 'pl' ? 'Poradnik' : 'Guide';
  const year = opts.year ?? new Date().getFullYear();
  // Already a phrase title (≥3 words or how-to cue)
  if (/\s/.test(keyword) && (keyword.split(/\s+/).length >= 3 || /^(jak|how|co|what)\b/i.test(keyword))) {
    return capitalizeSentence(keyword);
  }
  if (opts.lang === 'pl') {
    return `${capitalizeSentence(keyword)} — co zrobić? Poradnik ${year}`;
  }
  return `${capitalizeSentence(keyword)}: what to do (${year})`;
}

function capitalizeSentence(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Brand / audience / service / city framing that must never be in the H1. Surfer titles
 * for the reader ("Szantaż emocjonalny: jak go rozpoznać…"); ours kept producing
 * "Szantaż emocjonalny — poufna pomoc detektywistyczna dla osób prywatnych i firm z
 * Warszawy". The outline prompt forbids it, but the brand context in that prompt wins
 * often enough that the H1 needs a deterministic guard on top of the instruction.
 */
// Only explicitly off-topic audience/service/brand framing. `jak pom[oó]c` is matched ONLY
// when it targets an audience ("jak pomóc firmom / osobom prywatnym / klientom") — a bare
// `jak pom[oó]c` also ate legitimate reader-benefit clauses ("…: jak pomóc ofierze").
const H1_OFFTOPIC_FRAMING = /poufn\w* pomoc|pomoc detektywistyczn|dla os[oó]b prywatnych|dla firm\b|dla klient[oó]w|jak pom[oó]c \w*(?:firm|osob|klient|przedsi[eę]bior)|agencj\w* detektyw|osób prywatnych i firm|z warszaw|dla warszaw/i;

/**
 * Strip brand/audience/service framing from an LLM-authored H1, keeping the topical part.
 * Splits on the title's separators and drops any segment that is framing; an H1 with no
 * framing is returned unchanged. Falls back to the bare keyword only if nothing topical
 * survives — a plain topical H1 beats a branded one.
 */
export function topicalizeH1(rawH1: string, keyword: string): string {
  const h1 = (rawH1 || '').trim();
  if (!h1) return capitalizeSentence(keyword.trim());
  if (!H1_OFFTOPIC_FRAMING.test(h1)) return h1;
  const kept = h1
    .split(/\s[—–-]\s|:\s|,\s/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !H1_OFFTOPIC_FRAMING.test(p));
  const rebuilt = kept.join(' – ').trim();
  return rebuilt.length >= 3 ? rebuilt : capitalizeSentence(keyword.trim());
}

// The brand help + case-study sections (see brandSections). They belong near the end,
// after the topical body and before FAQ/summary — Surfer keeps the agency section at
// position 10 of 12 — but they were seeded first and led the article. Matching our own
// brandSections strings (not competitor headings) routes them to the body tail.
const BRAND_TAIL = /pomaga w takich sprawach|studium przypadku|helps in cases like this|^case studies$/i;

export function isTailSectionRole(role: string, heading: string): boolean {
  const blob = `${role} ${heading}`.toLowerCase();
  return TAIL_ROLES.test(role) || /\bfaq\b/.test(blob) || SIGN_OFF.test(blob) || BRAND_TAIL.test(heading);
}

/** FAQ then the sign-off (summary / contact) always last; order among tails preserved. */
export function orderSectionsFaqLast<T extends { role: string; heading: string; id: string }>(
  sections: T[],
): { sections: T[]; narrativeOrder: string[] } {
  const body: T[] = [];
  const tail: T[] = [];
  for (const s of sections) {
    if (isTailSectionRole(s.role, s.heading)) tail.push(s);
    else body.push(s);
  }
  const faq = tail.filter((s) => CLOSING.test(`${s.role} ${s.heading}`));
  const signOff = tail.filter((s) => !faq.includes(s) && SIGN_OFF.test(`${s.role} ${s.heading}`));
  const otherTail = tail.filter((s) => !faq.includes(s) && !signOff.includes(s));
  const ordered = [...body, ...otherTail, ...faq, ...signOff];
  return {
    sections: ordered,
    narrativeOrder: ordered.map((s) => s.id),
  };
}

/** Padding headings from competitor common headings — never SEO product meta. */
export function headingFillersFromCompetitors(
  commonHeadings: string[],
  keyword: string,
  lang: OutlineLang,
  need: number,
): Array<{ role: string; heading: string; importance: number }> {
  const out: Array<{ role: string; heading: string; importance: number }> = [];
  const seen = new Set<string>();
  for (const h of commonHeadings) {
    const heading = h.trim();
    if (!heading || heading.length < 4) continue;
    if (isSeoMetaHeading(heading) || namesAnotherBrand(heading, keyword, lang)) continue;
    const key = heading.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      role: `competitor_${out.length}`,
      heading,
      importance: 6,
    });
    if (out.length >= need) return out;
  }
  let i = out.length;
  while (out.length < need) {
    i += 1;
    out.push({
      role: `topic_${i}`,
      heading: lang === 'pl'
        ? `Praktyczne wskazówki: ${keyword} (${i})`
        : `Practical tips: ${keyword} (${i})`,
      importance: 3,
    });
  }
  return out;
}

/**
 * A competitor's own name, dragged in as one of our section headings.
 *
 * Real outlines shipped "Detektyw Warszawa Agencja Temida.", "Prywatny Detektyw Temida –
 * Warszawa" and "Jak działają specjaliści Agencji Temida?" as H2s — the writer is then
 * told to write our article about somebody else's company.
 *
 * Polish capitalises only the first word of a heading, so a later capitalised token that
 * is not part of the keyword is a proper noun. Short all-caps runs are let through as
 * acronyms (GPS, OC, RODO). English title case makes the same test meaningless, so it
 * only runs for Polish — the gap is deliberate, not an oversight.
 */
export function namesAnotherBrand(heading: string, keyword: string, lang: OutlineLang): boolean {
  if (lang !== 'pl') return false;
  const known = keyword.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens = heading.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.slice(1).some((token) => {
    // "Detektywa", "Warszawie" are the keyword declined, not a rival's name.
    if (known.some((k) => tokensShareStem(token.toLowerCase(), k))) return false;
    if (token.length <= 4 && token === token.toUpperCase()) return false;
    return token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase();
  });
}

export function isSeoMetaHeading(heading: string): boolean {
  return /analiza s[łl][oó]w kluczowych|techniczne seo|tre[sś]ci,? kt[oó]re rankuj|linkowanie wewn|linki zewn|seo lokalne|monitorowanie wynik[oó]w|narz[eę]dzia i stack|keywords and intent|technical seo|content that ranks|measurement|backlinks/i
    .test(heading);
}

// ponytail: ceiling = heuristic titleizer; upgrade = LLM title from quickAnswer+intent
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-console
  console.assert(
    !isSeoMetaHeading('Co zrobić przy szantażu'),
    'help heading is not SEO meta',
  );
  // eslint-disable-next-line no-console
  console.assert(
    isSeoMetaHeading('Analiza słów kluczowych i intencji'),
    'SEO meta detected',
  );
}
