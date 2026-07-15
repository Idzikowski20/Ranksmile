/**
 * Surfer-style Content Score for every page_audit row after domain setup.
 * One score per page: NLP term coverage + word/structure vs top-10 SERP peers.
 */
import { queryRows } from './db/query';
import { readLocalSCData } from '../utils/searchConsole';
import { buildGscUrlKeywordStrings } from '../utils/gsc';
import { getCompetitors, scanCompetitors, setSelection } from './competitorScan';
import { enrichAudit } from './auditEnrich';
import { computeCompetitorContentScore, type CompetitorScoreTargets, type RichTerm } from './competitorContentScore';
import { inferPageKeyword, langFromKeyword, pickBenchmarkKeyword } from './inferPageKeyword';
import { ensureCompetitorsTables } from './ensureCompetitorsTables';
import db from '../database/database';

export const OPTIMIZE_THRESHOLD = 70;
const MAX_PAGES = 100;
const MAX_KEYWORD_BENCHMARKS = 12;

type PageRow = {
   url: string;
   title: string | null;
   word_count: number | null;
   signals_json: string | null;
};

type ParsedSignals = {
   word_count: number;
   heading_count: number;
   paragraph_count: number;
   body_text: string;
};

type Benchmark = {
   terms: RichTerm[];
   targets: CompetitorScoreTargets;
};

function parseSignals(json: string | null, fallbackWords: number): ParsedSignals {
   try {
      const s = JSON.parse(json || '{}') as Record<string, unknown>;
      return {
         word_count: Number(s.word_count ?? fallbackWords) || fallbackWords,
         heading_count: Number(s.heading_count ?? 0) || 0,
         paragraph_count: Number(s.paragraph_count ?? 0) || 0,
         body_text: typeof s.body_text === 'string' ? s.body_text : '',
      };
   } catch {
      return { word_count: fallbackWords, heading_count: 0, paragraph_count: 0, body_text: '' };
   }
}

async function loadBenchmark(
   domainId: number,
   keyword: string,
   language: string,
   sampleUrl: string,
): Promise<Benchmark | null> {
   let comps = await getCompetitors(domainId, keyword).catch(() => []);
   if (!comps.length) {
      try { comps = await scanCompetitors(domainId, keyword, language); } catch { comps = []; }
   }
   if (comps.length && !comps.some((c) => c.selected)) {
      await setSelection(domainId, keyword, comps.map((c) => c.id)).catch(() => {});
   }

   const enriched = await enrichAudit(domainId, sampleUrl, keyword, language).catch(() => null);
   if (enriched?.terms?.length && enriched.contentTargets) {
      return { terms: enriched.terms, targets: enriched.contentTargets };
   }

   // Structure-only fallback when NLP/SERP enrichment is unavailable.
   if (comps.length) {
      const words = comps.map((c) => c.wordCount).filter((n) => n > 0);
      const heads = comps.map((c) => c.headingCount).filter((n) => n > 0);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const terms: RichTerm[] = [{
         term: keyword.toLowerCase(),
         target_count: 2,
         suggested_min: 1,
         suggested_max: 4,
      }];
      return {
         terms,
         targets: {
            avgWords: avg(words) || 1200,
            avgHeadings: avg(heads) || 8,
            avgPs: 6,
         },
      };
   }
   return null;
}

function scorePage(signals: ParsedSignals, bench: Benchmark, keyword: string): number {
   const body = signals.body_text || '';
   let score = computeCompetitorContentScore(
      body,
      signals.word_count,
      signals.heading_count,
      signals.paragraph_count,
      bench.terms,
      bench.targets,
   );
   if (body && keyword) {
      const kwLower = keyword.toLowerCase();
      if (body.toLowerCase().includes(kwLower)) score = Math.min(100, score + 4);
   }
   return Math.max(0, Math.min(100, score));
}

/**
 * Re-score all page_audits (+ matching domain_recommendations) for a domain.
 * Best-effort; safe to call after setup or on demand.
 */
