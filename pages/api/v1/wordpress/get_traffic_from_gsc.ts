// POST /api/v1/wordpress/get_traffic_from_gsc — per-page GSC traffic for the workspace's
// domain, aggregated by page (clicks/impressions summed, position impression-weighted).
// Shape mirrors Surfer's: { traffic_data: [{ site, clicks, impressions, position }] }.
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../../database/database';
import { authPluginRequest } from '../../../../lib/wpConnection';
import { readLocalSCData } from '../../../../utils/searchConsole';

const cleanHost = (raw: string) => (raw || '')
   .replace(/^sc-domain:/i, '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const conn = await authPluginRequest(req);
   if (!conn) return res.status(401).json({ message: 'Invalid api-key.' });

   const [drows] = await db.query('SELECT domain FROM domain WHERE workspace_id = ? LIMIT 1', { replacements: [conn.workspace_id] });
   const domainRaw = (drows as Array<{ domain: string }>)[0]?.domain || '';
   const host = cleanHost(domainRaw);
   const sc = domainRaw ? await readLocalSCData(domainRaw) : false;
   const items: SearchAnalyticsItem[] = sc && sc.thirtyDays ? sc.thirtyDays : [];

   const map = new Map<string, { clicks: number; impressions: number; posW: number }>();
   items.forEach((it) => {
      const path = it.page || '';
      const e = map.get(path) || { clicks: 0, impressions: 0, posW: 0 };
      const imp = it.impressions || 0;
      e.clicks += it.clicks || 0;
      e.impressions += imp;
      e.posW += (it.position || 0) * imp;
      map.set(path, e);
   });

   let traffic = [...map.entries()].map(([path, v]) => ({
      site: `https://${host}${path.startsWith('/') ? path : `/${path}`}`,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions > 0 ? Number((v.posW / v.impressions).toFixed(1)) : 0,
   }));

   const start = Math.max(0, Number(req.body?.start_row) || 0);
   const limit = Number(req.body?.row_limit) || 1000;
   traffic = traffic.slice(start, start + limit);

   return res.status(200).json({ traffic_data: traffic });
}
