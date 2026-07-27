import dns from 'dns';
import net from 'net';

// SSRF guard for any server-side fetch of a user/DB-derived URL (render-page, image-proxy, favicon,
// competitor/sitemap scraping). Blocks non-http(s) schemes and hosts that resolve to private,
// loopback, link-local (incl. cloud-metadata 169.254.169.254) or reserved ranges.

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → block
  const [a, b] = p;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 0) return true;                           // 0.0.0.0/8
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local (AWS/GCP metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                          // multicast / reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v === '::1' || v === '::') return true;                 // loopback / unspecified
  if (v.startsWith('fc') || v.startsWith('fd')) return true;  // fc00::/7 unique-local
  if (v.startsWith('fe80')) return true;                      // fe80::/10 link-local
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);     // IPv4-mapped (::ffff:127.0.0.1)
  if (mapped) return ipv4IsPrivate(mapped[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // not a literal IP we recognize → block to be safe
}

/**
 * Validate that `rawUrl` is an http(s) URL whose host does NOT resolve to a private/reserved
 * address. Throws on any violation (caller returns 400). Returns the parsed URL on success.
 * NOTE: this validates the initial host only — redirects must be disabled or re-validated by
 * the caller (fetch `redirect: 'manual'`, puppeteer redirect interception).
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.localhost)$/i.test(host)) throw new Error('Blocked host');
  // Literal IP in the URL → check directly (no DNS).
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Blocked private address');
    return u;
  }
  // Hostname → resolve ALL addresses and reject if any is private (DNS-rebinding-resistant).
  let addrs: { address: string }[];
  try { addrs = await dns.promises.lookup(host, { all: true }); } catch { throw new Error('DNS resolution failed'); }
  if (!addrs.length) throw new Error('DNS resolution failed');
  for (const a of addrs) if (isPrivateAddress(a.address)) throw new Error('Blocked private address');
  return u;
}

/**
 * Fetch following redirects manually, re-validating every hop with assertPublicUrl.
 * Use this instead of fetch(..., { redirect: 'follow' }) / axios maxRedirects for user URLs.
 */
export async function ssrfSafeFetch(
  initial: string,
  init: RequestInit = {},
  maxRedirects = 4,
): Promise<Response> {
  let current = initial;
  for (let i = 0; i < maxRedirects; i += 1) {
    await assertPublicUrl(current);
    // eslint-disable-next-line no-await-in-loop
    const r = await fetch(current, { ...init, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (!loc) return r;
      current = new URL(loc, current).toString();
      continue;
    }
    return r;
  }
  throw new Error('Too many redirects');
}
