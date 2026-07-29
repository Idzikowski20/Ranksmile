import type { NextApiRequest, NextApiResponse } from 'next';
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
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

export const config = { maxDuration: 60 };

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

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

   const domainId = (ownership as { ID: number }).ID;
   const { topic } = req.body as { topic?: string };
   if (!topic?.trim()) return res.status(400).json({ error: 'topic is required' });

   const locale = await getDomainLocale(domainId);
   const topicTrimmed = topic.trim();

   if (!isDataForSeoConfigured()) {
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }

   try {
      const { questions, related } = await getPeopleAlsoAsk({
         keyword: topicTrimmed,
         country: locale.countryCode,
         languageCode: locale.languageCode,
      });
      const result = buildPromptList(locale, topicTrimmed, questions, related);
      return res.status(200).json(result);
   } catch (error) {
      // DataForSEO locale mismatch — still return Polish/English templates instead of 500 toasts.
      console.warn('[generate-prompts] PAA failed, using templates:', getErrorMessage(error));
      const templates = promptTemplatesForLocale(locale.languageCode, topicTrimmed);
      return res.status(200).json({ prompts: templates.slice(0, 8), degraded: true });
   }
}

export default withOrgPaymentAccess(handler);
