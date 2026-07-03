import React, { useEffect, useRef, useState } from 'react';

const FONT = 'var(--font-family-primary)';

const Chevron = () => (
   <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
);
const DownloadIcon = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const csvCell = (v: unknown): string => {
   const s = String(v ?? '');
   return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers: string[], rows: Array<Array<unknown>>): string => [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
const download = (name: string, csv: string): void => {
   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = name;
   a.click();
   URL.revokeObjectURL(url);
};

type ExportData = {
   sources?: Array<{ url: string; domain: string; timesShown: number; models?: string[] }>;
   competitors?: Array<{ domain: string; mentions: number; share: number }>;
   prompts?: Array<{ topic: string; text: string; score: number }>;
};

const OPTIONS: Array<{ view: 'sources' | 'prompts' | 'competitors'; label: string }> = [
   { view: 'sources', label: 'Sources CSV' },
   { view: 'prompts', label: 'Prompts CSV' },
   { view: 'competitors', label: 'Competitors CSV' },
];

/** Export ⌄ button in the AI Visibility title row → downloads Sources / Prompts /
 *  Competitors as CSV, built client-side from the same data endpoints the page uses. */
const AiVisExportMenu = ({ slug }: { slug: string | undefined }) => {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!open) return undefined;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
   }, [open]);

   const exportView = async (view: 'sources' | 'prompts' | 'competitors') => {
      setOpen(false);
      if (!slug) return;
      try {
         const r = await fetch(`/api/ai-visibility/${slug}/data?view=${view}`);
         const data = (await r.json()) as ExportData;
         if (view === 'sources') {
            download('ai-visibility-sources.csv', toCsv(['domain', 'url', 'timesShown', 'models'], (data.sources || []).map((s) => [s.domain, s.url, s.timesShown, (s.models || []).join(' | ')])));
         } else if (view === 'competitors') {
            download('ai-visibility-competitors.csv', toCsv(['domain', 'mentions', 'sharePct'], (data.competitors || []).map((c) => [c.domain, c.mentions, c.share])));
         } else {
            download('ai-visibility-prompts.csv', toCsv(['topic', 'prompt', 'score'], (data.prompts || []).map((p) => [p.topic, p.text, p.score])));
         }
      } catch { /* network/parse failure — silently ignore, nothing to download */ }
   };

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #E4E4E7', borderRadius: 8, padding: '6px 12px', background: '#fff', color: '#52525C', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}
         >
            Export <span style={{ display: 'inline-flex', color: '#9F9FA9' }}><Chevron /></span>
         </button>
         {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 200, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 150, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               {OPTIONS.map((o) => (
                  <button
                     key={o.view}
                     type="button"
                     onClick={() => exportView(o.view)}
                     style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', borderRadius: 8, padding: '8px 10px', background: 'transparent', color: '#18181B', fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                     <span style={{ display: 'inline-flex', color: '#52525C' }}><DownloadIcon /></span>
                     {o.label}
                  </button>
               ))}
            </div>
         )}
      </div>
   );
};

export default AiVisExportMenu;
