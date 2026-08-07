/**
 * Localized outline skeleton + H1 titleizer + FAQ/Summary order.
 * No product-SEO meta headings (keywords/links/CWV) in article outlines.
 */
import { tokensShareStem } from '../topicRelevance';

export type OutlineLang = 'pl' | 'en';

const TAIL_ROLES = /^(faq|summary|podsumowanie|podsum|contact|kontakt)$/i;

/** Closing sections, in the order they must appear after the body. */
const CLOSING = /faq/i;
// Polish stems ("podsumowanie", "dane kontaktowe") but whole-word English, so
// "Contactless payments" stays in the body instead of being filed as a sign-off.
const SIGN_OFF = /(?:^|[^\p{L}])(?:podsum\p{L}*|kontakt\p{L}*|summary|contact)(?!\p{L})/iu;

/** Guide / help skeleton — action path, no SEO meta sections. */
export function localizedRequiredSections(
  articleType: string,
  lang: OutlineLang,
  opts?: { hasCostFear?: boolean },
): string[] {
  const cost = opts?.hasCostFear === true;
  // Hiring intent gets a service page, not a tutorial. Mirrors what ranks for these
  // queries: who you are, who you help, what you do, how the work runs, why you, contact.
  // The generic guide skeleton ("Pierwsze kroki", "Plan działania") answers a how-to
  // nobody asked, and reads as advice for doing the job yourself.
  if (articleType === 'service') {
    return lang === 'pl'
      ? [
        'Kim jesteśmy',
        'Komu pomagamy',
        'Zakres usług',
        'Jak wygląda współpraca',
        ...(cost ? ['Cennik i wycena'] : []),
        'Dlaczego my',
        'FAQ',
        'Kontakt',
      ]
      : [
        'Who we are',
        'Who we help',
        'What we do',
        'How we work',
        ...(cost ? ['Pricing'] : []),
        'Why us',
        'FAQ',
        'Contact',
      ];
  }
  if (lang === 'pl') {
    if (articleType === 'step-by-step' || articleType === 'guide') {
      const steps = [
        'Szybka odpowiedź',
        'Pierwsze kroki',
        'Plan działania',
        'Najczęstsze błędy',
        ...(cost ? ['Koszty i opcje'] : []),
        'FAQ',
        'Podsumowanie',
      ];
      return steps;
    }
    return [
      'Szybki start',
      'Podstawy',
      'Checklista',
      'Najczęstsze błędy',
      ...(cost ? ['Koszty'] : []),
      'FAQ',
      'Podsumowanie',
    ];
  }
  if (articleType === 'step-by-step') {
    return [
      'Quick Answer',
      'First steps',
      'Action plan',
      'Common Mistakes',
      ...(cost ? ['Cost'] : []),
      'FAQ',
      'Summary',
    ];
  }
  return [
    'Quick Start',
    'Foundation',
    'Checklist',
    'Common Mistakes',
    ...(cost ? ['Cost'] : []),
    'FAQ',
    'Summary',
  ];
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

export function isTailSectionRole(role: string, heading: string): boolean {
  const blob = `${role} ${heading}`.toLowerCase();
  return TAIL_ROLES.test(role) || /\bfaq\b/.test(blob) || SIGN_OFF.test(blob);
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