export async function scoreDomainPages(domainId: number): Promise<{ scored: number }> {
   await ensureCompetitorsTables();

   const meta = await queryRows<{ domain: string; language: string | null }>(
      'SELECT domain, language FROM domain WHERE "ID" = ? LIMIT 1',
      [domainId],
   );
   const domainName = meta[0]?.domain || '';
   if (!domainName) return { scored: 0 };

   const domainKeywords = (await queryRows<{ keyword: string }>(
      'SELECT keyword FROM domain_keywords WHERE domain_id = ? ORDER BY COALESCE(volume, 0) DESC LIMIT 30',
      [domainId],
   ).catch(() => [])).map((r) => r.keyword).filter(Boolean);

   const pages = await queryRows<PageRow>(
      `SELECT url, title, word_count, signals_json FROM page_audits
       WHERE domain_id = ? AND fetch_status = 'OK'
       ORDER BY COALESCE(score, 0) ASC, url ASC
       LIMIT ?`,
      [domainId, MAX_PAGES],
   );
   if (!pages.length) return { scored: 0 };

   const scData = await readLocalSCData(domainName);
   const gscByUrl = buildGscUrlKeywordStrings(scData ? scData.thirtyDays : []);
   const defaultLang = meta[0]?.language?.toLowerCase().startsWith('pol') ? 'pl' : 'pl';

   // Unique keywords to benchmark (cap SERP/NLP API cost).
   const keywordPlan: Array<{ keyword: string; sampleUrl: string }> = [];
   const seenKw = new Set<string>();
   for (const p of pages) {
      const kw = inferPageKeyword(p.url, p.title || '', domainKeywords, gscByUrl);
      if (seenKw.has(kw)) continue;
      seenKw.add(kw);
      keywordPlan.push({ keyword: kw, sampleUrl: p.url });
      if (keywordPlan.length >= MAX_KEYWORD_BENCHMARKS) break;
   }
   if (!keywordPlan.length && domainKeywords[0]) {
      keywordPlan.push({ keyword: domainKeywords[0], sampleUrl: pages[0].url });
   }

   const benchmarks = new Map<string, Benchmark>();
   for (const { keyword, sampleUrl } of keywordPlan) {
      const lang = langFromKeyword(keyword) || defaultLang;
      const bench = await loadBenchmark(domainId, keyword, lang, sampleUrl);
      if (bench) benchmarks.set(keyword, bench);
   }

   const cachedKeys = [...benchmarks.keys()];
   let scored = 0;

   for (const p of pages) {
      const pageKw = inferPageKeyword(p.url, p.title || '', domainKeywords, gscByUrl);
      const benchKey = pickBenchmarkKeyword(pageKw, cachedKeys, cachedKeys[0] || pageKw);
      const bench = benchmarks.get(benchKey);
      if (!bench) continue;

      const signals = parseSignals(p.signals_json, p.word_count ?? 0);
      const contentScore = scorePage(signals, bench, pageKw);

      await db.query(
         `UPDATE page_audits SET score = ? WHERE domain_id = ? AND url = ?`,
         { replacements: [contentScore, domainId, p.url] },
      );
      await db.query(
         `UPDATE domain_recommendations SET score = ? WHERE domain_id = ? AND url = ? AND type = 'optimize'`,
         { replacements: [contentScore, domainId, p.url] },
      );
      await db.query(
         `UPDATE articles SET content_score = ?, updated_at = CURRENT_TIMESTAMP
          WHERE domain_id = ? AND (meta_url = ? OR publish_url = ?) AND content_score < ?`,
         { replacements: [contentScore, domainId, p.url, p.url, contentScore] },
      );
      scored += 1;
   }

   // Drop optimize recs that now meet the Surfer-style threshold.
   await db.query(
      `DELETE FROM domain_recommendations WHERE domain_id = ? AND type = 'optimize' AND score >= ?`,
      { replacements: [domainId, OPTIMIZE_THRESHOLD] },
   );

   return { scored };
}
