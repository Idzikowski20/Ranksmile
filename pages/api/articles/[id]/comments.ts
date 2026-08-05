// Comments for an article (owner session). Threaded: a root comment is
// anchored to a quote and can hold replies (parent_id). Resolve marks a thread done.
//   GET    /api/articles/[id]/comments              — list (roots + threads)
//   POST   /api/articles/[id]/comments              — create root, or reply (parentId)
//   PATCH  /api/articles/[id]/comments              — edit body, or set resolved
//   DELETE /api/articles/[id]/comments?commentId    — remove (root deletes its replies)
import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import db from '../../../../database/database';
import { ensureArticlesTables } from '../../../../lib/ensureArticlesTables';
import { emitCommentChange } from '../../../../lib/commentBus';
import { getCommentAccessKind } from '../../../../lib/commentAccess';
import { getErrorMessage } from '../../../../lib/errors';
import { queryOne } from '../../../../lib/db/query';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

type Row = {
   id: string; quote: string; body: string; images_json: string; author: string; color: string;
   parent_id: string | null; resolved: number | null; created_at: string; updated_at: string | null;
   reactions_json: string | null; avatar_url: string | null;
};

// DB CURRENT_TIMESTAMP is UTC but written without a timezone marker; `new Date`
// would parse it as local time (e.g. +2h in Poland). Treat tz-less strings as UTC.
const ts = (v: string | Date | null): number | null => {
   if (!v) return null;
   // node-pg parses TIMESTAMP (without time zone) into a Date using the server's
   // LOCAL timezone, but the value is stored in UTC. Rebuild the instant treating
   // the wall-clock components as UTC. (SQLite returns a UTC string — handled below.)
   if (v instanceof Date) {
      return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds(), v.getMilliseconds());
   }
   const s = String(v).trim();
   const hasTz = /([zZ]|[+-]\d\d:?\d\d)$/.test(s);
   const t = new Date(hasTz ? s : `${s.replace(' ', 'T')}Z`).getTime();
   return Number.isNaN(t) ? null : t;
};

const parseReactions = (raw: string | null): Record<string, string[]> => {
   try { const r = JSON.parse(raw || '{}'); return r && typeof r === 'object' ? r : {}; } catch { return {}; }
};

const shape = (r: Row) => ({
   id: r.id,
   parentId: r.parent_id || null,
   quote: r.quote || '',
   text: r.body || '',
   images: (() => { try { return JSON.parse(r.images_json || '[]'); } catch { return []; } })(),
   author: r.author || 'You',
   color: r.color || '#F84416',
   avatar: r.avatar_url || '',
   resolved: !!r.resolved,
   reactions: parseReactions(r.reactions_json),
   createdAt: ts(r.created_at) || Date.now(),
   updatedAt: ts(r.updated_at),
});

type Shaped = ReturnType<typeof shape>;

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureArticlesTables();

   const { id } = req.query;
   if (!id) return res.status(400).json({ error: 'id is required' });

   // Owner session required — raw article id alone must not expose another tenant's comments.
   const articleId = parseInt(String(id), 10);
   const access = await getCommentAccessKind(req, res, articleId);
   if (!access) {
      return res.status(403).json({ error: 'Access denied.' });
   }

   try {
      if (req.method === 'GET') {
         const [rows] = await db.query(
            `SELECT id, quote, body, images_json, author, color, parent_id, resolved, created_at, updated_at, reactions_json, avatar_url
             FROM article_comments WHERE article_id = ? ORDER BY created_at ASC`,
            { replacements: [id] },
         );
         const all = (rows as Row[]).map(shape);
         const roots = all.filter((c) => !c.parentId);
         const threads = roots.map((root) => ({
            ...root,
            replies: all.filter((c) => c.parentId === root.id),
         }));
         // `comments` keeps the flat root list the inline CommentsLayer anchors against.
         return res.status(200).json({ comments: roots as Shaped[], threads });
      }

      if (req.method === 'POST') {
         const { quote = '', text = '', images = [], author = 'You', color = '#F84416', avatar = '', parentId = null } = req.body || {};
         const commentId = `c_${randomBytes(6).toString('hex')}`;
         // Replies don't carry their own anchor quote.
         const q = parentId ? '' : quote;
         await db.query(
            `INSERT INTO article_comments (id, article_id, quote, body, images_json, author, color, avatar_url, parent_id, is_owner, resolved, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
            { replacements: [commentId, id, q, text, JSON.stringify(images), author, color, avatar, parentId, 1] },
         );
         emitCommentChange(String(id), { type: 'create', commentId, parentId });
         return res.status(200).json({
            comment: { id: commentId, parentId: parentId || null, quote: q, text, images, author, color, avatar, resolved: false, reactions: {}, createdAt: Date.now(), updatedAt: null },
         });
      }

      if (req.method === 'PATCH') {
         const { commentId, text, resolved, reaction } = req.body || {};
         if (!commentId) return res.status(400).json({ error: 'commentId is required' });
         if (typeof resolved === 'boolean') {
            await db.query(`UPDATE article_comments SET resolved = ? WHERE id = ? AND article_id = ?`,
               { replacements: [resolved ? 1 : 0, commentId, id] });
         }
         if (typeof text === 'string') {
            await db.query(`UPDATE article_comments SET body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND article_id = ?`,
               { replacements: [text, commentId, id] });
         }
         // Toggle a reactor for an emoji (read-modify-write on reactions_json).
         if (reaction && reaction.emoji && reaction.author) {
            const row = await queryOne<{ reactions_json: string | null }>(`SELECT reactions_json FROM article_comments WHERE id = ? AND article_id = ?`, [commentId, id]);
            const current = parseReactions(row?.reactions_json ?? null);
            const who = new Set(current[reaction.emoji] || []);
            if (who.has(reaction.author)) who.delete(reaction.author); else who.add(reaction.author);
            if (who.size) current[reaction.emoji] = [...who]; else delete current[reaction.emoji];
            await db.query(`UPDATE article_comments SET reactions_json = ? WHERE id = ? AND article_id = ?`,
               { replacements: [JSON.stringify(current), commentId, id] });
         }
         emitCommentChange(String(id), { type: 'update', commentId });
         return res.status(200).json({ ok: true });
      }

      if (req.method === 'DELETE') {
         const { commentId } = req.query;
         if (!commentId) return res.status(400).json({ error: 'commentId is required' });
         // Deleting a root removes its whole thread (replies anchored to it).
         await db.query(`DELETE FROM article_comments WHERE article_id = ? AND (id = ? OR parent_id = ?)`,
            { replacements: [id, commentId, commentId] });
         emitCommentChange(String(id), { type: 'delete', commentId });
         return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) || 'DB error' });
   }
}

export default withOrgPaymentAccess(handler);
