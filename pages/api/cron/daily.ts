// GET /api/cron/daily — Vercel Cron trigger
// Automatycznie generuje artykuł dla każdej aktywnej domeny z topics
import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import { getSearchConsoleApiInfo, fetchDomainSCData, hasValidSCAuth } from '../../../utils/searchConsole';
import { ensureGscSnapshotTables } from '../../../lib/ensureGscSnapshotTables';
import { captureWeeklySnapshot, getSnapshot, weekStartFor, shiftWeek } from '../../../lib/gscSnapshots';
import { computeDrops } from '../../../lib/gscDrops';
import { buildGscDigest, loadDigestInlineAttachments, type DomainDigest } from '../../../lib/gscDigestEmail';
import { sendMail } from '../../../lib/sendMail';
import { queryRows, type ArticleRow } from '../../../lib/db/query';
import { getErrorMessage } from '../../../lib/errors';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

// Vercel: LLM/sidecar calls can take up to ~minutes; raise from the ~10s default.
export const config = { maxDuration: 60 };

async function handler(req: NextApiRequest, res: NextApiResponse) {
   // Weryfikuj Vercel Cron Secret
   if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
   }

   await db.sync();

   // Refresh Search Console data for every domain so the dashboard/performance stay current.
   try {
      const scDomains = (await Domain.findAll()).map((el) => el.get({ plain: true }));
      for (const dom of scDomains) {
         try {
            const scApi = await getSearchConsoleApiInfo(dom);
            if (hasValidSCAuth(scApi)) await fetchDomainSCData(dom, scApi);
         } catch (e) {
            console.error('[cron] GSC refresh failed for', dom.domain, e);
         }
      }
   } catch (e) {
      console.error('[cron] GSC refresh sweep failed', e);
   }

   // ── Weekly GSC drop digest (Mondays only) ──────────────────────────────
   // Snapshot the previous full week per page, then email each org's active members
   // a digest of pages that crossed a ranking threshold. Throttled to 1/7 days/org.
   if (new Date().getUTCDay() === 1) {
      try {
         await ensureGscSnapshotTables();
         const thisWeek = weekStartFor(new Date());     // previous full week's Monday
         const lastWeek = shiftWeek(thisWeek, -1);

         // 1) Capture snapshots for every domain (isolated per domain).
         const [domRows] = await db.query('SELECT d."ID" AS id, d.domain, d.workspace_id FROM domain d');
         const allDomains = domRows as Array<{ id: number; domain: string; workspace_id: number | null }>;
         for (const dom of allDomains) {
            try { await captureWeeklySnapshot(dom.domain, dom.id, thisWeek); }
            catch (e) { console.error('[cron] snapshot failed for', dom.domain, e); }
         }

         // 2) Per organization: compute drops across its domains, email if any (and not throttled).
         const [orgRows] = await db.query('SELECT id, name, last_gsc_digest_sent_at FROM organizations');
         for (const org of orgRows as Array<{ id: number; name: string; last_gsc_digest_sent_at: string | null }>) {
            try {
               const sentAt = org.last_gsc_digest_sent_at ? new Date(org.last_gsc_digest_sent_at).getTime() : 0;
               if (Date.now() - sentAt < 7 * 24 * 3600 * 1000) continue; // throttled

               const [oDomRows] = await db.query(
                  'SELECT d."ID" AS id, d.domain FROM domain d JOIN workspaces w ON d.workspace_id = w.id WHERE w.org_id = ?',
                  { replacements: [org.id] },
               );
               const digests: DomainDigest[] = [];
               for (const d of oDomRows as Array<{ id: number; domain: string }>) {
                  const now = await getSnapshot(d.id, thisWeek);
                  const prev = await getSnapshot(d.id, lastWeek);
                  if (prev.size === 0) continue; // baseline week for this domain — nothing to compare
                  const r = computeDrops(now, prev);
                  if (r.hasDrops) digests.push({ domain: d.domain, summary: r.summary, tiers: r.tiers });
               }
               if (digests.length === 0) continue;

               const [memRows] = await db.query(
                  "SELECT DISTINCT email FROM organization_members WHERE org_id = ? AND status = 'active' AND email IS NOT NULL AND email <> ''",
                  { replacements: [org.id] },
               );
               const emails = (memRows as Array<{ email: string }>).map((m) => m.email);
               if (emails.length === 0) continue;

               const html = buildGscDigest({ orgName: org.name, domains: digests });
               const attachments = loadDigestInlineAttachments();
               let anySent = false;
               for (const to of emails) {
                  try { const { sent } = await sendMail({ to, subject: `Weekly Ranksmile Performance - ${org.name}`, html, attachments }); anySent = anySent || sent; }
                  catch (e) { console.error('[cron] digest email failed for', to, e); }
               }
               if (anySent) {
                  await db.query('UPDATE organizations SET last_gsc_digest_sent_at = CURRENT_TIMESTAMP WHERE id = ?', { replacements: [org.id] });
               }
            } catch (e) { console.error('[cron] org digest failed for', org.id, e); }
         }
      } catch (e) { console.error('[cron] weekly GSC digest block failed', e); }
   }

   try {
      // Pobierz wszystkie domeny z topics w site_context
      const domains = await queryRows<{ ID: number; domain: string; topics: string | null }>(
         `SELECT d."ID", d.domain, sc.topics
          FROM domain d
          JOIN site_context sc ON sc.domain_id = d."ID"
          WHERE sc.topics IS NOT NULL AND sc.topics != '[]'`,
      );

      const triggered: string[] = [];

      for (const domain of domains) {
         let topics: string[] = [];
         try {
            topics = JSON.parse(domain.topics || '[]');
         } catch {
            continue;
         }
         if (!topics.length) continue;

         // Pobierz już użyte keywords
         const usedRows = await queryRows<ArticleRow>(
            `SELECT target_keyword FROM articles WHERE domain_id = ?`,
            [domain.ID],
         );
         const usedTopics = usedRows.map((r) => r.target_keyword);

         // Znajdź następny nieużyty topic
         const nextTopic = topics.find((t: string) => !usedTopics.includes(t)) || topics[0];

         // Trigger generowania przez wewnętrzny fetch
         const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
         try {
            await fetch(`${baseUrl}/api/articles/generate`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  // Przekaż secret żeby ominąć auth w trybie cron
                  'x-cron-secret': process.env.CRON_SECRET || '',
               },
               body: JSON.stringify({ domainId: domain.ID, keyword: nextTopic }),
            });
            triggered.push(`${domain.domain}: ${nextTopic}`);
         } catch (fetchErr) {
            console.error(`Failed to trigger for ${domain.domain}:`, fetchErr);
         }
      }

      return res.status(200).json({ triggered: triggered.length, details: triggered });
   } catch (error) {
      return res.status(500).json({ error: getErrorMessage(error) });
   }
}

export default withOrgPaymentAccess(handler);
