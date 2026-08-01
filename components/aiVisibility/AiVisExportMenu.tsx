import React, { useState } from 'react';
import { CompactSelect } from '../koala/core';

const OPTIONS = [
  { value: 'sources', label: 'Sources CSV' },
  { value: 'prompts', label: 'Prompts CSV' },
  { value: 'competitors', label: 'Competitors CSV' },
] as const;

const csvCell = (v: unknown): string => {
  const raw = String(v ?? '');
  const s = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers: string[], rows: Array<Array<unknown>>): string => (
  [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
);

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

/** Export menu in page header — CompactSelect action menu pattern. */
const AiVisExportMenu = ({ slug }: { slug: string | undefined }) => {
  const [busy, setBusy] = useState(false);

  const exportView = async (view: 'sources' | 'prompts' | 'competitors') => {
    if (!slug) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <CompactSelect
      disabled={busy || !slug}
      size="sm"
      triggerLabel="Export"
      options={OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      onChange={(opt) => exportView(opt.value as 'sources' | 'prompts' | 'competitors')}
    />
  );
};

export default AiVisExportMenu;
