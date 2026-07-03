import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';
import { getPeopleAlsoAsk, isDataForSeoConfigured } from '../../../../lib/dataforseo';
import { getErrorMessage } from '../../../../lib/errors';

export const config = { maxDuration: 60 };

/** Provenance tag from where Google surfaced the question. */
const provenanceFor = (domain: string): string[] => {
   if (/reddit\.com$/i.test(domain)) return ['reddit'];
   if (/quora\.com$/i.test(domain)) return ['quora'];
   return ['google'];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });

   const { topic } = req.body as { topic?: string };
   if (!topic?.trim()) return res.status(400).json({ error: 'topic is required' });

   try {
      if (!isDataForSeoConfigured()) {
         // Graceful degradation (same pattern as the free keyword stack): template prompts.
         const base = topic.trim();
         return res.status(200).json({
            prompts: [
               { text: `Jakie są najlepsze rozwiązania: ${base}?`, provenance: [] },
               { text: `${base} — co warto wiedzieć?`, provenance: [] },
               { text: `Które firmy polecacie w temacie: ${base}?`, provenance: [] },
               { text: `${base}: porównanie opcji`, provenance: [] },
               { text: `Jak zacząć: ${base}?`, provenance: [] },
            ],
            degraded: true,
         });
      }
      const { questions, related } = await getPeopleAlsoAsk({ keyword: topic, country: 'PL', languageCode: 'pl' });
      const fromPaa = questions.slice(0, 8).map((q) => ({ text: q.question, provenance: provenanceFor(q.domain) }));
      const fromRelated = related.slice(0, Math.max(0, 10 - fromPaa.length)).map((r) => ({ text: r, provenance: ['google'] }));
      return res.status(200).json({ prompts: [...fromPaa, ...fromRelated] });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'Prompt generation failed' });
   }
}
