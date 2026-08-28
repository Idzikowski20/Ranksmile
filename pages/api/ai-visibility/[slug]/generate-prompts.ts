import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from '../../../../lib/dataforseo';
import { getErrorMessage } from '@/src/core/shared/errors';
import {
  getDomainLocale,
  looksLikeLanguage,
  promptTemplatesForLocale,
} from '../../../../lib/domainLanguage';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { queryOne } from '@/src/infrastructure/db/query';
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

/** How long a loser waits for the claim holder's pool before buying its own. */
const CLAIM_WAIT_MS = 3000;
const CLAIM_POLL_MS = 400;
/**
 * A claim older than this is treated as abandoned and simply ignored — no wait, no
 * delete. Comfortably longer than a DataForSEO call, short enough that a request killed
 * mid-flight costs one topic one extra call and nothing after that.
 */
const CLAIM_STALE_MS = 60_000;

/** What the (domain, topic) row currently is: a finished pool, or somebody's claim. */
type TopicRow =
   | { pool: GeneratedPrompt[]; claimAgeMs: null }
   | { pool: null; claimAgeMs: number | null };

/**
 * The row as it stands. `claimAgeMs` is null when there is no row at all, and a number
 * when the row is a claim rather than a pool.
 *
 * A claim's own age decides whether it is worth waiting for. Reading it from the row
 * beats a lease table: there is nothing to renew and nothing to sweep. On SQLite the
 * timestamp is UTC text that JS parses as local, so the age can read hours too large —
 * the claim is then treated as abandoned, which costs a duplicate call in dev and never
 * blocks. Production is Postgres, where the driver returns a real Date.
 */
async function readTopic(domainId: number, topic: string): Promise<TopicRow> {
   try {
      const row = await queryOne<{ prompts: unknown; created_at: string | Date | null }>(
         'SELECT prompts, created_at FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ? LIMIT 1',
         [domainId, topic],
      );
      if (!row) return { pool: null, claimAgeMs: null };
      const prompts = parseJsonish<GeneratedPrompt[]>(row.prompts);
      if (Array.isArray(prompts) && prompts.length > 0) return { pool: prompts, claimAgeMs: null };
      const claimedAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
      return { pool: null, claimAgeMs: Number.isNaN(claimedAt) ? CLAIM_STALE_MS : Date.now() - claimedAt };
   } catch (e) {
      // Best-effort, exactly like the write: a cache lookup that fails must degrade to
      // generating, not 500 past the paid-call and template fallbacks below.
      console.warn('[generate-prompts] cache read failed:', getErrorMessage(e));
      return { pool: null, claimAgeMs: null };
   }
}

/**
 * Claim the (domain, topic) pair. The unique index makes exactly one concurrent request
 * win, and only the winner pays DataForSEO. Returns the token that identifies this
 * request's claim, or null if someone else already holds one.
 *
 * The token is what makes the claim releasable without racing: a request may only
 * delete the exact row it inserted. An earlier version deleted by (domain, topic), so a
 * slow request that ended in templates could erase a newer request's claim — or the
 * pool a concurrent `refresh` had just written.
 *
 * A claim is not a cache hit either way: `readTopic` requires a non-empty array, and
 * the token is an object.
 */
async function claimTopic(domainId: number, topic: string): Promise<string | null> {
   const token = JSON.stringify({ claim: randomUUID() });
   try {
      await db.query(
         'INSERT INTO ai_vis_generated_prompts (domain_id, topic, prompts) VALUES (?, ?, ?)',
         { replacements: [domainId, topic, token] },
      );
      return token;
   } catch {
      // The unique index rejected it: someone else is already fetching this topic.
      return null;
   }
}

/** Drop our own claim when nothing will fill it. Matches on the token, so it can only
 *  ever remove the row this request inserted. */
async function releaseTopic(domainId: number, topic: string, token: string): Promise<void> {
   await db.query(
      'DELETE FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ? AND prompts = ?',
      { replacements: [domainId, topic, token] },
   ).catch((e) => console.warn('[generate-prompts] claim release failed:', getErrorMessage(e)));
}

/** Poll for the claim holder's pool. Null means it did not arrive in time — buy our own. */
async function waitForCached(domainId: number, topic: string): Promise<GeneratedPrompt[] | null> {
   const deadline = Date.now() + CLAIM_WAIT_MS;
   while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, CLAIM_POLL_MS); });
      // eslint-disable-next-line no-await-in-loop
      const current = await readTopic(domainId, topic);
      if (current.pool) return current.pool;
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

   const existing = refresh ? null : await readTopic(domainId, topicTrimmed);
   if (existing?.pool) return res.status(200).json({ prompts: existing.pool, degraded: false, cached: true });

   if (!isDataForSeoConfigured()) {
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }

   // Only the claim holder pays. `refresh` is an explicit re-buy, so it skips the claim
   // and overwrites whatever is there — including another request's in-flight claim,
   // which is what the user asked for by pressing it.
   //
   // Three states, and the row we already read tells them apart. No row: claim it and
   // buy. A claim younger than CLAIM_STALE_MS: its holder is still working, so wait for
   // its pool and only buy if it never lands. A claim older than that: its holder is
   // gone, so ignore it and buy — a successful write replaces it, and nothing has to
   // delete a row this request does not own.
   let claimToken: string | null = null;
   let waitForHolder = false;
   if (existing) {
      if (existing.claimAgeMs === null) {
         claimToken = await claimTopic(domainId, topicTrimmed);
         // Lost the INSERT: someone claimed it between our read and our write.
         waitForHolder = claimToken === null;
      } else {
         waitForHolder = existing.claimAgeMs < CLAIM_STALE_MS;
      }
   }
   if (waitForHolder) {
      const waited = await waitForCached(domainId, topicTrimmed);
      if (waited) return res.status(200).json({ prompts: waited, degraded: false, cached: true });
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
      } else if (claimToken) {
         // Nothing will fill this claim: templates are never cached.
         await releaseTopic(domainId, topicTrimmed, claimToken);
      }
      return res.status(200).json(result);
   } catch (error) {
      // DataForSEO locale mismatch — still return Polish/English templates instead of 500 toasts.
      console.warn('[generate-prompts] PAA failed, using templates:', getErrorMessage(error));
      if (claimToken) await releaseTopic(domainId, topicTrimmed, claimToken);
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }
}

export default withOrgPaymentAccess(handler);
