// GET /api/favicon?domain=example.com
// Generuje SVG placeholder z pierwszą literą domeny + próbuje pobrać prawdziwe favicon
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { assertPublicUrl } from '../../lib/ssrfGuard';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

function colorForDomain(domain: string): string {
   let hash = 0;
   for (let i = 0; i < domain.length; i++) hash = domain.charCodeAt(i) + ((hash << 5) - hash);
   return COLORS[Math.abs(hash) % COLORS.length];
}

function svgPlaceholder(domain: string): string {
   const letter = domain.replace(/^www\./, '').charAt(0).toUpperCase();
   const bg = colorForDomain(domain);
   return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${bg}"/>
  <text x="32" y="44" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#fff">${letter}</text>
</svg>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const { domain } = req.query;
   if (!domain || typeof domain !== 'string') return res.status(400).end();

   // Spróbuj pobrać prawdziwe favicon z domeny
   const sources = [
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://${domain}/favicon.ico`,
   ];

   for (const url of sources) {
      try {
         await assertPublicUrl(url); // block ?domain= pointing at private/loopback/metadata hosts
         const upstream = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 4000,
            maxRedirects: 2,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            validateStatus: (s) => s === 200,
         });
         const ct = (String(upstream.headers['content-type'] || '')).split(';')[0].trim();
         // Akceptuj tylko prawdziwe formaty graficzne
         if (ct && (ct.startsWith('image/') || ct === 'application/octet-stream') && upstream.data?.length > 100) {
            res.setHeader('Content-Type', ct === 'image/x-icon' ? 'image/png' : ct);
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
            return res.status(200).send(Buffer.from(upstream.data));
         }
      } catch { /* próbuj kolejne źródło */ }
   }

   // Fallback — SVG z literą domeny (zawsze działa)
   res.setHeader('Content-Type', 'image/svg+xml');
   res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
   return res.status(200).send(svgPlaceholder(domain));
}
