// POST /api/articles/generate-image
// Proxy do Python sidecar — generuje obraz dla artykułu
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import verifyUser from '../../../utils/verifyUser';
import { resolveOrgId, orgBudgetBlocked } from '../../../lib/aiBudget';
import { uploadImageFromUrl } from '../../../lib/uploadToBlob';

// Obraz jako base64 może mieć 500KB+ — zwiększ limit odpowiedzi
export const config = {
   maxDuration: 60,
   api: { responseLimit: '10mb' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { keyword, title } = req.body;
   if (!keyword) return res.status(400).json({ error: 'keyword is required' });

   // Org-wide AI budget: image generation is paid external spend not covered by token accounting,
   // so at minimum block it once the shared pool is exhausted.
   const orgId = await resolveOrgId(req, res);
   const over = await orgBudgetBlocked(orgId);
   if (over) return res.status(429).json(over);

   // Use article title as the image generation prompt — more specific than just the keyword
   const prompt = title || keyword;

   try {
      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
      const sidecarRes = await axios.post(
         `${sidecarUrl}/generate-image`,
         { keyword, title: prompt },
         { timeout: 120000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } },
      );

      // B1: self-host the generated image. Pollinations returns an ephemeral external URL —
      // mirror it into our R2 bucket and return the stable URL instead. Fail-safe: on any
      // upload failure we keep the original URL (and data: URLs are left untouched).
      const data = sidecarRes.data as { url?: string } & Record<string, unknown>;
      if (data?.url && /^https?:\/\//i.test(data.url)) {
         const fname = String(prompt || keyword || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
         const r2 = await uploadImageFromUrl(data.url, fname);
         if (r2) data.url = r2;
      }
      return res.status(200).json(data);
   } catch (rawError) {
      const error = rawError as { message?: string; response?: { data?: { detail?: string } } };
      const detail = error?.response?.data?.detail || error?.message || 'Image generation failed';
      console.error('[generate-image] error:', detail);
      return res.status(500).json({ error: detail });
   }
}
