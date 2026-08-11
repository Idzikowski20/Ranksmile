import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from '../../../../lib/dataforseo';
import { getErrorMessage } from '../../../../lib/errors';
import {
  getDomainLocale,
  looksLikeLanguage,
  promptTemplatesForLocale,
} from '../../../../lib/domainLanguage';
import { ensureAiVisibilityTables } from '../../../../lib/ensureAiVisibilityTables';
import { queryOne } from '../../../../lib/db/query';
import { parseJsonish } from '../../../../lib/types/json';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

/** Provenance tag from where Google surfaced the question. */
const provenanceFor = (domain: string): string[] => {
   if (/reddit\.com$/i.test(domain)) return ['reddit'];
   if (/quora\.com$/i.test(domain)) return ['quora'];
   return ['google'];
};

function buildPromptList(
  locale: { languageCode: string },
  topicTrimmed: string,
  questions: Array<{ question: string; domain: string }>,
  related: string[],
) {
  const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
  const fromPaa = questions
    .filter((q) => looksLikeLanguage(q.question, locale.languageCode))
    .slice(0, 8)
    .map((q) => ({ text: q.question, provenance: provenanceFor(q.domain) }));

  const fromRelated = related
    .filter((r) => looksLikeLanguage(r, locale.languageCode))
    .slice(0, Math.max(0, 10 - fromPaa.length))
    .map((r) => ({ text: r, provenance: ['google'] as string[] }));

  const prompts = [...fromPaa, ...fromRelated];
  for (const t of templates) {
    if (prompts.length >= 10) break;
    if (!prompts.some((p) => p.text === t.text)) prompts.push(t);
  }

  if (prompts.length === 0) return { prompts: templates.slice(0, 8), degraded: true as const };
  return { prompts: prompts.slice(0, 10), degraded: false as const };
}

type GeneratedPrompt = { text: string, provenance: string[] };

/**
 * Prompt generation costs a DataForSEO call per topic, and the setup wizard
 * generates for every topic on mount — so revisiting the page used to re-buy
 * the same lists. The pool is stored per (domain, topic) and replayed instead.
 *
 * Degraded results are never stored: they are the template fallback for a
 * missing/failed paid call, and caching them would freeze the topic on
 * templates forever.
 *
 * Read-then-generate alone was not single-flight — two requests for the same
 * (domain, topic) arriving before either wrote both paid, and one write lost to the
 * unique index. `claimTopic` below closes that: the buyer is whoever wins the INSERT.
 */
async function readCached(domainId: number, topic: string): Promise<GeneratedPrompt[] | null> {
   try {
      const row = await queryOne<{ prompts: unknown }>(
         'SELECT prompts FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ? LIMIT 1',
         [domainId, topic],
      );
      const prompts = row ? parseJsonish<GeneratedPrompt[]>(row.prompts) : null;
      return Array.isArray(prompts) && prompts.length > 0 ? prompts : null;
   } catch (e) {
      // Best-effort, exactly like the write: a cache lookup that fails must degrade to
      // generating, not 500 past the paid-call and template fallbacks below.
      console.warn('[generate-prompts] cache read failed:', getErrorMessage(e));
      return null;
   }
}

/** How long a loser waits for the claim holder's pool before buying its own. */
const CLAIM_WAIT_MS = 3000;
const CLAIM_POLL_MS = 400;

/**
 * Claim the (domain, topic) pair by inserting an empty pool. The unique index makes
 * exactly one concurrent request win, and only the winner pays DataForSEO.
 *
 * An empty pool is not a cache hit — `readCached` requires a non-empty array — so a
 * claim abandoned by a crashed request costs the next caller one wait and is then
 * overwritten by `writeCached`'s delete-then-insert. No lock to expire, nothing to
 * clean up on boot.
 */
