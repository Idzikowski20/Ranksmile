import { readFileSync, existsSync } from 'fs';
import path from 'path';
import type { DropEntry, DropResult } from './gscDrops';
import { escapeHtml } from './emails/layout';

export type DomainDigest = { domain: string; summary: DropResult['summary']; tiers: DropResult['tiers'] };

export type DigestInlineAttachment = {
  filename: string;
  /** Base64 content (no data: prefix). */
  content: string;
  contentId: string;
};

const F = 'Helvetica,Arial,sans-serif';

const INLINE = {
  logo: { contentId: 'ranksmile-logo', file: 'ranksmile-logo.png' },
  eye: { contentId: 'email-eye', file: 'eye.png' },
  cursor: { contentId: 'email-cursor', file: 'cursor-arrow-rays.png' },
} as const;

/** Load digest images from public/email for Resend CID attachments. */
export function loadDigestInlineAttachments(): DigestInlineAttachment[] {
  const dir = path.join(process.cwd(), 'public', 'email');
  const out: DigestInlineAttachment[] = [];
  for (const a of Object.values(INLINE)) {
    const fp = path.join(dir, a.file);
    if (!existsSync(fp)) {
      console.warn('[gscDigestEmail] missing inline asset', fp);
      continue;
    }
    out.push({
      filename: a.file,
      content: readFileSync(fp).toString('base64'),
      contentId: a.contentId,
    });
  }
  return out;
}

function absDelta(now: number, prev: number): { text: string; color: string } {
  const d = now - prev;
  if (d === 0) return { text: '0', color: '#6A6772' };
  if (d > 0) return { text: `+${d}`, color: '#338F61' };
  return { text: String(d), color: '#E53E3E' };
}

function positionDeltaLabel(r: DropEntry): { label: string; color: string } {
  if (r.nowPos === null) return { label: '0th', color: '#E53E3E' };
  if (r.prevPos === null) {
    const n = Math.round(r.nowPos);
    const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return { label: `${n}${suf}`, color: '#222A3A' };
  }
  const d = Math.round(r.prevPos) - Math.round(r.nowPos);
  if (d > 0) return { label: `+${d}`, color: '#338F61' };
  if (d < 0) return { label: String(d), color: '#E53E3E' };
  return { label: '0', color: '#6A6772' };
}

