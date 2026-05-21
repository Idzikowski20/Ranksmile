// POST /api/articles/generate-image
// Proxy do Python sidecar — generuje obraz dla artykułu
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import verifyUser from '../../../utils/verifyUser';

// Obraz jako base64 może mieć 500KB+ — zwiększ limit odpowiedzi
export const config = {
   api: { responseLimit: '10mb' },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   const { keyword, title } = req.body;
   if (!keyword) return res.status(400).json({ error: 'keyword is required' });

   // Use article title as the image generation prompt — more specific than just the keyword
   const prompt = title || keyword;

   try {
      const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
      const sidecarRes = await axios.post(
         `${sidecarUrl}/generate-image`,
         { keyword, title: prompt },
         { timeout: 120000 },
      );
      return res.status(200).json(sidecarRes.data);
   } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Image generation failed';
      console.error('[generate-image] error:', detail);
      return res.status(500).json({ error: detail });
   }
}