async function claimTopic(domainId: number, topic: string): Promise<boolean> {
   try {
      await db.query(
         'INSERT INTO ai_vis_generated_prompts (domain_id, topic, prompts) VALUES (?, ?, ?)',
         { replacements: [domainId, topic, '[]'] },
      );
      return true;
   } catch {
      // The unique index rejected it: someone else is already fetching this topic.
      return false;
   }
}

/** Release a claim we are not going to fill, so the next request does not wait on it. */
async function releaseTopic(domainId: number, topic: string): Promise<void> {
   await db.query(
      'DELETE FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ?',
      { replacements: [domainId, topic] },
   ).catch((e) => console.warn('[generate-prompts] claim release failed:', getErrorMessage(e)));
}

/** Poll for the claim holder's pool. Null means it did not arrive in time — buy our own. */
async function waitForCached(domainId: number, topic: string): Promise<GeneratedPrompt[] | null> {
   const deadline = Date.now() + CLAIM_WAIT_MS;
   while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, CLAIM_POLL_MS); });
      // eslint-disable-next-line no-await-in-loop
      const cached = await readCached(domainId, topic);
      if (cached) return cached;
   }
   return null;
}

async function writeCached(domainId: number, topic: string, prompts: GeneratedPrompt[]): Promise<void> {
   // Delete-then-insert rather than ON CONFLICT: the codebase targets both
   // Postgres and SQLite, and the unique index makes this idempotent enough.
   await db.query('DELETE FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ?', { replacements: [domainId, topic] });
   await db.query(
      'INSERT INTO ai_vis_generated_prompts (domain_id, topic, prompts) VALUES (?, ?, ?)',
      { replacements: [domainId, topic, JSON.stringify(prompts)] },
   );
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

   const domainId = (ownership as { ID: number }).ID;
   const { topic, refresh } = req.body as { topic?: string, refresh?: boolean };
   if (!topic?.trim()) return res.status(400).json({ error: 'topic is required' });

   const locale = await getDomainLocale(domainId);
   const topicTrimmed = topic.trim();

   if (!refresh) {
      const cached = await readCached(domainId, topicTrimmed);
      if (cached) return res.status(200).json({ prompts: cached, degraded: false, cached: true });
   }

   if (!isDataForSeoConfigured()) {
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }

   // Only the claim holder pays. `refresh` is an explicit re-buy, so it skips the claim
   // and overwrites whatever is there — including another request's in-flight claim,
   // which is what the user asked for by pressing it.
   let holdsClaim = false;
   if (!refresh) {
      holdsClaim = await claimTopic(domainId, topicTrimmed);
      if (!holdsClaim) {
         const waited = await waitForCached(domainId, topicTrimmed);
         if (waited) return res.status(200).json({ prompts: waited, degraded: false, cached: true });
         // The holder never delivered (it degraded, failed, or is slower than the wait).
         // Buying our own is the wrong-but-cheap outcome the claim exists to make rare.
      }
   }

   try {
      const { questions, related } = await getPeopleAlsoAsk({
         keyword: topicTrimmed,
         country: locale.countryCode,
         languageCode: locale.languageCode,
      });
      const result = buildPromptList(locale, topicTrimmed, questions, related);
      if (!result.degraded) {
         // Non-fatal: a failed write only means the next visit pays again.
         await writeCached(domainId, topicTrimmed, result.prompts)
            .catch((e) => console.warn('[generate-prompts] cache write failed:', getErrorMessage(e)));
      } else if (holdsClaim) {
         // Nothing will fill this claim: templates are never cached.
         await releaseTopic(domainId, topicTrimmed);
      }
      return res.status(200).json(result);
   } catch (error) {
      // DataForSEO locale mismatch — still return Polish/English templates instead of 500 toasts.
      console.warn('[generate-prompts] PAA failed, using templates:', getErrorMessage(error));
      if (holdsClaim) await releaseTopic(domainId, topicTrimmed);
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }
}

export default withOrgPaymentAccess(handler);
