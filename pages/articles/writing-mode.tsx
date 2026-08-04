import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import WizardShell, { WizardNextButton, WizardBackButton } from '../../components/articles/WizardShell';
import { Switch } from '../../components/koala/core';
import { saveWizardState, clearWizardState } from '../../lib/wizardState';
import { useArticle } from '../../services/article';

const WritingModePage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const type = typeof router.query.type === 'string' ? router.query.type : 'blog';

  const [mode, setMode] = useState<'write' | 'generate'>('generate');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [reviewOutline, setReviewOutline] = useState(false);
  const [internalLinks, setInternalLinks] = useState(true);
  const [externalLinks, setExternalLinks] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const { data: article, isFetched } = useArticle(articleId);
  useEffect(() => {
    if (!articleId) { setHydrated(true); return; }
    if (!isFetched) return;
    try {
      const ws = article?.wizard_state ? JSON.parse(article.wizard_state) : null;
      if (ws) {
        if (ws.mode === 'write' || ws.mode === 'generate') setMode(ws.mode);
        if (typeof ws.outline === 'boolean') setReviewOutline(ws.outline);
        if (typeof ws.internal === 'boolean') setInternalLinks(ws.internal);
        if (typeof ws.external === 'boolean') setExternalLinks(ws.external);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [articleId, isFetched, article]);

  useEffect(() => {
    if (!hydrated || !articleId) return undefined;
    const t = setTimeout(() => saveWizardState(articleId, { step: 'writing-mode', mode, outline: reviewOutline, internal: internalLinks, external: externalLinks }), 350);
    return () => clearTimeout(t);
  }, [hydrated, articleId, mode, reviewOutline, internalLinks, externalLinks]);

  const goBack = () => {
    const q = new URLSearchParams();
    if (articleId) q.set('articleId', articleId);
    q.set('type', type);
    router.push(`/articles/context?${q.toString()}`);
  };
  const goNext = () => {
    if (mode === 'write') {
      if (articleId) { clearWizardState(articleId); router.push(`/articles/${articleId}`); return; }
      router.push('/articles');
      return;
    }
    const q = new URLSearchParams();
    if (articleId) q.set('articleId', articleId);
    q.set('type', type);
    q.set('outline', reviewOutline ? '1' : '0');
    q.set('internal', internalLinks ? '1' : '0');
    q.set('external', externalLinks ? '1' : '0');
    router.push(`/articles/generating?${q.toString()}`);
  };

  const card = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`koala-wizard-card${active ? ' koala-wizard-card--active' : ''}`}
    >
      {children}
    </button>
  );

  const preview = (lines: number) => (
    <div className="koala-wizard-preview" aria-hidden="true">
      <div className="koala-wizard-preview-inner">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="koala-wizard-preview-line"
            style={{ width: `${[100, 70, 90, 60, 85, 75][i % 6]}%`, opacity: i % 4 === 2 ? 0.85 : 1 }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <WizardShell
      title="Select writing mode"
      footer={<>
        <WizardBackButton onClick={goBack} />
        <WizardNextButton label={mode === 'write' ? 'Open editor' : 'Generate draft'} onClick={goNext} />
      </>}
    >
      <h2 className="koala-wizard-title">Select writing mode</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {card(mode === 'write', () => setMode('write'), (
          <>
            {preview(4)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="koala-wizard-card-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.29 3.31c2.67-2.43 6.75-2.43 9.42 0 .12.11.26.25.47.46l.05.05c.21.22.35.35.46.48 2.43 2.67 2.43 6.74 0 9.41a1 1 0 0 1-.69.29H11a1 1 0 1 0 0 2h5.48c.61 0 .91 0 1.05.12a.5.5 0 0 1 .17.42c-.01.18-.23.4-.66.82l-1.87 1.87c-.13.14-.3.3-.5.43-.18.11-.38.19-.58.24-.24.06-.48.06-.67.06H6.57c-.26 0-.5 0-.71-.02a2 2 0 0 1-.37-.06l-2.78 2.78a1 1 0 1 1-1.42-1.41l2.78-2.78a2 2 0 0 1-.05-.37c-.02-.21-.02-.45-.02-.7v-6.77c0-.19 0-.43.06-.66.05-.2.13-.4.24-.58.13-.2.3-.37.43-.5l5.06-5.06c.21-.22.35-.36.47-.47Z" /></svg>
                Write it yourself
              </span>
              <p className="koala-wizard-card-desc">Start with a blank page and use AI assistance when needed.</p>
            </div>
          </>
        ))}

        {card(mode === 'generate', () => setMode('generate'), (
          <>
            {preview(8)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="koala-wizard-card-title" style={{ color: 'var(--koala-brand, #F84416)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.93 1.64a1 1 0 0 0-1.86 0L9.05 6.87c-.3.78-.4 1.01-.52 1.19-.13.18-.29.34-.47.47-.18.13-.41.22-1.19.52L1.64 11.07a1 1 0 0 0 0 1.86l5.23 2.01c.78.3 1.01.4 1.19.52.18.13.34.29.47.47.13.18.22.41.52 1.19l2.01 5.23a1 1 0 0 0 1.86 0l2.01-5.23c.3-.78.4-1.01.52-1.19.13-.18.29-.34.47-.47.18-.13.41-.22 1.19-.52l5.23-2.01a1 1 0 0 0 0-1.86l-5.23-2.01c-.78-.3-1.01-.4-1.19-.52a1.5 1.5 0 0 1-.47-.47c-.13-.18-.22-.41-.52-1.19L12.93 1.64Z" /></svg>
                Generate content
              </span>
              <p className="koala-wizard-card-desc">Let AI create complete content optimized for AI Search and SEO.</p>
              <div
                onClick={(e) => { e.stopPropagation(); setCustomizeOpen((v) => !v); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', color: 'var(--koala-text-secondary)' }}
              >
                <span>With internal and external links ·</span>
                <span style={{ color: 'var(--koala-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  Customize
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ transform: customizeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} aria-hidden="true"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>
                </span>
              </div>
              {customizeOpen && mode === 'generate' && (
                <div onClick={(e) => e.stopPropagation()} className="koala-wizard-customize">
                  {[
                    { l: 'Review outline before generating content', v: reviewOutline, set: (c: boolean) => setReviewOutline(c) },
                    { l: 'Insert internal links to your site', v: internalLinks, set: (c: boolean) => setInternalLinks(c) },
                    { l: 'Insert external links to third-party sources', v: externalLinks, set: (c: boolean) => setExternalLinks(c) },
                  ].map((row) => (
                    <div key={row.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Switch checked={row.v} onChange={row.set} aria-label={row.l} />
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--koala-text-primary)' }}>{row.l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ))}
      </div>
    </WizardShell>
  );
};

export default WritingModePage;
