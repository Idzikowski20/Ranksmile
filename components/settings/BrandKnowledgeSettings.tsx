import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { getErrorMessage } from '../../lib/errors';
import { Button, Input, Textarea } from '../koala/core';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

const PLACEHOLDER = `Business Type
…

Industry
…

Products/Services description
…

Customer profile
…

Competitors
…

Topics to cover
…`;

const EXAMPLE_URLS_PLACEHOLDER = `https://twojafirma.pl/blog/przewodnik-dla-klienta
https://twojafirma.pl/jak-dziala-nasza-usluga
https://branżowy-wzorzec.pl/dobry-artykul`;

type BrandDnaSummary = {
  dna_version: number;
  brandPatternCount: number;
  brandSources: string[];
  updated_at: string;
  versions: Array<{ version: number; at: string; note: string }>;
};

type BrandDnaUrlResult = {
  url: string;
  ok: boolean;
  qualityScore: number;
  passedJudge: boolean;
  patternsAccepted: number;
  error?: string;
  reasons?: string[];
};

type CorpusEntry = {
  id: string;
  kind: 'gold' | 'bad';
  url?: string;
  title?: string;
  note?: string;
  industry?: string;
  added_at: string;
};

function parseExampleUrls(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const normalized = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    } catch {
      continue;
    }
    out.push(normalized);
  }
  return [...new Set(out)].slice(0, 10);
}

