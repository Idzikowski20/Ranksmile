import { createHash, timingSafeEqual } from 'crypto';

/** Digest first so timingSafeEqual always sees equal-length buffers (a length
 *  mismatch would throw and leak the secret's length). */
export function timingSafeEqualText(left: string, right: string): boolean {
   const a = createHash('sha256').update(left).digest();
   const b = createHash('sha256').update(right).digest();
   return timingSafeEqual(a, b);
}
