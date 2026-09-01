/**
 * Server-only: fetch SERP competitors and calibrate benchmarks (uses auditCompute + SSRF guard).
 */
import {
  auditContentScore,
  extractFactorValues,
  fetchPage,
  termScoreFraction,
  type RealAuditData,
} from './auditCompute';
import type { CompetitorScoreTargets, RichTerm } from './competitorContentScore';
import { calibrateTermRangesFromCorpus } from './competitorTermCalibration';
import { enrichTermsWithSalience } from './termSalience';

export type { CompetitorScoreTargets, RichTerm } from './competitorContentScore';
export {
  auditContentScore,
  computeCompetitorContentScore,
  termCoverageFraction,
  termRangeCoverageFraction,
  termScoreFraction,
} from './competitorContentScore';

const MAX_COMPETITORS = 8;

const bareHost = (h: string) => h.replace(/^www\./, '');

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Fetch + analyze top SERP URLs; returns calibrated competitor rows + shared targets. */
export async function buildCompetitorBenchmarks(
  keyword: string,
  ownUrl: string,
  competitors: Array<{ url?: string; domain?: string }>,
  terms: RichTerm[],
): Promise<{
  real: RealAuditData;
  targets: CompetitorScoreTargets;
  corpusTexts: string[];
  corpusHtmls: string[];
  /**
   * Same bodies as `corpusTexts`, but addressable. `corpusTexts` drops empties, so its
   * indices do not line up with `real.competitors` — anything that needs to attribute
   * text back to a competitor must go through this.
   */
  corpusByUrl: Record<string, string>;
} | null> {
  let ownHost = '';
  try { ownHost = bareHost(new URL(ownUrl).hostname); } catch { ownHost = ''; }

  const urls = competitors
    .map((c) => c.url || '')
    .filter(Boolean)
    .filter((u) => {
      try { return bareHost(new URL(u).hostname) !== ownHost; } catch { return true; }
    })
    .slice(0, MAX_COMPETITORS);

  if (!urls.length) return null;

  const analyzed = await Promise.all(urls.map(async (compUrl, idx) => {
    try {
      const { html, timing } = await fetchPage(compUrl);
      const m = extractFactorValues(html, compUrl, keyword, timing);
      let domain = '';
      try { domain = new URL(compUrl).hostname; } catch { domain = compUrl; }
      return {
        domain,
        rank: idx + 1,
        values: m.values,
        contentScore: m.contentScore,
        url: compUrl,
        bodyText: m.bodyText,
        html,
      };
    } catch {
      return null;
    }
  }));

  const rows = analyzed.filter((x): x is NonNullable<typeof x> => x !== null);
  if (!rows.length) return null;

  const corpusTexts = rows.map((r) => r.bodyText).filter(Boolean);
  const corpusHtmls = rows.map((r) => r.html).filter(Boolean);
  let calibratedTerms = terms.length && corpusTexts.length
    ? calibrateTermRangesFromCorpus(terms, corpusTexts)
    : terms;
  if (calibratedTerms.length && corpusHtmls.length) {
    calibratedTerms = enrichTermsWithSalience(calibratedTerms, corpusHtmls);
  }

  const targets: CompetitorScoreTargets = {
    avgWords: mean(rows.map((c) => c.values.word_count_body || 0)),
    avgHeadings: mean(rows.map((c) => c.values.h2_h6_count || 0)),
    avgPs: mean(rows.map((c) => c.values.p_count || 0)),
  };

  const structFrac = (v: Record<string, number>) => (
    ((targets.avgHeadings > 0 ? Math.min(1, (v.h2_h6_count || 0) / targets.avgHeadings) : 0)
      + (targets.avgPs > 0 ? Math.min(1, (v.p_count || 0) / targets.avgPs) : 0)) / 2
  );

  const calibrated = rows.map(({ bodyText, ...c }) => {
    if (!calibratedTerms.length) return c;
    const cov = termScoreFraction(bodyText, calibratedTerms);
    const wordFrac = targets.avgWords > 0 ? (c.values.word_count_body || 0) / targets.avgWords : 0;
    return { ...c, contentScore: auditContentScore(cov, wordFrac, structFrac(c.values)) };
  });

  return {
    real: { competitors: calibrated, terms: calibratedTerms, contentTargets: targets },
    targets,
    corpusTexts,
    corpusHtmls,
    corpusByUrl: Object.fromEntries(
      rows.filter((r) => r.bodyText).map((r) => [r.url, r.bodyText]),
    ),
  };
}
