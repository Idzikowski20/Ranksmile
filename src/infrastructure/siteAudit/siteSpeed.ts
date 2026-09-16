/**
 * Site Speed measurements: one PageSpeed Insights (Lighthouse) run per domain on demand,
 * stored so the Site Audit overview can show the last result without re-running a ~30 s
 * audit on every page load.
 */
import { QueryTypes } from 'sequelize';
import db from '@/database/database';
import { parsePageSpeedResult, type SiteSpeedMetrics } from '@/src/core/domain/siteAudit/siteSpeed';

export type SiteSpeedRecord = SiteSpeedMetrics & { url: string; measuredAt: string };

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
/** Lighthouse itself takes 20–40 s; PSI adds queueing. */
const PSI_TIMEOUT_MS = 70_000;

export function isPageSpeedConfigured(): boolean {
  return !!process.env.PAGESPEED_API_KEY?.trim();
}

let ensured = false;
export async function ensureSiteSpeedTable(): Promise<void> {
  if (ensured) return;
  const pg = !!process.env.DATABASE_URL;
  await db.query(`CREATE TABLE IF NOT EXISTS site_speed_measurements (
    id ${pg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
    domain_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    score INTEGER NOT NULL,
    lcp_ms INTEGER,
    tbt_ms INTEGER,
    cls REAL,
    speed_index_ms INTEGER,
    measured_at TIMESTAMP DEFAULT ${pg ? 'NOW()' : 'CURRENT_TIMESTAMP'}
  )`);
  // Idempotent (IF NOT EXISTS), so no catch: a transient failure must propagate and leave
  // `ensured` false, otherwise the index would be memoized as ready without existing.
  await db.query('CREATE INDEX IF NOT EXISTS idx_site_speed_domain ON site_speed_measurements(domain_id, measured_at DESC)');
  ensured = true;
}

/**
 * A stored timestamp → ISO UTC. Postgres returns a Date; SQLite returns an offset-less
 * 'YYYY-MM-DD HH:MM:SS' written by CURRENT_TIMESTAMP, which is UTC — but `new Date(...)`
 * would read it as local time. Tag it as UTC before converting.
 */
function toUtcIso(v: string | Date): string {
  if (v instanceof Date) return v.toISOString();
  const s = v.trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  return new Date(iso).toISOString();
}

type Row = {
  url: string; score: number; lcp_ms: number | null; tbt_ms: number | null;
  cls: number | null; speed_index_ms: number | null; measured_at: string | Date;
};

export async function getLatestSiteSpeed(domainId: number): Promise<SiteSpeedRecord | null> {
  await ensureSiteSpeedTable();
  const rows = await db.query<Row>(
    'SELECT url, score, lcp_ms, tbt_ms, cls, speed_index_ms, measured_at FROM site_speed_measurements WHERE domain_id = ? ORDER BY measured_at DESC LIMIT 1',
    { replacements: [domainId], type: QueryTypes.SELECT },
  );
  const r = rows[0];
  if (!r) return null;
  return {
    url: r.url,
    score: Number(r.score),
    lcpMs: r.lcp_ms ?? null,
    tbtMs: r.tbt_ms ?? null,
    cls: r.cls ?? null,
    speedIndexMs: r.speed_index_ms ?? null,
    measuredAt: toUtcIso(r.measured_at),
  };
}

/** Run Lighthouse through PSI for `url`, store and return the result. Throws on failure. */
export async function measureSiteSpeed(domainId: number, url: string): Promise<SiteSpeedRecord> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) throw new Error('PAGESPEED_API_KEY is not configured');
  await ensureSiteSpeedTable();

  const params = new URLSearchParams({ url, key, strategy: 'mobile', category: 'performance' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  let json: unknown;
  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } } | null)?.error?.message;
      throw new Error(msg || `PageSpeed Insights answered ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }

  const metrics = parsePageSpeedResult(json);
  if (!metrics) throw new Error('PageSpeed Insights returned no performance score for this page');

  await db.query(
    `INSERT INTO site_speed_measurements (domain_id, url, score, lcp_ms, tbt_ms, cls, speed_index_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    { replacements: [domainId, url, metrics.score, metrics.lcpMs, metrics.tbtMs, metrics.cls, metrics.speedIndexMs] },
  );
  return { ...metrics, url, measuredAt: new Date().toISOString() };
}

/**
 * Measure the Site Speed Score for a domain's homepage, resolving the host from the
 * `domain` table. Best-effort and self-contained: safe to call fire-and-forget from the
 * job-progress 'done' callback when a campaign finishes. No-op when PSI is not configured
 * or the domain has no host.
 */
export async function measureDomainSiteSpeed(domainId: number): Promise<void> {
  if (!isPageSpeedConfigured()) return;
  const rows = await db.query<{ domain: string | null }>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    { replacements: [domainId], type: QueryTypes.SELECT },
  );
  const host = rows[0]?.domain?.trim();
  if (!host) return;
  const url = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  await measureSiteSpeed(domainId, url);
}
