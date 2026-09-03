import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from '@/src/infrastructure/dataforseo/dataforseo';
import { getErrorMessage } from '@/src/core/shared/errors';
import {
  getDomainLocale,
  languageNameForLlm,
  looksLikeLanguage,
  promptTemplatesForLocale,
} from '@/src/infrastructure/config/domainLanguage';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { generateTrackerPrompts } from '@/src/infrastructure/aiVisibility/aiVisibilityPromptGen';
import { AI_VIS_PROMPTS_PER_TOPIC, isBrandElicitingPrompt } from '@/src/core/domain/aiVisibility/trackerPrompts';
import { queryOne } from '@/src/infrastructure/db/query';
import { parseJsonish } from '@/src/core/shared/types/json';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';

/** Provenance tag from where Google surfaced the question. */
const provenanceFor = (domain: string): string[] => {
   if (/reddit\.com$/i.test(domain)) return ['reddit'];
   if (/quora\.com$/i.test(domain)) return ['quora'];
   return ['google'];
};

/**
 * The topic's prompt pool.
 *
 * Google's questions are evidence of what people ask, not prompts in themselves: a yes/no
 * legal question is answered with the law and a "related search" is a keyword string, and
 * neither can name a company — yet both used to sit in the mention-rate denominator. So
 * the observed questions are filtered to the ones that could elicit a shortlist and handed
 * to the model as material; the model writes one prompt per distinct use case.
 *
 * Falling back to the fixed templates is the degraded path, and degraded pools are never
 * cached — the same rule the paid PAA call already followed.
 */
async function buildPromptList(
  locale: { languageCode: string },
  topicTrimmed: string,
  brand: string,
  siblings: string[],
  questions: Array<{ question: string; domain: string }>,
  related: string[],
) {
  const inLocale = (t: string): boolean => looksLikeLanguage(t, locale.languageCode);
  const observed = [
    ...questions.filter((q) => inLocale(q.question)).map((q) => q.question),
    ...related.filter(inLocale),
  ].filter(isBrandElicitingPrompt);

  const generated = await generateTrackerPrompts({
    topic: topicTrimmed,
    brand,
    language: languageNameForLlm(locale.languageCode),
    observedQuestions: observed,
    siblingTopics: siblings,
  });

  if (generated) {
    // provenance 'llm' distinguishes these from the Google-sourced rows the wizard badges.
    return { prompts: generated.map((text) => ({ text, provenance: ['llm'] })), degraded: false as const };
  }

  // Generation unavailable: keep whatever Google gave us that can name a brand, then top
  // up from the templates so the topic is never left empty.
  const fromGoogle = questions
    .filter((q) => inLocale(q.question) && isBrandElicitingPrompt(q.question))
    .slice(0, AI_VIS_PROMPTS_PER_TOPIC)
    .map((q) => ({ text: q.question, provenance: provenanceFor(q.domain) }));
  const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
  const prompts = [...fromGoogle];
  for (const t of templates) {
    if (prompts.length >= AI_VIS_PROMPTS_PER_TOPIC) break;
    if (!prompts.some((x) => x.text === t.text)) prompts.push(t);
  }
  return { prompts: prompts.slice(0, AI_VIS_PROMPTS_PER_TOPIC), degraded: true as const };
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

const MAX_TOPIC_CHARS = 200;
const MAX_SIBLINGS_IN = 24;

/**
 * Cache identity for a stored pool, beyond the (domain, topic) key.
 *
 * `v` retires the pools written by the fixed-template implementation: they contain the
 * eight substituted frames, which the generator exists to replace, and without a version
 * every already-generated topic would keep serving them forever.
 *
 * `s` is the sibling set the pool was generated against. The prompts partition the service
 * between the tracked topics, so a pool generated when the brand tracked two topics is
 * stale once it tracks four.
 */
const POOL_VERSION = 2;
const poolFingerprint = (siblings: string[]): string => siblings
   .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
   .filter(Boolean)
   .sort()
   .join('|');

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
type TopicRow = {
   /** A pool that is still valid for this request's version and sibling set. */
   pool: GeneratedPrompt[] | null;
   /** Age of somebody's claim, when the row is a claim rather than a pool. */
   claimAgeMs: number | null;
   /** A pool that exists but is superseded — the template-era shape, an older version, or
    *  one generated against a different sibling set. Replaced rather than waited for. */
   stale: boolean;
};

/** What a stored pool looks like from POOL_VERSION 2 on. Version 1 was a bare array. */
type StoredPool = { v: number; s: string; prompts: GeneratedPrompt[] };

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
async function readTopic(domainId: number, topic: string, fingerprint: string): Promise<TopicRow> {
   try {
      const row = await queryOne<{ prompts: unknown; created_at: string | Date | null }>(
         'SELECT prompts, created_at FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ? LIMIT 1',
         [domainId, topic],
      );
      if (!row) return { pool: null, claimAgeMs: null, stale: false };
      const parsed = parseJsonish<unknown>(row.prompts);

      // A bare array is a version-1 pool: the eight substituted template frames the
      // generator replaces. Serving it would mean an already-generated topic never sees a
      // use-case prompt.
      if (Array.isArray(parsed)) return { pool: null, claimAgeMs: null, stale: parsed.length > 0 };

      const stored = parsed as Partial<StoredPool> & { claim?: unknown };
      if (Array.isArray(stored.prompts) && stored.prompts.length > 0) {
         const usable = stored.v === POOL_VERSION && stored.s === fingerprint;
         // Prompts partition the service between the tracked topics, so a pool generated
         // against a different sibling set no longer partitions anything.
         return usable
            ? { pool: stored.prompts as GeneratedPrompt[], claimAgeMs: null, stale: false }
            : { pool: null, claimAgeMs: null, stale: true };
      }

      const claimedAt = row.created_at ? new Date(row.created_at).getTime() : NaN;
      return {
         pool: null,
         claimAgeMs: Number.isNaN(claimedAt) ? CLAIM_STALE_MS : Date.now() - claimedAt,
         stale: false,
      };
   } catch (e) {
      // Best-effort, exactly like the write: a cache lookup that fails must degrade to
      // generating, not 500 past the paid-call and template fallbacks below.
      console.warn('[generate-prompts] cache read failed:', getErrorMessage(e));
      return { pool: null, claimAgeMs: null, stale: false };
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
async function waitForCached(domainId: number, topic: string, fingerprint: string): Promise<GeneratedPrompt[] | null> {
   const deadline = Date.now() + CLAIM_WAIT_MS;
   while (Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, CLAIM_POLL_MS); });
      // eslint-disable-next-line no-await-in-loop
      const current = await readTopic(domainId, topic, fingerprint);
      if (current.pool) return current.pool;
   }
   return null;
}

