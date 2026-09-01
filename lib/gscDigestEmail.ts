import type { DropEntry, DropResult } from './gscDrops';
import {
  EMAIL_BG_CONTENT,
  EMAIL_BG_PAGE,
  EMAIL_BODY,
  EMAIL_BORDER,
  EMAIL_FONT,
  EMAIL_INK,
  EMAIL_LINK,
  EMAIL_MUTED,
  EMAIL_RADIUS_CARD,
  emailAssetUrl,
  escapeHtml,
} from './emails/layout';

export type DomainDigest = { domain: string; summary: DropResult['summary']; tiers: DropResult['tiers'] };

const EMAIL_SUCCESS = '#22c55e';
const EMAIL_DANGER = '#ef4444';

const ASSETS = {
  logo: 'ranksmile-logo.png',
  eye: 'eye.png',
  cursor: 'cursor-arrow-rays.png',
} as const;

const EMAIL_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap';

function absDelta(now: number, prev: number): { text: string; color: string } {
  const d = now - prev;
  if (d === 0) return { text: '0', color: EMAIL_MUTED };
  if (d > 0) return { text: `+${d}`, color: EMAIL_SUCCESS };
  return { text: String(d), color: EMAIL_DANGER };
}

function positionDeltaLabel(r: DropEntry): { label: string; color: string } {
  if (r.nowPos === null) return { label: '0th', color: EMAIL_DANGER };
  if (r.prevPos === null) {
    const n = Math.round(r.nowPos);
    const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return { label: `${n}${suf}`, color: EMAIL_INK };
  }
  const d = Math.round(r.prevPos) - Math.round(r.nowPos);
  if (d > 0) return { label: `+${d}`, color: EMAIL_SUCCESS };
  if (d < 0) return { label: String(d), color: EMAIL_DANGER };
  return { label: '0', color: EMAIL_MUTED };
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
      <span style="font-size:16px;font-weight:700;line-height:24px;font-family:${EMAIL_FONT};color:${d.color};">${escapeHtml(d.label)}</span>
      <span style="font-size:16px;font-weight:400;line-height:24px;font-family:${EMAIL_FONT};color:${EMAIL_LINK};">${escapeHtml(r.page)}</span>
    </li>`;
  }).join('');
  const moreLine = more > 0
    ? `<li style="margin-bottom:16px;font-size:16px;font-weight:400;line-height:24px;font-family:${EMAIL_FONT};color:${EMAIL_MUTED};">...and ${more} more</li>`
    : '';
  return `<ul style="list-style:none;padding-left:0;">${items}${moreLine}</ul>`;
}

function domainCard(d: DomainDigest): string {
  const s = d.summary;
  const imp = absDelta(s.impressions, s.prevImpressions);
  const clk = absDelta(s.clicks, s.prevClicks);
  const hasDrops = d.tiers.droppedInTop10.length + d.tiers.droppedATier.length + d.tiers.outOfIndex.length > 0;
  const hasGrowth = d.tiers.growth.length > 0;
  const eyeSrc = escapeHtml(emailAssetUrl(ASSETS.eye));
  const cursorSrc = escapeHtml(emailAssetUrl(ASSETS.cursor));

  return `
  <div style="padding:32px;width:100%;max-width:720px;box-sizing:border-box;background-color:${EMAIL_BG_CONTENT};border:1px solid ${EMAIL_BORDER};border-radius:${EMAIL_RADIUS_CARD};margin:0 auto 24px;">
    <h1 style="font-size:24px;font-weight:700;line-height:32px;font-family:${EMAIL_FONT};margin:0 0 48px;color:${EMAIL_INK};">Weekly Ranksmile Performance for ${escapeHtml(d.domain)}</h1>
    <p style="font-size:18px;font-weight:400;line-height:28px;font-family:${EMAIL_FONT};margin:0 0 24px;color:${EMAIL_BODY};">Performance report for ${escapeHtml(weekRangeLabel())}</p>

    <table style="width:100%;border:0;" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:48%;padding:16px;font-size:24px;font-weight:500;font-family:${EMAIL_FONT};line-height:32px;color:${EMAIL_INK};border-bottom:1px solid ${EMAIL_BORDER};">
          <span>${s.impressions}</span>
          <span style="color:${imp.color};vertical-align:middle;font-size:16px;font-weight:400;line-height:24px;font-family:${EMAIL_FONT};margin-left:6px;">${escapeHtml(imp.text)}</span>
          <br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;color:${EMAIL_BODY};">
            <img src="${eyeSrc}" alt="" width="24" height="24" style="width:24px;height:24px;vertical-align:top;border:0;" />
            Total Impressions
          </span>
        </td>
        <td style="width:4%;border-bottom:1px solid ${EMAIL_BORDER};">&nbsp;</td>
        <td style="width:48%;padding:16px;font-size:24px;font-weight:500;font-family:${EMAIL_FONT};line-height:32px;color:${EMAIL_INK};border-bottom:1px solid ${EMAIL_BORDER};">
          <span>${s.clicks}</span>
          <span style="color:${clk.color};vertical-align:middle;font-size:16px;font-weight:400;line-height:24px;font-family:${EMAIL_FONT};margin-left:6px;">${escapeHtml(clk.text)}</span>
          <br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;color:${EMAIL_BODY};">
            <img src="${cursorSrc}" alt="" width="24" height="24" style="width:24px;height:24px;vertical-align:top;border:0;" />
            Total Clicks
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;font-size:24px;font-weight:500;font-family:${EMAIL_FONT};line-height:32px;color:${EMAIL_INK};">
          ${s.pagesFell} posts<br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;color:${EMAIL_BODY};">Dropped in ranking</span>
        </td>
        <td>&nbsp;</td>
        <td style="padding:16px;font-size:24px;font-weight:500;font-family:${EMAIL_FONT};line-height:32px;color:${EMAIL_INK};">
          ${s.pagesGrew} posts<br/>
          <span style="font-size:16px;font-weight:400;line-height:24px;margin-top:8px;display:block;color:${EMAIL_BODY};">Rank higher</span>
        </td>
      </tr>
    </table>

    ${hasDrops ? `<h2 style="font-size:20px;font-weight:700;line-height:28px;font-family:${EMAIL_FONT};margin-top:48px;color:${EMAIL_INK};">Dropped in ranking</h2>` : ''}
    ${d.tiers.droppedInTop10.length ? `<h3 style="font-size:16px;font-weight:700;line-height:24px;font-family:${EMAIL_FONT};margin-top:24px;color:${EMAIL_INK};">Drops from top 10 SERP results</h3>${listItems(d.tiers.droppedInTop10, 10)}` : ''}
    ${d.tiers.droppedATier.length ? `<h3 style="font-size:16px;font-weight:700;line-height:24px;font-family:${EMAIL_FONT};margin-top:24px;color:${EMAIL_INK};">Other drops in SERPs</h3>${listItems(d.tiers.droppedATier, 5)}` : ''}
    ${d.tiers.outOfIndex.length ? `<h3 style="font-size:16px;font-weight:700;line-height:24px;font-family:${EMAIL_FONT};margin-top:24px;color:${EMAIL_INK};">Deindexed pages</h3>${listItems(d.tiers.outOfIndex, 5)}` : ''}

    ${hasGrowth ? `<h2 style="font-size:20px;font-weight:700;line-height:28px;font-family:${EMAIL_FONT};margin-top:48px;color:${EMAIL_INK};">Increased in ranking</h2>` : ''}
    ${d.tiers.growth.length ? `<h3 style="font-size:16px;font-weight:700;line-height:24px;font-family:${EMAIL_FONT};margin-top:24px;color:${EMAIL_INK};">Organic growth</h3>${listItems(d.tiers.growth, 5)}` : ''}
  </div>`;
}

/**
 * Weekly GSC digest — self-contained email (no deep-link CTA).
 * Images use public HTTPS URLs (same as other transactional mail).
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
  const logoSrc = escapeHtml(emailAssetUrl(ASSETS.logo));

  return `<!doctype html><html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${EMAIL_FONT_HREF}" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_BG_PAGE};">
<div style="background-color:${EMAIL_BG_PAGE};padding:40px;font-family:${EMAIL_FONT};">
  <img src="${logoSrc}" alt="Ranksmile" width="160" style="display:block;width:160px;height:auto;margin:0 auto 40px;border:0;" />
  ${cards}
  <p style="width:100%;max-width:720px;text-transform:uppercase;margin:40px auto 0;text-align:center;font-family:${EMAIL_FONT};font-size:11px;font-weight:400;line-height:14px;color:${EMAIL_MUTED};">
    © ${new Date().getUTCFullYear()} Ranksmile. All rights reserved
  </p>
  <p style="font-size:12px;color:${EMAIL_MUTED};text-align:center;margin-top:12px;font-family:${EMAIL_FONT};">Position = average Google rank (lower is better).</p>
</div>
</body></html>`;
}
