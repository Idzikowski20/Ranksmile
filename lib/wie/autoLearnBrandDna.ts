import { QueryTypes } from 'sequelize';
import db from '../../database/database';
import { getBrandDnaSummary } from './brandDnaOnboarding';

/** One learn pass per domain per this many days. */
const RELEARN_AFTER_DAYS = 14;
/** onboardBrandDna caps at 10 URLs; the top pages are the ones worth learning from. */
const MAX_URLS = 8;

/**
 * Learn the brand's writing voice from the site's own best-performing pages.
 *
 * This used to be a form in workspace settings — paste 1–10 of your best articles.
 * Nobody should have to. Google already ranks the pages that work, so the top GSC
 * pages for the domain are a better answer to "your best articles" than a text area,
 * and they stay current without anyone maintaining them.
 *
 * Never throws: it runs alongside deep analysis, and an article generation must not
 * fail because voice learning did.
 *
 * ponytail: ceiling = clicks alone pick the pages, so a popular but off-voice page
 * (pricing, contact) can teach the wrong patterns, and the pass re-runs on a plain
 * 14-day timer rather than when the site actually changes. Upgrade = filter to
 * article-shaped URLs via the blog paths the domain already stores, and trigger on
 * publish instead of on a clock.
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
      `SELECT url FROM domain_gsc_pages
        WHERE domain_id = ? AND clicks > 0
        ORDER BY clicks DESC
        LIMIT ${MAX_URLS}`,
      { replacements: [opts.domainId], type: QueryTypes.SELECT },
    ) as Array<{ url: string }>;

    const urls = rows.map((r) => r.url).filter((u) => /^https?:\/\//i.test(u));
    // One page teaches nothing about a voice; leave the DNA alone rather than
    // narrowing it to a single article's habits.
    if (urls.length < 2) {
      return { learned: false, reason: `only ${urls.length} ranked page(s)`, urls: urls.length };
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

export default autoLearnBrandDna;
