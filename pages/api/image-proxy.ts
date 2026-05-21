// GET /api/image-proxy?url=<encoded-image-url>
// Fetches an external image server-side and streams it back to the browser.
// This bypasses hotlink protection (Referer checks) on source websites.
import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'GET') return res.status(405).end();

   const { url } = req.query;
   if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url param required' });

   let decoded: string;
   try {
      decoded = decodeURIComponent(url);
      new URL(decoded); // validate
   } catch {
      return res.status(400).json({ error: 'Invalid URL' });
   }

   try {
      const response = await fetch(decoded, {
         headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
         },
      });

      if (!response.ok) {
         return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
      }

      const contentType = response.headers.get('content-type') || '';
      const baseType = contentType.split(';')[0].trim().toLowerCase();

      if (!ALLOWED_CONTENT_TYPES.some((t) => baseType.startsWith(t.split('/')[0]) && contentType.includes(t.split('/')[1]))) {
         return res.status(415).json({ error: 'Not an image' });
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_SIZE) {
         return res.status(413).json({ error: 'Image too large' });
      }

      res.setHeader('Content-Type', contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).send(Buffer.from(buffer));
   } catch (err: any) {
      console.error('[image-proxy] error:', err?.message);
      return res.status(500).json({ error: 'Failed to fetch image' });
   }
}
