import type { DropResult } from './gscDrops';

export type DomainDigest = { domain: string; summary: DropResult['summary']; tiers: DropResult['tiers'] };

const pct = (now: number, prev: number): string => {
   if (!prev) return now > 0 ? '+100%' : '0%';
   const v = Math.round(((now - prev) / prev) * 100);
   return `${v > 0 ? '+' : ''}${v}%`;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function tierBlock(title: string, color: string, rows: DropResult['tiers']['droppedInTop10']): string {
   if (rows.length === 0) return '';
   const items = rows.map((r) => {
      const move = r.nowPos === null ? '→ out' : `${r.prevPos === null ? '—' : Math.round(r.prevPos)} → ${Math.round(r.nowPos)}`;
      return `<tr><td style="padding:4px 0;font-size:14px;color:#18181B;">${esc(r.page)}</td><td style="padding:4px 0;font-size:13px;color:#52525C;text-align:right;white-space:nowrap;">${move}</td></tr>`;
   }).join('');
   return `<div style="margin-top:12px;"><div style="font-size:13px;font-weight:600;color:${color};margin-bottom:4px;">${title}</div><table style="width:100%;border-collapse:collapse;">${items}</table></div>`;
}

/** Pure HTML for the weekly digest. Inline styles only (email clients), design.md tokens. */
export function buildGscDigest({ orgName, domains }: { orgName: string; domains: DomainDigest[] }): string {
   const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
   const cards = domains.map((d) => {
      const s = d.summary;
      return `
      <div style="border:1px solid #E4E4E7;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:600;color:#18181B;">${esc(d.domain)}</div>
        <div style="font-size:13px;color:#52525C;margin-top:4px;">Clicks ${pct(s.clicks, s.prevClicks)} · Impressions ${pct(s.impressions, s.prevImpressions)} WoW · ${s.pagesFell} down / ${s.pagesGrew} up</div>
        ${tierBlock('Dropped in top 10', '#FF6F77', d.tiers.droppedInTop10)}
        ${tierBlock('Dropped a tier', '#FF6F77', d.tiers.droppedATier)}
        ${tierBlock('Out of index', '#B91C1C', d.tiers.outOfIndex)}
        ${tierBlock('Growth', '#1AB25E', d.tiers.growth)}
      </div>`;
   }).join('');
   return `<!doctype html><html><body style="margin:0;background:#f8f9ff;padding:24px;font-family:${F};">
     <div style="max-width:640px;margin:0 auto;">
       <div style="font-size:20px;font-weight:600;color:#18181B;margin-bottom:4px;">Weekly search report</div>
       <div style="font-size:14px;color:#52525C;margin-bottom:20px;">${esc(orgName)} — pages that changed position last week</div>
       ${cards}
       <div style="font-size:12px;color:#9F9FA9;margin-top:8px;">Position = average Google rank (lower is better).</div>
     </div>
   </body></html>`;
}
