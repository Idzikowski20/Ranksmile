/**
 * Shared auth for the machine-to-machine pipeline endpoints the sidecar calls.
 *
 * The five internal routes each re-implemented the same header check with `!==`, which
 * compares byte by byte and returns as soon as it differs — the response time leaks how
 * much of the token was guessed right. One helper, one timing-safe comparison, so a fix
 * here covers every route instead of four of five.
 */
import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';

/** Digest first so the comparison is always over equal-length buffers (timingSafeEqual
 *  throws on a length mismatch, which would itself leak the token's length). */
const digest = (v: string): Buffer => createHash('sha256').update(v).digest();

export function isInternalPipelineRequest(req: NextApiRequest): boolean {
   const expected = process.env.INTERNAL_PIPELINE_TOKEN;
   if (!expected) return false; // unset secret must never authorize anything
   const header = req.headers['x-internal-token'];
   // A repeated header arrives as an array — only a single string is a valid credential.
   if (typeof header !== 'string' || !header) return false;
   return timingSafeEqual(digest(header), digest(expected));
}

export default isInternalPipelineRequest;
