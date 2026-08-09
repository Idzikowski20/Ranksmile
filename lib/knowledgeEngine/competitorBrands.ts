/**
 * Claims that name one of the competitors they were scraped from.
 *
 * Article 18 shipped "Nakaz ten dotyczy wszystkich pracowników Agencji Detektywistycznej
 * Temida." and "Klienci Agencji Temida powierzają detektywom..." — our client's article
 * asserting a rival agency's staff policy, twice. The normalization prompt does say "no
 * brand names of the scraped companies", but a prompt is a request; nothing checked.
 *
 * The check is deterministic and needs no new input: the graph already records which host
 * every claim came from, and a brand shows up in its own hostname (`agencjatemida.pl`
 * contains `temida`).
 */
import { foldPolishLetters } from '../termUtils';
import { tokensShareStem } from '../topicRelevance';
import type { CanonicalClaim } from './types';

/** Below this a token matches hostnames by accident ("pl", "biz", "osob"). */
const MIN_BRAND_TOKEN = 5;

function hostLabels(domain: string): string[] {
  // `www.agencjatemida.pl` -> ['agencjatemida']; the TLD carries no brand.
  return foldPolishLetters(domain.toLowerCase())
    .replace(/^www\./, '')
    .split('.')
    .slice(0, -1)
    .filter(Boolean);
}

/**
 * A statement word that is part of a competitor's hostname and not part of the topic.
 *
 * Direction matters: the word is searched INSIDE the hostname, not the other way round.
 * `agencjatemida` never appears in prose, but `temida` sits inside it. The keyword guard
 * is what keeps this from eating the topic itself — `detektyw` is inside `topdetektyw.pl`
 * and `sprawdzonydetektyw.pl`, so without it every real claim would be discarded.
 */
export function namesCompetitorBrand(statement: string, domains: string[], keyword: string): boolean {
  const labels = domains.flatMap(hostLabels);
  if (!labels.length) return false;
  const seeds = foldPolishLetters(keyword.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);

  return foldPolishLetters(statement.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_BRAND_TOKEN)
    .filter((word) => !seeds.some((seed) => tokensShareStem(word, seed)))
    .some((word) => labels.some((label) => label.includes(word)));
}

/** Drops claims naming any competitor in the graph — not only their own source. */
export function dropCompetitorBrandClaims(
  claims: CanonicalClaim[],
  keyword: string,
): CanonicalClaim[] {
  const domains = [...new Set(claims.flatMap((c) => c.evidence.map((e) => e.domain)))];
  if (!domains.length) return claims;

  const kept = claims.filter((c) => !namesCompetitorBrand(c.statement, domains, keyword));
  if (kept.length !== claims.length) {
    console.warn(`[knowledgeEngine] dropped ${claims.length - kept.length} claim(s) naming a competitor`);
  }
  return kept;
}
