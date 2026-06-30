import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { getErrorMessage } from '../../lib/errors';

const font = 'var(--font-family-primary)';

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

  const fieldBorder = (key: string) => (focused === key ? '#AA93FD' : '#E4E4E7');

  return (
    <form onSubmit={save} noValidate style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: '100%', fontFamily: font }}>
      {/* Mode: auto from website vs manual */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <div style={{ display: 'inline-flex', background: '#F4F4F5', borderRadius: 8, padding: 3, width: 'fit-content' }}>
          {([['auto', 'Auto from website'], ['manual', 'Write manually']] as const).map(([m, lbl]) => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 13, fontWeight: 600, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#18181B' : '#52525C', boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'background 0.15s' }}
            >
              {lbl}
            </button>
          ))}
        </div>
        {mode === 'auto' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Website URL</label>
              <input
                type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://twojafirma.pl"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!analyzing) analyze(); } }}
                onFocus={() => setFocused('url')} onBlur={() => setFocused(null)}
                style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', fontFamily: font, fontSize: 14, color: '#18181B', borderRadius: 8, border: `1px solid ${fieldBorder('url')}`, boxShadow: focused === 'url' ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none', outline: 'none' }}
              />
            </div>
            <button
              type="button" disabled={analyzing || !url.trim()} onClick={analyze}
              style={{ height: 40, padding: '0 18px', borderRadius: 8, border: 'none', cursor: analyzing || !url.trim() ? 'not-allowed' : 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#fff', background: '#18181B', opacity: analyzing || !url.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        )}
        <span style={{ fontSize: 13, color: '#52525C' }}>
          {mode === 'auto'
            ? 'We scrape the page and let AI draft your brand knowledge — then review & edit below.'
            : 'Fill in the fields below manually.'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', paddingBottom: 6 }}>Brand name</label>
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          onFocus={() => setFocused('name')}
          onBlur={() => setFocused(null)}
          placeholder="e.g. IDZTECH"
          style={{ width: 256, maxWidth: '100%', boxSizing: 'border-box', height: 36, padding: '0 12px', fontFamily: font, fontSize: 13, color: '#18181B', borderRadius: 8, border: `1px solid ${fieldBorder('name')}`, boxShadow: focused === 'name' ? '0 0 0 3px rgba(120,58,251,0.1)' : '0px 1px 2px 0px rgba(26,29,40,0.06)', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Knowledge</label>
        <textarea
          value={knowledge}
          onChange={(e) => setKnowledge(e.target.value)}
          onFocus={() => setFocused('knowledge')}
          onBlur={() => setFocused(null)}
          placeholder={PLACEHOLDER}
          rows={16}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontFamily: font, fontSize: 15, lineHeight: 1.7, color: '#18181B', borderRadius: 8, border: `1px solid ${fieldBorder('knowledge')}`, boxShadow: focused === 'knowledge' ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none', outline: 'none', resize: 'vertical' }}
        />
        <span style={{ fontSize: 13, color: '#52525C' }}>
          Used as context across the Content Editor and New Content generation.
        </span>
      </div>

      <button
        type="submit"
        disabled={saving}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 4, width: 'fit-content', padding: '8px 24px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: font, fontSize: 16, fontWeight: 600, color: '#fff', background: hover ? '#783AFB' : '#18181B', opacity: saving ? 0.6 : 1, transition: 'background 150ms ease' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
};

export default BrandKnowledgeSettings;
