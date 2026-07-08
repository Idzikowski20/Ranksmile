/**
 * Server-side salience zone extraction from competitor HTML (cheerio).
 */
import { load } from 'cheerio';
import type { NlpTerm } from './contentScore';
import { plainText } from './optimizationPlanner';
import {
  enrichTermsWithSalienceFromZones,
  type SalienceZones,
} from './termSalienceCore';

export type { SalienceZones } from './termSalienceCore';
export {
  computeTermSalienceScore,
  enrichTermsWithSalienceFromZones,
  termSalienceWeight,
} from './termSalienceCore';

const BOLD_WEIGHT_RE = /font-weight\s*:\s*(bold|[6-9]00)/i;

/** Extract plain-text zones where competitors emphasize terms (headings + bold). */
export function extractSalienceZones(html: string): SalienceZones {
  const $ = load(html || '');
  $('script, style, noscript').remove();

  const headings = plainText(
    $('h2, h3, h4, h5, h6').map((_, el) => $(el).text()).get().join(' '),
  );

  const boldParts: string[] = [];
  $('strong, b').each((_, el) => {
    const t = $(el).text().trim();
    if (t) boldParts.push(t);
  });
  $('[style*="font-weight"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (BOLD_WEIGHT_RE.test(style)) {
      const t = $(el).text().trim();
      if (t) boldParts.push(t);
    }
  });

  const bold = plainText(boldParts.join(' '));
  const body = plainText($('body').html() || html);
  return { headings, bold, body };
}

/** Parse competitor HTML pages and attach salience scores to NLP terms. */
export function enrichTermsWithSalience(terms: NlpTerm[], competitorHtmls: string[]): NlpTerm[] {
  const zonesList = competitorHtmls.filter(Boolean).map(extractSalienceZones);
  return enrichTermsWithSalienceFromZones(terms, zonesList);
}
