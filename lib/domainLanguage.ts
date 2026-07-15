import { queryOne } from './db/query';
import { countryForLang } from './countryLang';
import { toDfsLanguageCode } from './domainLanguagePrompts';

export type DomainLocale = {
  languageCode: string;
  countryCode: string;
};

const LANG_NAMES: Record<string, string> = {
  pl: 'Polish',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
};

function countryNameToCode(country: string | null | undefined): string {
  const c = (country || '').trim().toLowerCase();
  if (!c || c === 'pl' || c.includes('poland') || c.includes('polska')) return 'PL';
  if (c === 'us' || c.includes('united states') || c.includes('usa')) return 'US';
  if (c === 'gb' || c === 'uk' || c.includes('united kingdom')) return 'GB';
  if (c === 'de' || c.includes('germany') || c.includes('niemiec')) return 'DE';
  if (c === 'fr' || c.includes('france')) return 'FR';
  if (c === 'es' || c.includes('spain')) return 'ES';
  if (c.length === 2) return c.toUpperCase();
  return 'PL';
}

/** Language chosen at domain setup (site_context.language, e.g. `pl`). */
export async function getDomainLocale(domainId: number): Promise<DomainLocale> {
  const sc = await queryOne<{ language: string | null }>(
    'SELECT language FROM site_context WHERE domain_id = ? ORDER BY id LIMIT 1',
    [domainId],
  );
  const domain = await queryOne<{ country: string | null; language: string | null }>(
    'SELECT country, language FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );

  const fromContext = toDfsLanguageCode(sc?.language, '');
  const languageCode = fromContext || toDfsLanguageCode(domain?.language, 'pl');
  const countryCode = countryNameToCode(domain?.country) || countryForLang(languageCode);

  return { languageCode, countryCode };
}

/** Resolve locale for generation: body override → article.language → site_context. */
export async function resolveContentLocale(opts: {
  domainId?: number | null;
  articleId?: number | null;
  bodyLanguage?: string | null;
  bodyCountry?: string | null;
}): Promise<DomainLocale> {
  let domainId = opts.domainId ?? null;
  let articleLang: string | undefined;

  if (opts.articleId) {
    const row = await queryOne<{ language: string | null; domain_id: number | null }>(
      'SELECT language, domain_id FROM articles WHERE id = ? LIMIT 1',
      [opts.articleId],
    );
    articleLang = toDfsLanguageCode(row?.language, '') || undefined;
    if (!domainId && row?.domain_id) domainId = row.domain_id;
  }

  const domainLocale = domainId
    ? await getDomainLocale(domainId)
    : { languageCode: 'pl', countryCode: 'PL' as const };

  const bodyLang = toDfsLanguageCode(opts.bodyLanguage, '');
  const bodyCountry = (opts.bodyCountry || '').trim().toUpperCase().slice(0, 2);

  const languageCode = bodyLang || articleLang || domainLocale.languageCode;
  const countryCode = bodyCountry || domainLocale.countryCode || countryForLang(languageCode);

  return { languageCode, countryCode };
}

export function languageDisplayName(code: string): string {
  return LANG_NAMES[code.toLowerCase().slice(0, 2)] || 'English';
}

export { looksPolish, looksLikeLanguage, polishPromptTemplates, promptTemplatesForLocale, toDfsLanguageCode, languageInstructionForLlm, topicsNeedLocalization } from './domainLanguagePrompts';
