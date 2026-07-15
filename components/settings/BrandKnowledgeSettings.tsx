import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { getErrorMessage } from '../../lib/errors';
import { Button, Input, Textarea } from '../core';
import { SentrySettingsSection, SentrySettingsRow } from '../sentry-pages';

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

const BrandKnowledgeSettings = () => {
  const [brandName, setBrandName] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const { data: contentSettings } = useContentSettings();
  const updateContentSettings = useUpdateContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setBrandName(contentSettings.brandName || '');
    setKnowledge(contentSettings.brandKnowledge || '');
  }, [contentSettings]);

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

  const fieldBorder = (key: string) => (focused === key ? '#F5C4A0' : '#D4D4D8');

  return (
    <form onSubmit={save} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <SentrySettingsSection title="Source">
        <SentrySettingsRow
          label="Generation mode"
          description={mode === 'auto'
            ? 'We scrape the page and let AI draft your brand knowledge — then review & edit below.'
            : 'Fill in the fields below manually.'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <div style={{ display: 'inline-flex', background: '#F4F4F5', borderRadius: 8, padding: 3, width: 'fit-content' }}>
              {([['auto', 'Auto from website'], ['manual', 'Write manually']] as const).map(([m, lbl]) => (
                <button
                  key={m} type="button" onClick={() => setMode(m)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-family-primary)', fontSize: 13, fontWeight: 600, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#18181B' : '#52525C', boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'background 0.15s' }}
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
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Brand profile">
        <SentrySettingsRow label="Brand name" description="The name used in generated content.">
          <Input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            placeholder="e.g. IDZTECH"
            style={{ width: '100%', maxWidth: 320, borderColor: fieldBorder('name') }}
          />
        </SentrySettingsRow>
        <SentrySettingsRow label="Knowledge" description="Used as context across the Content Editor and New Content generation.">
          <Textarea
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            onFocus={() => setFocused('knowledge')}
            onBlur={() => setFocused(null)}
            placeholder={PLACEHOLDER}
            rows={16}
            style={{ width: '100%', maxWidth: 560, borderColor: fieldBorder('knowledge') }}
          />
        </SentrySettingsRow>
      </SentrySettingsSection>

      <div>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};

export default BrandKnowledgeSettings;
