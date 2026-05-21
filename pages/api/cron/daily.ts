// GET /api/cron/daily — Vercel Cron trigger
// Automatycznie generuje artykuł dla każdej aktywnej domeny z topics
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   // Weryfikuj Vercel Cron Secret
   if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   await db.sync();

   try {
      // Pobierz wszystkie domeny z topics w site_context
      const [domains] = await db.query(
         `SELECT d.ID, d.domain, sc.topics
          FROM domain d
          JOIN site_context sc ON sc.domain_id = d.ID
          WHERE sc.topics IS NOT NULL AND sc.topics != '[]'`,
      );

      const triggered: string[] = [];

      for (const domain of domains as any[]) {
         let topics: string[] = [];
         try {
            topics = JSON.parse(domain.topics || '[]');
         } catch {
            continue;
         }
         if (!topics.length) continue;

         // Pobierz już użyte keywords
         const [usedRows] = await db.query(
            `SELECT target_keyword FROM articles WHERE domain_id = ?`,
            { replacements: [domain.ID] },
         );
         const usedTopics = (usedRows as any[]).map((r) => r.target_keyword);

         // Znajdź następny nieużyty topic
         const nextTopic = topics.find((t: string) => !usedTopics.includes(t)) || topics[0];

         // Trigger generowania przez wewnętrzny fetch
         const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
         try {
            await fetch(`${baseUrl}/api/articles/generate`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  // Przekaż secret żeby ominąć auth w trybie cron
                  'x-cron-secret': process.env.CRON_SECRET || '',
               },
               body: JSON.stringify({ domainId: domain.ID, keyword: nextTopic }),
            });
            triggered.push(`${domain.domain}: ${nextTopic}`);
         } catch (fetchErr) {
            console.error(`Failed to trigger for ${domain.domain}:`, fetchErr);
         }
      }

      return res.status(200).json({ triggered: triggered.length, details: triggered });
   } catch (error: any) {
      return res.status(500).json({ error: error?.message });
   }
}
