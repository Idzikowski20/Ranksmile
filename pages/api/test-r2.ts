// GET /api/test-r2 — tests R2 connection by uploading a tiny file and reading it back
// DELETE THIS FILE after confirming R2 works.
import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const accountId = process.env.R2_ACCOUNT_ID;
   const bucket = process.env.R2_BUCKET_NAME;
   const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

   if (!accountId || !bucket || !publicUrl) {
      return res.status(500).json({ ok: false, error: 'Missing R2 env vars', accountId: !!accountId, bucket: !!bucket, publicUrl: !!publicUrl });
   }

   const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
         accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
         secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
   });

   const key = `_test/connection-check-${Date.now()}.txt`;

   try {
      // Upload
      await client.send(new PutObjectCommand({
         Bucket: bucket,
         Key: key,
         Body: Buffer.from('serpbear r2 test ok'),
         ContentType: 'text/plain',
      }));

      const fileUrl = `${publicUrl}/${key}`;

      // Cleanup
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

      return res.status(200).json({ ok: true, message: 'R2 connection successful', fileUrl, bucket, publicUrl });
   } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Unknown error', code: err?.Code });
   }
}
