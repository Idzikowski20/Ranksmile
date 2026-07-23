import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell, { WizardNextButton, WizardBackButton } from '../../components/articles/WizardShell';
import { Button, CompactSelect, SegmentedControl, Switch, Textarea } from '../../components/core';
import type { SelectOption } from '../../components/core';
import { saveWizardState } from '../../lib/wizardState';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { useArticle } from '../../services/article';
import DomainFavicon from '../../components/common/DomainFavicon';
import { parseRankingSources, buildAiRankingSources } from '../../lib/rankingSources';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

interface Voice { id: string; name: string; description: string; isDefault: boolean; }

const label: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' };

/** Right slide-in detail panel (Ranking content / Brand Knowledge). */
const SidePanel = ({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 150, background: open ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)', pointerEvents: open ? 'auto' : 'none', transition: 'background 0.2s' }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: 8, bottom: 8, right: 8, width: 512, maxWidth: 'calc(100% - 16px)',
        background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(110%)', transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 16px' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{title}</h2>
        <Button type="button" variant="transparent" size="xs" onClick={onClose} aria-label="Close" style={{ color: '#52525C', minWidth: 28, padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Button>
      </div>
      <div style={{ padding: '0 28px 28px', overflowY: 'auto' }} className="styled-scrollbar">{children}</div>
    </div>
  </div>
);

const ContextPage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const type = typeof router.query.type === 'string' ? router.query.type : 'blog';

  const [brandOn, setBrandOn] = useState(true);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState('serp');
  const [instructions, setInstructions] = useState('');
  const [showNew, setShowNew] = useState(true);
  const [panel, setPanel] = useState<'ranking' | 'brand' | null>(null);
  const [brandText, setBrandText] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [rankGoogle, setRankGoogle] = useState<Array<{ rank: number; domain: string; url: string; title: string }>>([]);
  const [rankAi, setRankAi] = useState<Array<{ domain: string; url: string; title: string }>>([]);
  const [rankTab, setRankTab] = useState<'google' | 'ai'>('google');
  const [hydrated, setHydrated] = useState(false);

  // Shared content settings (Brand Knowledge + Custom Voices) — cached/deduped.
  const { data: contentSettings } = useContentSettings();
  const updateContentSettings = useUpdateContentSettings();
  const settingsSeeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || settingsSeeded.current) return;
    settingsSeeded.current = true;
    setVoices(contentSettings.voices as Voice[]);
    setBrandText(contentSettings.brandKnowledge || '');
    const def = contentSettings.voices.find((v) => v.isDefault);
    if (def) setVoiceId(def.id);
  }, [contentSettings]);

  // Load ranking content gathered during deep analysis + prefill saved wizard
  // state (shared/cached article fetch).
  const { data: article, isFetched: articleFetched } = useArticle(articleId);
  useEffect(() => {
    if (!articleId) { setHydrated(true); return; }
    if (!articleFetched) return;
    const art = article;
    const parsed = parseRankingSources(art?.ranking_sources);
    let google = parsed.google;
    let ai = parsed.ai;
    if (!ai.length && art?.ai_visibility_summary) {
      ai = buildAiRankingSources(art.ai_visibility_summary as AiVisibilitySummary);
    }
    setRankGoogle(google);
    setRankAi(ai);
    if (art?.wizard_state) {
      try {
        const ws = JSON.parse(art.wizard_state);
        if (typeof ws.brandOn === 'boolean') setBrandOn(ws.brandOn);
        if (typeof ws.instructions === 'string') setInstructions(ws.instructions);
        if (ws.voiceId) setVoiceId(ws.voiceId);
      } catch { /* ignore */ }
    }
    setHydrated(true);
  }, [articleId, articleFetched, article]);

  // Persist progress so the draft can be resumed if the user leaves.
  useEffect(() => {
    if (!hydrated || !articleId) return undefined;
    const t = setTimeout(() => saveWizardState(articleId, { step: 'context', voiceId, instructions, brandOn }), 400);
    return () => clearTimeout(t);
  }, [hydrated, articleId, voiceId, instructions, brandOn]);

  const voiceOptions: SelectOption[] = [
    { value: 'serp', label: 'SERP based' },
    ...voices.map((v) => ({ value: v.id, label: v.name })),
    { value: '__add__', label: '+ Add Custom Voice' },
  ];

  const onVoiceChange = (opt: SelectOption) => {
    if (opt.value === '__add__') {
      void router.push('/settings/custom_voices');
      return;
    }
    setVoiceId(String(opt.value));
  };

  const saveBrand = async () => {
    setSavingBrand(true);
    try {
      await updateContentSettings.mutateAsync({ brandKnowledge: brandText });
      setPanel(null); toast.success('Brand Knowledge saved');
    } catch { toast.error('Failed to save'); } finally { setSavingBrand(false); }
  };

  const goNext = () => {
    const q = new URLSearchParams();
    if (articleId) q.set('articleId', articleId);
    q.set('type', type);
    router.push(`/articles/writing-mode?${q.toString()}`);
  };
  const goBack = () => {
    const q = new URLSearchParams();
    if (articleId) q.set('articleId', articleId);
    q.set('type', type);
    router.push(`/articles/content-type?${q.toString()}`);
  };

  const rankSkeleton = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {[68, 82, 74, 90, 78].map((w, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: '#EFEFF1', animation: 'rkPulse 1.4s ease-in-out infinite' }} />
            <span style={{ width: 88, height: 10, borderRadius: 4, background: '#EFEFF1', animation: 'rkPulse 1.4s ease-in-out infinite' }} />
            <span style={{ width: 24, height: 10, borderRadius: 4, background: '#EFEFF1', animation: 'rkPulse 1.4s ease-in-out infinite' }} />
          </div>
          <span style={{ width: `${w}%`, height: 14, borderRadius: 5, background: '#EFEFF1', animation: 'rkPulse 1.4s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  );

  const includedCard = (opts: { onClick: () => void; left: React.ReactNode; title: string; desc: string; }) => (
    <button
      type="button"
      onClick={opts.onClick}
      style={{ background: '#F8F8F9', display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-family-primary)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {opts.left}
          <span style={{ fontSize: 14, fontWeight: 500, color: '#18181B' }}>{opts.title}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: '16px', color: '#52525C' }}>{opts.desc}</p>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );

  return (
    <WizardShell
      title="Add context & instructions"
      footer={<>
        <WizardBackButton onClick={goBack} />
        <WizardNextButton label="Writing mode" onClick={goNext} />
      </>}
    >
      <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 600, color: '#000', fontFamily: 'var(--font-family-primary)' }}>
        Add context &amp; instructions
      </h2>

      {/* Already included */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Already included:</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {includedCard({
            onClick: () => setPanel('ranking'),
            left: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#09090B' }}><path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.39 4.36-9.75 9.75-9.75s9.75 4.36 9.75 9.75-4.36 9.75-9.75 9.75S2.25 17.39 2.25 12Zm13.36-1.81a.75.75 0 1 0-1.22-.87l-3.24 4.53-1.62-1.63a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.09l3.75-5.25Z" fill="currentColor" /></svg>,
            title: 'Ranking content',
            desc: rankGoogle.length ? `${rankGoogle.length} sources from Google Search results and AI Search` : 'Google Search results and AI Search',
          })}
          {includedCard({
            onClick: () => setPanel('brand'),
            left: (
              <span
                onClick={(e) => { e.stopPropagation(); }}
                style={{ display: 'inline-flex', flexShrink: 0 }}
              >
                <Switch
                  checked={brandOn}
                  onChange={setBrandOn}
                  aria-label="Toggle Brand Knowledge"
                />
              </span>
            ),
            title: 'Brand Knowledge',
            desc: 'Audience, products, competing brands',
          })}
        </div>
      </div>

      {/* Voice */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>Voice</label>
        <div style={{ width: '100%', display: 'grid' }}>
          <CompactSelect
            size="md"
            value={voiceId}
            options={voiceOptions}
            onChange={onVoiceChange}
            menuWidth="100%"
            menuMinWidth="100%"
            triggerLabel={
              voiceOptions.find((o) => o.value === voiceId && o.value !== '__add__')?.label
              || 'SERP based'
            }
          />
        </div>
      </div>

      {/* Instructions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={label}>Add context &amp; instructions <span style={{ color: '#9F9FA9', fontWeight: 400 }}>(optional)</span></span>
        {showNew && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#18181B', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>New</span>
              <span style={{ fontSize: 13, color: '#18181B' }}>Add up to 5 urls with some context on how to use them</span>
            </div>
            <Button type="button" variant="transparent" size="xs" onClick={() => setShowNew(false)} aria-label="Dismiss" style={{ color: '#52525C', minWidth: 24, padding: 2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Button>
          </div>
        )}
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={'Write specific instructions for this content (e.g., "Mention product X," "Write from the perspective of Y," "Conclude by saying Z")'}
          rows={5}
          resize="vertical"
        />
      </div>

      <SidePanel open={panel === 'ranking'} title="Ranking content" onClose={() => setPanel(null)}>
        <style>{'@keyframes rkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }'}</style>
        <div style={{ marginBottom: 18 }}>
          <SegmentedControl
            name="ranking-tab"
            size="sm"
            value={rankTab}
            onChange={setRankTab}
            options={[
              { value: 'google', label: 'Google Search' },
              { value: 'ai', label: 'Cited by AI models' },
            ]}
          />
        </div>

        {rankTab === 'google' && (
          !hydrated ? rankSkeleton : rankGoogle.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>No ranking sources gathered yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {rankGoogle.map((s) => (
                <div key={`g-${s.rank}-${s.domain}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                    <DomainFavicon domain={s.domain} size={16} />
                    <span>{s.domain}</span>
                    <span style={{ color: '#D4D4D8' }}>·</span>
                    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
                      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" fill="#4285F4" />
                      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" fill="#34A853" />
                      <path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" fill="#FBBC05" />
                      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" fill="#EA4335" />
                    </svg>
                    <span style={{ fontWeight: 600, color: '#18181B' }}>#{s.rank}</span>
                  </div>
                  {s.title ? (
                    <a href={s.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 14, fontWeight: 600, color: '#18181B', textDecoration: 'none', lineHeight: '20px', fontFamily: 'var(--font-family-primary)' }}>{s.title}</a>
                  ) : (
                    <span style={{ fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Couldn&apos;t reach the source</span>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {rankTab === 'ai' && (
          !hydrated ? rankSkeleton : rankAi.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>No AI citations found for this keyword.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {rankAi.map((s, i) => (
                <div key={`ai-${i}-${s.domain}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                    <DomainFavicon domain={s.domain} size={16} />
                    <span>{s.domain}</span>
                    <span style={{ color: '#D4D4D8' }}>·</span>
                    <span style={{ color: '#F29964', fontWeight: 600 }}>cited in AI Overview</span>
                  </div>
                  {s.title && (
                    <a href={s.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 14, fontWeight: 600, color: '#18181B', textDecoration: 'none', lineHeight: '20px', fontFamily: 'var(--font-family-primary)' }}>{s.title}</a>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </SidePanel>

      <SidePanel open={panel === 'brand'} title="Brand Knowledge" onClose={() => setPanel(null)}>
        <Textarea
          label="Knowledge"
          value={brandText}
          onChange={(e) => setBrandText(e.target.value)}
          placeholder={'Business type, industry, products/services, customer profile, competitors, topics to cover…'}
          rows={12}
          resize="vertical"
        />
        <p style={{ margin: '12px 0 16px', fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
          Changes will be saved to Brand Knowledge and reflected across everything we create and recommend for you.
        </p>
        <Button type="button" variant="primary" size="md" disabled={savingBrand} busy={savingBrand} onClick={saveBrand}>
          {savingBrand ? 'Saving…' : 'Save'}
        </Button>
      </SidePanel>
    </WizardShell>
  );
};

export default ContextPage;