const BrandKnowledgeSettings = () => {
  const [brandName, setBrandName] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [exampleUrls, setExampleUrls] = useState('');
  const [dnaSummary, setDnaSummary] = useState<BrandDnaSummary | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [dnaLearning, setDnaLearning] = useState(false);
  const [dnaRollingBack, setDnaRollingBack] = useState(false);
  const [lastDnaResults, setLastDnaResults] = useState<BrandDnaUrlResult[] | null>(null);

  const [corpus, setCorpus] = useState<CorpusEntry[]>([]);
  const [corpusKind, setCorpusKind] = useState<'gold' | 'bad'>('gold');
  const [corpusUrl, setCorpusUrl] = useState('');
  const [corpusTitle, setCorpusTitle] = useState('');
  const [corpusNote, setCorpusNote] = useState('');
  const [corpusBusy, setCorpusBusy] = useState(false);

  const { data: contentSettings } = useContentSettings();
  const updateContentSettings = useUpdateContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setBrandName(contentSettings.brandName || '');
    setKnowledge(contentSettings.brandKnowledge || '');
  }, [contentSettings]);

  const refreshDna = useCallback(async () => {
    setDnaLoading(true);
    try {
      const r = await fetch('/api/wie/brand-dna');
      const d = await r.json() as BrandDnaSummary & {
        error?: string;
        versions?: Array<{ version: number; at: string; note: string }>;
      };
      if (!r.ok) throw new Error(d?.error || 'Failed to load Brand DNA');
      setDnaSummary({
        dna_version: d.dna_version,
        brandPatternCount: d.brandPatternCount,
        brandSources: Array.isArray(d.brandSources) ? d.brandSources : [],
        updated_at: d.updated_at,
        versions: Array.isArray(d.versions) ? d.versions : [],
      });
    } catch {
      setDnaSummary(null);
    } finally {
      setDnaLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDna();
  }, [refreshDna]);

  const refreshCorpus = useCallback(async () => {
    try {
      const r = await fetch('/api/wie/corpus');
      const d = await r.json() as { entries?: CorpusEntry[]; error?: string };
      if (!r.ok) throw new Error(d?.error || 'Failed to load corpus');
      setCorpus(Array.isArray(d.entries) ? d.entries : []);
    } catch {
      setCorpus([]);
    }
  }, []);

  useEffect(() => {
    void refreshCorpus();
  }, [refreshCorpus]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateContentSettings.mutateAsync({ brandName, brandKnowledge: knowledge });
      toast.success('Brand Knowledge saved');
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!url.trim()) return;
    const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    setAnalyzing(true);
    try {
      const r = await fetch('/api/brand-knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: normalized }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Analysis failed');
      if (d.brandName) setBrandName(d.brandName);
      setKnowledge(d.brandKnowledge || '');
      toast.success('Brand knowledge drafted — review & save');
    } catch (e) { toast.error(getErrorMessage(e) || 'Analysis failed'); } finally { setAnalyzing(false); }
  };

  const learnDna = async () => {
    const urls = parseExampleUrls(exampleUrls);
    if (urls.length === 0) {
      toast.error('Add 1–10 https URLs (one per line)');
      return;
    }
    setDnaLearning(true);
    setLastDnaResults(null);
    try {
      const r = await fetch('/api/wie/brand-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const d = await r.json() as {
        error?: string;
        dna_version?: number;
        patternsAdded?: number;
        acceptedUrls?: string[];
        processed?: BrandDnaUrlResult[];
      };
      if (!r.ok) throw new Error(d?.error || 'Brand DNA learning failed');
      setLastDnaResults(Array.isArray(d.processed) ? d.processed : []);
      await refreshDna();
      const accepted = d.acceptedUrls?.length ?? 0;
      const added = d.patternsAdded ?? 0;
      if (accepted === 0) {
        toast.error('No URLs passed the quality gate — try stronger examples');
      } else {
        toast.success(`Brand DNA updated · v${d.dna_version ?? '—'} · +${added} patterns from ${accepted} URL${accepted === 1 ? '' : 's'}`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Brand DNA learning failed');
    } finally {
      setDnaLearning(false);
    }
  };

  const rollbackDna = async (version: number) => {
    if (!window.confirm(`Restore Brand DNA to v${version}? Current state is snapshotted first.`)) return;
    setDnaRollingBack(true);
    try {
      const r = await fetch('/api/wie/brand-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', version }),
      });
      const d = await r.json() as { error?: string; restoredVersion?: number };
      if (!r.ok) throw new Error(d?.error || 'Rollback failed');
      await refreshDna();
      toast.success(`Restored DNA v${d.restoredVersion ?? version}`);
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Rollback failed');
    } finally {
      setDnaRollingBack(false);
    }
  };

  const addCorpus = async () => {
    const url = corpusUrl.trim();
    const title = corpusTitle.trim();
    if (!url && !title) {
      toast.error('URL or title required');
      return;
    }
    setCorpusBusy(true);
    try {
      const normalized = url
        ? (/^https?:\/\//i.test(url) ? url : `https://${url}`)
        : undefined;
      const r = await fetch('/api/wie/corpus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: corpusKind,
          url: normalized,
          title: title || undefined,
          note: corpusNote.trim() || undefined,
        }),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) throw new Error(d?.error || 'Failed to add');
      setCorpusUrl('');
      setCorpusTitle('');
      setCorpusNote('');
      await refreshCorpus();
      toast.success(corpusKind === 'gold' ? 'Added to GOLD corpus' : 'Added to BAD corpus');
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Failed to add');
    } finally {
      setCorpusBusy(false);
    }
  };

  const removeCorpus = async (id: string) => {
    setCorpusBusy(true);
    try {
      const r = await fetch(`/api/wie/corpus?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const d = await r.json() as { error?: string };
      if (!r.ok) throw new Error(d?.error || 'Failed to remove');
      await refreshCorpus();
      toast.success('Removed');
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Failed to remove');
    } finally {
      setCorpusBusy(false);
    }
  };

  const fieldBorder = (key: string) => (focused === key ? 'var(--koala-input-border-focus)' : 'var(--koala-border-primary)');
  const parsedCount = parseExampleUrls(exampleUrls).length;

  return (
    <form onSubmit={save} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <KoalaSettingsSection title="Source">
        <KoalaSettingsRow
          label="Generation mode"
          description={mode === 'auto'
            ? 'We scrape the page and let AI draft your brand knowledge — then review & edit below.'
            : 'Fill in the fields below manually.'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <div style={{ display: 'inline-flex', background: 'var(--koala-bg-secondary)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
              {([['auto', 'Auto from website'], ['manual', 'Write manually']] as const).map(([m, lbl]) => (
                <button
                  key={m} type="button" onClick={() => setMode(m)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', fontSize: 13, fontWeight: 600, background: mode === m ? 'var(--koala-bg-primary)' : 'transparent', color: mode === m ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)', boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'background 0.15s' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {mode === 'auto' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%', maxWidth: 480 }}>
                <div style={{ flex: 1 }}>
                  <Input
                    type="text"
                    inputMode="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://twojafirma.pl"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!analyzing) analyze(); } }}
                    onFocus={() => setFocused('url')}
                    onBlur={() => setFocused(null)}
                    style={{ width: '100%', borderColor: fieldBorder('url') }}
                  />
                </div>
                <Button type="button" disabled={analyzing || !url.trim()} onClick={analyze}>
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </Button>
              </div>
            )}
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Brand profile">
        <KoalaSettingsRow label="Brand name" description="The name used in generated content.">
          <Input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            placeholder="e.g. IDZTECH"
            style={{ width: '100%', maxWidth: 320, borderColor: fieldBorder('name') }}
          />
        </KoalaSettingsRow>
        <KoalaSettingsRow label="Knowledge" description="Used as context across the Content Editor and New Content generation.">
          <Textarea
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            onFocus={() => setFocused('knowledge')}
            onBlur={() => setFocused(null)}
            placeholder={PLACEHOLDER}
            rows={16}
            style={{ width: '100%', maxWidth: 560, borderColor: fieldBorder('knowledge') }}
          />
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Writing examples">
        <KoalaSettingsRow
          label="Brand DNA"
          description={dnaLoading
            ? 'Loading DNA status…'
            : dnaSummary
              ? `v${dnaSummary.dna_version} · ${dnaSummary.brandPatternCount} brand pattern${dnaSummary.brandPatternCount === 1 ? '' : 's'}${dnaSummary.brandSources.length ? ` · ${dnaSummary.brandSources.slice(0, 4).join(', ')}${dnaSummary.brandSources.length > 4 ? '…' : ''}` : ''}`
              : 'No Brand DNA yet — add example articles below.'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 560 }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-family-primary)', fontSize: 13, lineHeight: '20px', color: 'var(--koala-text-secondary)' }}>
              Paste 1–10 of your best articles (or industry exemplars). We learn writing patterns for AO and Writer — not competitor SERP pages.
            </p>
            <Textarea
              value={exampleUrls}
              onChange={(e) => setExampleUrls(e.target.value)}
              onFocus={() => setFocused('examples')}
              onBlur={() => setFocused(null)}
              placeholder={EXAMPLE_URLS_PLACEHOLDER}
              rows={5}
              style={{ width: '100%', borderColor: fieldBorder('examples') }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" variant="primary" disabled={dnaLearning || parsedCount === 0} onClick={() => { void learnDna(); }}>
                {dnaLearning ? 'Learning…' : `Learn from ${parsedCount || 0} URL${parsedCount === 1 ? '' : 's'}`}
              </Button>
              <span style={{ fontFamily: 'var(--font-family-primary)', fontSize: 12, color: 'var(--koala-text-tertiary)' }}>
                Max 10 · only pages that pass the quality gate update DNA
              </span>
            </div>
            {lastDnaResults && lastDnaResults.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lastDnaResults.map((row) => (
                  <li
                    key={row.url}
                    style={{
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 12,
                      lineHeight: '18px',
                      color: 'var(--koala-text-secondary)',
                      padding: '8px 10px',
                      background: 'var(--koala-bg-secondary)',
                      borderRadius: 8,
                      border: '1px solid var(--koala-border-primary)',
                    }}
                  >
                    <span style={{ color: 'var(--koala-text-primary)', fontWeight: 600 }}>
                      {!row.ok ? 'Failed' : row.passedJudge ? `Passed (${row.qualityScore})` : `Rejected (${row.qualityScore})`}
                    </span>
                    {' · '}
                    {row.patternsAccepted > 0 ? `+${row.patternsAccepted} patterns · ` : null}
                    <span style={{ wordBreak: 'break-all' }}>{row.url}</span>
                    {row.error ? ` — ${row.error}` : null}
                  </li>
                ))}
              </ul>
            )}
            {dnaSummary && dnaSummary.versions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-family-primary)', fontSize: 12, fontWeight: 600, color: 'var(--koala-text-primary)' }}>
                  Version history
                </span>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dnaSummary.versions.slice(0, 5).map((v) => (
                    <li
                      key={`${v.version}-${v.at}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        fontFamily: 'var(--font-family-primary)',
                        fontSize: 12,
                        lineHeight: '18px',
                        color: 'var(--koala-text-secondary)',
                        padding: '8px 10px',
                        background: 'var(--koala-bg-tertiary)',
                        borderRadius: 8,
                        border: '1px solid var(--koala-border-primary)',
                      }}
                    >
                      <span>
                        <span style={{ color: 'var(--koala-text-primary)', fontWeight: 600 }}>v{v.version}</span>
                        {' · '}
                        {v.note}
                      </span>
                      <Button
                        type="button"
                        disabled={dnaRollingBack || v.version === dnaSummary.dna_version}
                        onClick={() => { void rollbackDna(v.version); }}
                      >
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="GOLD / BAD corpus">
        <KoalaSettingsRow
          label="Learning exemplars"
          description="Curated good (GOLD) and anti-patterns (BAD) — not SERP dumps. Used as Learning references."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'inline-flex', background: 'var(--koala-bg-secondary)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
              {([['gold', 'GOLD'], ['bad', 'BAD']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCorpusKind(k)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    background: corpusKind === k ? 'var(--koala-bg-primary)' : 'transparent',
                    color: corpusKind === k ? 'var(--koala-text-primary)' : 'var(--koala-text-secondary)',
                    boxShadow: corpusKind === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <Input
              type="text"
              inputMode="url"
              value={corpusUrl}
              onChange={(e) => setCorpusUrl(e.target.value)}
              placeholder="https://example.com/article"
              onFocus={() => setFocused('corpusUrl')}
              onBlur={() => setFocused(null)}
              style={{ width: '100%', borderColor: fieldBorder('corpusUrl') }}
            />
            <Input
              type="text"
              value={corpusTitle}
              onChange={(e) => setCorpusTitle(e.target.value)}
              placeholder="Title (optional)"
              onFocus={() => setFocused('corpusTitle')}
              onBlur={() => setFocused(null)}
              style={{ width: '100%', borderColor: fieldBorder('corpusTitle') }}
            />
            <Input
              type="text"
              value={corpusNote}
              onChange={(e) => setCorpusNote(e.target.value)}
              placeholder="Why gold/bad? (optional)"
              onFocus={() => setFocused('corpusNote')}
              onBlur={() => setFocused(null)}
              style={{ width: '100%', borderColor: fieldBorder('corpusNote') }}
            />
            <Button type="button" disabled={corpusBusy || (!corpusUrl.trim() && !corpusTitle.trim())} onClick={() => { void addCorpus(); }}>
              {corpusBusy ? 'Saving…' : `Add to ${corpusKind.toUpperCase()}`}
            </Button>
            {corpus.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {corpus.slice(0, 20).map((e) => (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 12,
                      lineHeight: '18px',
                      color: 'var(--koala-text-secondary)',
                      padding: '8px 10px',
                      background: 'var(--koala-bg-secondary)',
                      borderRadius: 8,
                      border: '1px solid var(--koala-border-primary)',
                    }}
                  >
                    <span style={{ wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--koala-text-primary)', fontWeight: 600 }}>{e.kind.toUpperCase()}</span>
                      {' · '}
                      {e.title || e.url || e.id}
                      {e.note ? ` — ${e.note}` : ''}
                    </span>
                    <Button type="button" disabled={corpusBusy} onClick={() => { void removeCorpus(e.id); }}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};

export default BrandKnowledgeSettings;
