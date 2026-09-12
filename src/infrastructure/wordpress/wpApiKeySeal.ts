import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v2';

/**
 * WordPress plugin keys must remain recoverable (we send them back to the site
 * on publish/disconnect). Hash-only storage would break that, so we store
 * sha256(lookup) + AES-256-GCM(ciphertext). A leaked DB backup without env
 * secrets is not enough to impersonate a plugin.
 */
function kek(): Buffer {
   const material = process.env.WP_API_KEY_SECRET
      || process.env.AUTH0_SECRET
      || process.env.BETTER_AUTH_SECRET
      || process.env.DATABASE_URL
      || 'ranksmile-dev-wp-key';
   return createHash('sha256').update(`wp-api-key:${material}`).digest();
}

export function hashApiKey(raw: string): string {
   return createHash('sha256').update(raw).digest('hex');
}

export function isSealedApiKey(stored: string): boolean {
   return stored.startsWith(`${PREFIX}:`);
}

export function sealApiKey(raw: string): string {
   const hash = hashApiKey(raw);
   const iv = randomBytes(12);
   const cipher = createCipheriv('aes-256-gcm', kek(), iv);
   const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
   const tag = cipher.getAuthTag();
   return `${PREFIX}:${hash}:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function unsealApiKey(stored: string): string | null {
   if (!isSealedApiKey(stored)) return stored;
   const parts = stored.split(':');
   if (parts.length !== 5) return null;
   const [, , ivHex, tagHex, encHex] = parts;
   try {
      const decipher = createDecipheriv('aes-256-gcm', kek(), Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return Buffer.concat([
         decipher.update(Buffer.from(encHex, 'hex')),
         decipher.final(),
      ]).toString('utf8');
   } catch {
      return null;
   }
}

export function sealedLookupPrefix(raw: string): string {
   return `${PREFIX}:${hashApiKey(raw)}:`;
}
