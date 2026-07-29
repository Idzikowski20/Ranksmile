// POST /api/v1/wordpress/import_content — plugin exports a WP post into our editor.
// Creates a draft article from the WP content and returns { id, permalink_hash }.
import type { NextApiRequest, NextApiResponse } from 'next';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { getDomainIdForWorkspace, createArticleFromWp, permalinkHash } from '../../../../lib/wpDraft';
import { withOrgPaymentAccess } from '../../../../lib/requireOrgPaymentAccess';

async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const domainId = await getDomainIdForWorkspace(conn.workspace_id);
   if (!domainId) return res.status(400).json({ message: 'No domain linked to this workspace.' });

   const b = req.body || {};
   const keywords = Array.isArray(b.keywords) ? b.keywords : String(b.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean);
   const keyword = keywords[0] || '';
   const title = (b.meta_title && String(b.meta_title).trim()) || keyword || 'Imported from WordPress';

   const id = await createArticleFromWp({ domainId, title, keyword, content: String(b.content || '') });
   if (!id) return res.status(500).json({ message: 'Failed to create draft.' });

   // The plugin opens this `url` in a new tab (window.open) so the user lands in our editor.
   const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
   const origin = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${req.headers.host || 'localhost:3000'}`).replace(/\/+$/, '');
   return res.status(200).json({ id, permalink_hash: permalinkHash(id), url: `${origin}/drafts/${id}` });
}

export default withOrgPaymentAccess(handler);