async function writeCached(domainId: number, topic: string, prompts: GeneratedPrompt[], fingerprint: string): Promise<void> {
   // Delete-then-insert rather than ON CONFLICT: the codebase targets both
   // Postgres and SQLite, and the unique index makes this idempotent enough.
   const envelope: StoredPool = { v: POOL_VERSION, s: fingerprint, prompts };
   await db.query('DELETE FROM ai_vis_generated_prompts WHERE domain_id = ? AND topic = ?', { replacements: [domainId, topic] });
   await db.query(
      'INSERT INTO ai_vis_generated_prompts (domain_id, topic, prompts) VALUES (?, ?, ?)',
      { replacements: [domainId, topic, JSON.stringify(envelope)] },
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
   // Validated, not cast: the body is client input, and a non-string `topic` used to throw
   // inside .trim() before anything checked it. Bounded too — the topic reaches an LLM
   // prompt and a database key.
   const body: Record<string, unknown> = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
   const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
   if (!topic) return res.status(400).json({ error: 'topic is required' });
   if (topic.length > MAX_TOPIC_CHARS) return res.status(400).json({ error: 'topic is too long' });
   const refresh = body.refresh === true;
   // The wizard's other topics: strings only, each bounded, and capped in number. The
   // domain module caps again for what actually reaches the prompt.
   const siblings = (Array.isArray(body.siblingTopics) ? body.siblingTopics : [])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t && t.length <= MAX_TOPIC_CHARS)
      .slice(0, MAX_SIBLINGS_IN);

   const locale = await getDomainLocale(domainId);
   const topicTrimmed = topic;
   // Market context for the generator. The wizard runs before any config exists, so the
   // domain is the fallback — the brand is never named in a prompt either way.
   const cfg = await queryOne<{ brand_name: string }>(
      'SELECT brand_name FROM ai_vis_configs WHERE domain_id = ? ORDER BY id DESC LIMIT 1',
      [domainId],
   ).catch(() => null);
   const brandName = cfg?.brand_name || (ownership as { domain?: string }).domain || topicTrimmed;

   const fingerprint = poolFingerprint(siblings);
   const cached = refresh ? null : await readTopic(domainId, topicTrimmed, fingerprint);
   if (cached?.pool) return res.status(200).json({ prompts: cached.pool, degraded: false, cached: true });
   // A superseded pool is overwritten, exactly like an explicit refresh: there is nobody to
   // wait for, and the row it occupies is replaced by the write below.
   const existing = cached?.stale ? null : cached;

   if (!isDataForSeoConfigured()) {
      // PAA is down, but generation only needs the topic — try it before the templates.
      const generated = await generateTrackerPrompts({
        topic: topicTrimmed,
        brand: brandName,
        language: languageNameForLlm(locale.languageCode),
        observedQuestions: [],
        siblingTopics: siblings,
      });
      if (generated) {
        const prompts = generated.map((text) => ({ text, provenance: ['llm'] }));
        // Cache it: generation costs a model call, and the wizard re-requests every topic
        // on mount. Non-fatal, like the other write.
        await writeCached(domainId, topicTrimmed, prompts, fingerprint)
          .catch((e) => console.warn('[generate-prompts] cache write failed:', getErrorMessage(e)));
        return res.status(200).json({ prompts, degraded: false });
      }
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, AI_VIS_PROMPTS_PER_TOPIC), degraded: true });
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
      const waited = await waitForCached(domainId, topicTrimmed, fingerprint);
      if (waited) return res.status(200).json({ prompts: waited, degraded: false, cached: true });
   }

   try {
      const { questions, related } = await getPeopleAlsoAsk({
         keyword: topicTrimmed,
         country: locale.countryCode,
         languageCode: locale.languageCode,
      });
      const result = await buildPromptList(locale, topicTrimmed, brandName, siblings, questions, related);
      if (!result.degraded) {
         // Non-fatal: a failed write only means the next visit pays again.
         await writeCached(domainId, topicTrimmed, result.prompts, fingerprint)
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