function weekRangeLabel(now = new Date()): string {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function listItems(rows: DropEntry[], limit: number): string {
  const shown = rows.slice(0, limit);
  const more = rows.length - shown.length;
  const items = shown.map((r) => {
    const d = positionDeltaLabel(r);
    return `<li style="margin-bottom:16px;">
      <span style="font-size:16px;font-weight:600;line-height:24px;font-family:${F};color:${d.color};">${escapeHtml(d.label)}</span>
      <span style="font-size:16px;font-weight:400;line-height:24px;font-family:${F};color:#2B6CB0;">${escapeHtml(r.page)}</span>
    </li>`;
  }).join('');
  const moreLine = more > 0
    ? `<li style="margin-bottom:16px;font-size:16px;font-weight:400;line-height:24px;font-family:${F};">...and ${more} more</li>`
    : '';
  return `<ul style="list-style:none;padding-left:0;">${items}${moreLine}</ul>`;
}

function domainCard(d: DomainDigest): string {
  const s = d.summary;
  const imp = absDelta(s.impressions, s.prevImpressions);
  const clk = absDelta(s.clicks, s.prevClicks);
  const hasDrops = d.tiers.droppedInTop10.length + d.tiers.droppedATier.length + d.tiers.outOfIndex.length > 0;
  const hasGrowth = d.tiers.growth.length > 0;

  return `
  <div style="padding:32px;width:100%;max-width:720px;box-sizing:border-box;background-color:#ffffff;margin:0 auto 24px;">
    <h1 style="font-size:24px;font-weight:600;line-height:32px;font-family:${F};margin:0 0 48px;color:#222A3A;">Weekly Ranksmile Performance for ${escapeHtml(d.domain)}</h1>
    <p style="font-size:20px;font-weight:400;line-height:28px;font-family:${F};margin:0 0 24px;color:#222A3A;">Performance report for ${escapeHtml(weekRangeLabel())}</p>

    <table style="width:100%;border:0;" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:48%;padding:16px;font-size:24px;font-weight:500;font-family:${F};line-height:32px;color:#222A3A;border-bottom:1px solid #E2E8F0;">
          <span>${s.impressions}</span>
          <span style="color:${imp.color};vertical-align:middle;font-size:16px;font-weight:400;line-height:24px;font-family:${F};margin-left:6px;">${escapeHtml(imp.text)}</span>
          <br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;">
            <img src="cid:${INLINE.eye.contentId}" alt="" width="24" height="24" style="width:24px;vertical-align:top;border:0;" />
            Total Impressions
          </span>
        </td>
        <td style="width:4%;border-bottom:1px solid #E2E8F0;">&nbsp;</td>
        <td style="width:48%;padding:16px;font-size:24px;font-weight:500;font-family:${F};line-height:32px;color:#222A3A;border-bottom:1px solid #E2E8F0;">
          <span>${s.clicks}</span>
          <span style="color:${clk.color};vertical-align:middle;font-size:16px;font-weight:400;line-height:24px;font-family:${F};margin-left:6px;">${escapeHtml(clk.text)}</span>
          <br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;">
            <img src="cid:${INLINE.cursor.contentId}" alt="" width="24" height="24" style="width:24px;vertical-align:top;border:0;" />
            Total Clicks
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;font-size:24px;font-weight:500;font-family:${F};line-height:32px;color:#222A3A;">
          ${s.pagesFell} posts<br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;">Dropped in ranking</span>
        </td>
        <td>&nbsp;</td>
        <td style="padding:16px;font-size:24px;font-weight:500;font-family:${F};line-height:32px;color:#222A3A;">
          ${s.pagesGrew} posts<br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;">Rank higher</span>
        </td>
      </tr>
    </table>

    ${hasDrops ? `<h2 style="font-size:20px;font-weight:600;line-height:28px;font-family:${F};margin-top:48px;color:#222A3A;">Dropped in ranking</h2>` : ''}
    ${d.tiers.droppedInTop10.length ? `<h3 style="font-size:16px;font-weight:600;line-height:24px;font-family:${F};margin-top:24px;color:#222A3A;">Drops from top 10 SERP results</h3>${listItems(d.tiers.droppedInTop10, 10)}` : ''}
    ${d.tiers.droppedATier.length ? `<h3 style="font-size:16px;font-weight:600;line-height:24px;font-family:${F};margin-top:24px;color:#222A3A;">Other drops in SERPs</h3>${listItems(d.tiers.droppedATier, 5)}` : ''}
    ${d.tiers.outOfIndex.length ? `<h3 style="font-size:16px;font-weight:600;line-height:24px;font-family:${F};margin-top:24px;color:#222A3A;">Deindexed pages</h3>${listItems(d.tiers.outOfIndex, 5)}` : ''}

    ${hasGrowth ? `<h2 style="font-size:20px;font-weight:600;line-height:28px;font-family:${F};margin-top:48px;color:#222A3A;">Increased in ranking</h2>` : ''}
    ${d.tiers.growth.length ? `<h3 style="font-size:16px;font-weight:600;line-height:24px;font-family:${F};margin-top:24px;color:#222A3A;">Organic growth</h3>${listItems(d.tiers.growth, 5)}` : ''}
  </div>`;
}

/**
 * Weekly GSC digest — self-contained email (no deep-link CTA). Images via CID.
 */
export function buildGscDigest({
  orgName: _orgName,
  domains,
}: {
  orgName?: string;
  domains: DomainDigest[];
  /** @deprecated unused — report is email-only */
  appUrl?: string;
}): string {
  const cards = domains.map((d) => domainCard(d)).join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background-color:#F8FAFB;">
<div style="background-color:#F8FAFB;padding:40px;font-family:${F};">
  <img src="cid:${INLINE.logo.contentId}" alt="Ranksmile" width="160" style="display:block;width:160px;height:auto;margin:0 auto 40px;border:0;" />
  ${cards}
  <p style="width:100%;max-width:720px;text-transform:uppercase;margin:40px auto 0;text-align:center;font-family:${F};font-size:11px;font-weight:400;line-height:14px;color:#6A6772;">
    © ${new Date().getUTCFullYear()} Ranksmile. All rights reserved
  </p>
  <p style="font-size:12px;color:#9F9FA9;text-align:center;margin-top:12px;font-family:${F};">Position = average Google rank (lower is better).</p>
</div>
</body></html>`;
}
