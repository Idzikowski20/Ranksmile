// POST /api/articles/generate
// Wywołuje Python sidecar, zapisuje draft artykułu do SQLite
import type { NextApiRequest, NextApiResponse } from 'next';
import { QueryTypes } from 'sequelize';
import axios from 'axios';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { domainId, keyword, language = 'pl', tone = 'professional' } = req.body;

   if (!domainId || !keyword) {
      return res.status(400).json({ error: 'domainId and keyword are required' });
   }

   try {
      // Pobierz URL domeny
      const [domains] = await db.query(
         `SELECT * FROM domain WHERE ID = ? LIMIT 1`,
         { replacements: [domainId] },
      );
      const domain = (domains as any[])[0];
      if (!domain) return res.status(404).json({ error: 'Domain not found' });

      // Pobierz istniejące artykuły dla domeny (do internal linkingu)
      const [existingArticles] = await db.query(
         `SELECT id, title, meta_url, target_keyword
          FROM articles
          WHERE domain_id = ? AND status = 'published' AND meta_url IS NOT NULL AND meta_url != ''
          ORDER BY created_at DESC
          LIMIT 30`,
         { replacements: [domainId] },
      );
      const domainArticles = (existingArticles as any[]).map((a: any) => ({
         id: a.id,
         title: a.title,
         url: `https://${domain.domain}/${(a.meta_url || '').replace(/^\//, '')}`,
      }));

      // Wywołaj Python sidecar
      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');

      let sidecarData: any = null;
      try {
         console.log(`[generate] Calling sidecar: ${sidecarUrl}/generate with ${domainArticles.length} domain articles`);
         const sidecarRes = await axios.post(
            `${sidecarUrl}/generate`,
            { url: `https://${domain.domain}`, keyword, language, tone, existing_articles: domainArticles },
            { timeout: 300000 }, // 5 minut — generowanie artykułu jest długie
         );
         sidecarData = sidecarRes.data;
         console.log(`[generate] Sidecar responded OK`);
      } catch (sidecarError: any) {
         // Jeśli sidecar niedostępny — stwórz placeholder draft
         const errDetail = sidecarError?.response?.data || sidecarError?.message || 'unknown';
         console.warn('Sidecar unavailable, creating placeholder:', errDetail);
         sidecarData = {
            article_html: `<h1>${keyword}</h1><p>Artykuł zostanie wygenerowany po uruchomieniu Python sidecar.</p>`,
            meta_title: keyword,
            meta_description: `Artykuł o: ${keyword}`,
            meta_url: keyword.toLowerCase().replace(/\s+/g, '-'),
            schema_json: {},
            score_data: { terms: [], words_target: 2000, words_min: 1500, words_max: 2500, headings_target: 15, headings_min: 10, headings_max: 20 },
            internal_links: [],
         };
      }

      // Zapisz draft do SQLite
      // QueryTypes.INSERT zwraca [lastInsertRowid, rowsAffected] dla SQLite
      const [articleId] = await db.query(
         `INSERT INTO articles
            (domain_id, title, content, target_keyword, meta_title, meta_description, meta_url,
             schema_json, score_data, internal_links_cache, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`,
         {
            replacements: [
               domainId,
               sidecarData.meta_title || keyword,
               sidecarData.article_html || '',
               keyword,
               sidecarData.meta_title || keyword,
               sidecarData.meta_description || '',
               sidecarData.meta_url || '',
               JSON.stringify(sidecarData.article_schema || sidecarData.schema_json || {}),
               JSON.stringify(sidecarData.score_data || {}),
               JSON.stringify({ suggestions: sidecarData.internal_links || [] }),
            ],
            type: QueryTypes.INSERT,
         },
      );

      return res.status(200).json({
         articleId,
         ...sidecarData,
      });
   } catch (error: any) {
      console.error('generate error:', error);
      return res.status(500).json({ error: error?.message || 'Generation failed' });
   }
}
