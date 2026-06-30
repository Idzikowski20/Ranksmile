import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { assertArticleAccess } from '../../../lib/tenancy';
import { splitSections } from '../../../lib/articleSections';
import { buildSectionEvents } from '../../../lib/optimizeSectionEvents';
import type { SectionResult } from '../../../components/articles/optimizeStore';
import { getErrorMessage } from '../../../lib/errors';

export const config = { api: { responseLimit: '10mb' } };

function sse(res: NextApiResponse, event: string, data: object) {
   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
   if (typeof (res as any).flush === 'function') (res as any).flush();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { content, articleId } = req.body as { content: string; articleId?: number };
   if (!content) return res.status(400).json({ error: 'content is required' });

   if (articleId !== undefined) {
      const userId = await getCurrentUserId(req, res);
      if (!(await assertArticleAccess(userId, Number(articleId)))) {
         return res.status(403).json({ error: 'Access denied.' });
      }
   }

   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('Connection', 'keep-alive');
   res.setHeader('X-Accel-Buffering', 'no');
   res.setHeader('Content-Encoding', 'identity');
   res.status(200);
   if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();
   res.write(':ok\n\n');

   try {
      const sections = splitSections(content);
      sse(res, 'meta', { total: sections.length, sections: sections.map((s) => ({ sectionId: s.id, index: s.index, headingText: s.headingText })) });
      const results = new Map<string, SectionResult>();  // passthrough — populated by the LLM stage in a later task
      const events = buildSectionEvents(sections, results);
      for (const ev of events) sse(res, 'section', ev);
      const changedCount = events.filter((e) => e.changed).length;
      sse(res, 'done', { changedCount, total: events.length });
   } catch (error) {
      sse(res, 'error', { message: getErrorMessage(error) || 'Request failed' });
   }

   res.end();
}
