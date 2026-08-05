/**
 * WIE Brand DNA onboarding — curated URLs → Quality Judge → brand-layer patterns.
 */
import { fetchPage } from '../auditCompute';
import { judgeArticleQuality, QUALITY_DNA_THRESHOLD } from './qualityJudge';
import { discoverAndAcceptPattern } from './patternDiscovery';
import { bumpDnaVersion, readPatternStore, type PatternStoreSnapshot } from './patternStore';
import { inferIndustry } from './policyResolver';
import { buildHeuristicReaderBrief } from './readerBrief';

export type BrandDnaUrlResult = {
  url: string;
  ok: boolean;
  qualityScore: number;
  passedJudge: boolean;
  patternsAccepted: number;
  error?: string;
  reasons?: string[];
};

export type BrandDnaOnboardResult = {
  dna_version: number;
  processed: BrandDnaUrlResult[];
  acceptedUrls: string[];
  patternsAdded: number;
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function normalizeUrlList(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u !== 'string') continue;
    const t = u.trim();
    if (!/^https?:\/\//i.test(t)) continue;
    out.push(t);
  }
  return [...new Set(out)].slice(0, 10);
}

async function ingestOneUrl(opts: {
  url: string;
  industry: string;
  emotion: string;
  searchIntent: string;
}): Promise<BrandDnaUrlResult> {
  try {
    const { html } = await fetchPage(opts.url);
    const judge = judgeArticleQuality({ html, threshold: QUALITY_DNA_THRESHOLD });
    if (!judge.pass) {
      return {
        url: opts.url,
        ok: true,
        qualityScore: judge.score,
        passedJudge: false,
        patternsAccepted: 0,
        reasons: judge.reasons,
      };
    }

    const source = `brand:${hostname(opts.url)}`;
    let patternsAccepted = 0;

    if (judge.signals.problemFirst) {
      const r = await discoverAndAcceptPattern({
        pattern: 'Problem before definition',
        principle_id: 'answer_user_problem_first',
        reason: `Curated brand URL passed quality (${judge.score}): problem-first opening`,
        conditions: {
          search_intent: [opts.searchIntent],
          industry: [opts.industry],
          emotion: [opts.emotion],
        },
        layer: 'brand',
        industry: opts.industry,
        source,
        evidence: 2,
      });
      if (r.ok) patternsAccepted += 1;
    }

    if (judge.signals.hasExamples) {
      const r = await discoverAndAcceptPattern({
        pattern: 'One concrete example in practical sections',
        principle_id: 'concrete_over_abstract',
        reason: `Curated brand URL passed quality (${judge.score}): concrete examples`,
        conditions: {
          search_intent: [opts.searchIntent],
          emotion: [opts.emotion],
        },
        layer: 'brand',
        industry: opts.industry,
        source,
        evidence: 2,
      });
      if (r.ok) patternsAccepted += 1;
    }

    if (judge.signals.hasExpertMarkers) {
      const r = await discoverAndAcceptPattern({
        pattern: 'Expert voice markers (w praktyce / najczęściej)',
        principle_id: 'concrete_over_abstract',
        reason: `Curated brand URL passed quality (${judge.score}): expert markers`,
        conditions: {
          industry: [opts.industry],
          emotion: [opts.emotion],
        },
        layer: 'brand',
        industry: opts.industry,
        source,
        evidence: 2,
      });
      if (r.ok) patternsAccepted += 1;
    }

    // Always reinforce depth principle via a brand-specific soft pattern when long-form
    if (judge.signals.wordCount >= 1000) {
      const r = await discoverAndAcceptPattern({
        pattern: 'Depth over checklist padding',
        principle_id: 'depth_over_checklist',
        reason: `Long-form curated article (${judge.signals.wordCount} words)`,
        conditions: { search_intent: [opts.searchIntent] },
        layer: 'brand',
        industry: opts.industry,
        source,
        evidence: 1,
      });
      if (r.ok) patternsAccepted += 1;
    }

    return {
      url: opts.url,
      ok: true,
      qualityScore: judge.score,
      passedJudge: true,
      patternsAccepted,
      reasons: judge.reasons,
    };
  } catch (e) {
    return {
      url: opts.url,
      ok: false,
      qualityScore: 0,
      passedJudge: false,
      patternsAccepted: 0,
      error: e instanceof Error ? e.message : 'fetch_failed',
    };
  }
}

/**
 * Onboard 1–10 curated URLs into Brand DNA (Pattern Store layer=brand).
 * Only Quality Judge passers influence DNA; bumps dna_version once if any accepted.
 */
export async function onboardBrandDna(opts: {
  urls: unknown;
  keyword?: string;
  industry?: string;
}): Promise<BrandDnaOnboardResult> {
  const urls = normalizeUrlList(opts.urls);
  const keyword = (opts.keyword || '').trim() || 'content';
  const brief = buildHeuristicReaderBrief({ keyword });
  const industry = (opts.industry || '').trim() || inferIndustry(keyword);

  const processed: BrandDnaUrlResult[] = [];
  let patternsAdded = 0;

  for (const url of urls) {
    const row = await ingestOneUrl({
      url,
      industry,
      emotion: brief.emotion,
      searchIntent: brief.searchIntent,
    });
    processed.push(row);
    patternsAdded += row.patternsAccepted;
  }

  const acceptedUrls = processed.filter((p) => p.passedJudge).map((p) => p.url);
  let store: PatternStoreSnapshot = await readPatternStore();
  if (acceptedUrls.length > 0) {
    store = await bumpDnaVersion(`brand_onboard:${acceptedUrls.length}_urls`);
  }

  return {
    dna_version: store.dna_version,
    processed,
    acceptedUrls,
    patternsAdded,
  };
}

export async function getBrandDnaSummary(): Promise<{
  dna_version: number;
  brandPatternCount: number;
  brandSources: string[];
  updated_at: string;
}> {
  const store = await readPatternStore();
  const brand = store.patterns.filter((p) => p.layer === 'brand');
  const sources = [...new Set(brand.map((p) => p.source).filter(Boolean))];
  return {
    dna_version: store.dna_version,
    brandPatternCount: brand.length,
    brandSources: sources,
    updated_at: store.updated_at,
  };
}
