// Uploads an image from a URL to Cloudflare R2 (S3-compatible).
// Returns the public CDN URL, or null if upload fails.
//
// Required env vars:
//   R2_ACCOUNT_ID         — Cloudflare account ID
//   R2_ACCESS_KEY_ID      — R2 API token access key
//   R2_SECRET_ACCESS_KEY  — R2 API token secret key
//   R2_BUCKET_NAME        — bucket name (e.g. "ranksmile-media")
//   R2_PUBLIC_URL         — public base URL  (e.g. "https://media.yourdomain.com"
//                           or "https://pub-xxxx.r2.dev" from R2 dev subdomain)

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getErrorMessage } from './errors';
import { assertPublicUrl } from './ssrfGuard';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function getClient(): S3Client {
   const accountId = process.env.R2_ACCOUNT_ID;
   if (!accountId) throw new Error('R2_ACCOUNT_ID env var is not set');
   return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
         accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
         secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
   });
}

async function fetchPublicImage(sourceUrl: string): Promise<Response> {
   let currentUrl = sourceUrl;
   for (let hop = 0; hop < 5; hop += 1) {
      await assertPublicUrl(currentUrl);
      const response = await fetch(currentUrl, {
         headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
         },
         redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
         const location = response.headers.get('location');
         if (!location) return response;
         currentUrl = new URL(location, currentUrl).href;
         continue;
      }
      return response;
   }
   throw new Error('Too many redirects');
}

export async function uploadImageFromUrl(
   sourceUrl: string,
   filename: string,
): Promise<string | null> {
   const bucket = process.env.R2_BUCKET_NAME;
   const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

   if (!bucket || !publicUrl) {
      console.warn('[R2] R2_BUCKET_NAME or R2_PUBLIC_URL not set — skipping image upload');
      return null;
   }

   try {
      const response = await fetchPublicImage(sourceUrl);

      if (!response.ok) {
         console.warn(`[R2] upstream ${response.status} for ${sourceUrl}`);
         return null;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const baseType = contentType.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_MIME.includes(baseType)) {
         console.warn(`[R2] not an image: ${baseType}`);
         return null;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
         console.warn(`[R2] image too large: ${buffer.byteLength} bytes`);
         return null;
      }

      const ext = baseType.split('/')[1].replace('jpeg', 'jpg');
      const random = Math.random().toString(36).slice(2, 8);
      const key = `articles/${filename}-${random}.${ext}`;

      const client = getClient();
      await client.send(new PutObjectCommand({
         Bucket: bucket,
         Key: key,
         Body: Buffer.from(buffer),
         ContentType: baseType,
         CacheControl: 'public, max-age=31536000',
      }));

      return `${publicUrl}/${key}`;
   } catch (err) {
      console.error('[R2] upload error:', getErrorMessage(err));
      return null;
   }
}

/** Parses a `data:image/<type>;base64,<data>` URL into a buffer + content type. Null if invalid/not an image.
 *  String-sliced rather than regex-matched: a greedy `(.+)$` over a multi-MB base64 payload
 *  overflows V8's regex stack. */
export function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
   if (!dataUrl || !dataUrl.startsWith('data:')) return null;
   const comma = dataUrl.indexOf(',');
   if (comma === -1) return null;
   const header = dataUrl.slice(5, comma); // between "data:" and the comma, e.g. "image/gif;base64"
   if (!header.toLowerCase().includes(';base64')) return null; // only base64 data URLs supported
   const contentType = header.split(';')[0].trim().toLowerCase();
   if (!ALLOWED_MIME.includes(contentType)) return null;
   try {
      return { buffer: Buffer.from(dataUrl.slice(comma + 1), 'base64'), contentType };
   } catch {
      return null;
   }
}

/** Uploads an in-memory image buffer to R2 under `keyPrefix/`. Returns the public URL or null. */
export async function uploadImageBuffer(
   buffer: Buffer,
   contentType: string,
   filename: string,
   keyPrefix = 'uploads',
): Promise<string | null> {
   const bucket = process.env.R2_BUCKET_NAME;
   const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
   if (!bucket || !publicUrl) {
      console.warn('[R2] R2_BUCKET_NAME or R2_PUBLIC_URL not set — skipping upload');
      return null;
   }
   const baseType = contentType.split(';')[0].trim().toLowerCase();
   if (!ALLOWED_MIME.includes(baseType)) { console.warn(`[R2] not an allowed image: ${baseType}`); return null; }
   if (buffer.byteLength > MAX_BYTES) { console.warn(`[R2] image too large: ${buffer.byteLength} bytes`); return null; }
   try {
      const ext = baseType.split('/')[1].replace('jpeg', 'jpg');
      const random = Math.random().toString(36).slice(2, 8);
      const key = `${keyPrefix}/${filename}-${random}.${ext}`;
      const client = getClient();
      await client.send(new PutObjectCommand({
         Bucket: bucket, Key: key, Body: buffer, ContentType: baseType,
         CacheControl: 'public, max-age=31536000',
      }));
      return `${publicUrl}/${key}`;
   } catch (err) {
      console.error('[R2] buffer upload error:', getErrorMessage(err));
      return null;
   }
}
