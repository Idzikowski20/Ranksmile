import { QueryTypes } from 'sequelize';
import db from '../../database/database';
import { getBrandDnaSummary } from './brandDnaOnboarding';

/**
 * One learn pass per this many days — GLOBAL, not per domain. The pattern store is a
 * single shared file (lib/wie/patternStore.ts), so there is only one updated_at to
 * gate on. See the scoping note on the function below.
 */
const RELEARN_AFTER_DAYS = 14;
/** onboardBrandDna caps at 10 URLs; the best pages are the ones worth learning from. */
const MAX_URLS = 8;
/** Below this a page is a stub, a tag index or a landing page — nothing to learn from. */
const MIN_WORDS = 300;

/**
 * Learn the brand's writing voice from the site's own best-performing pages.
 *
 * This used to be a form in workspace settings — paste 1–10 of your best articles.
 * Nobody should have to: the site audit already crawled and scored the domain's
 * blog pages, so `page_audits` answers "your best articles" better than a text area
 * and stays current without anyone maintaining it.
 *
 * Reads page_audits, not domain_gsc_pages: the latter is created by
 * ensurePipelineTables and truncated on re-run, but nothing ever inserts into it,
 * so the URL list came back empty every time and the pass never actually ran.
 *
 * Never throws: it runs alongside deep analysis, and an article generation must not
 * fail because voice learning did.
 *
 * SCOPE WARNING — the pattern store this writes into is global, not per domain, so
 * whichever domain learns first sets the brand voice every other domain then writes
 * with, and the 14-day gate is shared rather than per domain. Learning was manual and
 * deliberate before (a form in workspace settings); running it automatically off any
 * domain's analysis is what makes the shared scope a problem. Do not "fix" the gate to
 * be per domain while the store stays shared — that just lets domains overwrite each
 * other's voice in turn. Scope the store by domain_id first.
 *
 * ponytail: ceiling = the pass re-runs on a plain 14-day timer rather than when the
 * site actually changes. Upgrade = trigger on publish instead of on a clock.
 */
export async function autoLearnBrandDna(opts: {
  domainId: number;
  keyword?: string;
}): Promise<{ learned: boolean; reason: string; urls: number }> {
  try {
    const summary = await getBrandDnaSummary();
    const updatedAt = summary?.updated_at ? new Date(summary.updated_at).getTime() : 0;
    const ageDays = updatedAt ? (Date.now() - updatedAt) / 86_400_000 : Infinity;
    if (ageDays < RELEARN_AFTER_DAYS) {
      return { learned: false, reason: `dna is ${Math.round(ageDays)}d old`, urls: 0 };
    }

    const rows = await db.query(
      `SELECT url FROM page_audits
        WHERE domain_id = ? AND fetch_status = 'OK' AND word_count >= ?
        ORDER BY COALESCE(score, 0) DESC, word_count DESC
        LIMIT ${MAX_URLS}`,
      { replacements: [opts.domainId, MIN_WORDS], type: QueryTypes.SELECT },
    ) as Array<{ url: string }>;

    const urls = rows.map((r) => r.url).filter((u) => /^https?:\/\//i.test(u));
    // One page teaches nothing about a voice; leave the DNA alone rather than
    // narrowing it to a single article's habits.
    if (urls.length < 2) {
      return { learned: false, reason: `only ${urls.length} audited page(s)`, urls: urls.length };
    }

    const { onboardBrandDna } = await import('./brandDnaOnboarding');
    const result = await onboardBrandDna({ urls, keyword: opts.keyword });
    return {
      learned: true,
      reason: `+${result.patternsAdded} pattern(s)`,
      urls: urls.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { learned: false, reason: `failed: ${message}`, urls: 0 };
  }
}
