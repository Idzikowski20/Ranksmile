import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Button } from '../../components/core';
import { saveWizardState } from '../../lib/wizardState';
import { useArticle } from '../../services/article';

interface Template { id: string; title: string; sub: string; iconColor?: string; icon: React.ReactNode; }

const BUILTIN: Template[] = [
  { id: 'blog', title: 'Blog Post', sub: 'Long form', icon: <path d="M14 2.27V6.4c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h4.13M16 13H8m8 4H8m2-8H8m6-7H8.8c-1.68 0-2.52 0-3.16.33-.57.29-1.03.74-1.31 1.31C4 4.28 4 5.12 4 6.8v10.4c0 1.68 0 2.52.33 3.16.28.57.74 1.03 1.31 1.31.64.33 1.48.33 3.16.33h6.4c1.68 0 2.52 0 3.16-.33.57-.28 1.03-.74 1.31-1.31.33-.64.33-1.48.33-3.16V8l-6-6Z" /> },
  { id: 'landing', title: 'Landing Page', sub: 'Long form', icon: <path d="M22 9H2M2 7.8v8.4c0 1.68 0 2.52.33 3.16.28.57.74 1.03 1.31 1.31.64.33 1.48.33 3.16.33h10.4c1.68 0 2.52 0 3.16-.33.57-.28 1.03-.74 1.31-1.31.33-.64.33-1.48.33-3.16V7.8c0-1.68 0-2.52-.33-3.16a3 3 0 0 0-1.31-1.31C19.72 3 18.88 3 17.2 3H6.8c-1.68 0-2.52 0-3.16.33-.57.29-1.03.74-1.31 1.31C2 5.28 2 6.12 2 7.8Z" /> },
  { id: 'comparison', title: 'Comparison', sub: 'Long form', icon: <path d="M14 17l3-3-3-3M10 7l-3 3 3 3M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10Z" /> },
  { id: 'listicle', title: 'Listicle', sub: 'Long form', icon: <path d="M21 12H9M21 6H9M21 18H9M5 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM5 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" /> },
  { id: 'product', title: 'Product Page', sub: 'E-commerce', icon: <path d="M8 8h.01M2 5.2v4.47c0 .49 0 .74.06.97.05.2.13.4.24.58.12.2.3.37.64.72l7.67 7.66c1.19 1.19 1.78 1.78 2.47 2.01.6.2 1.25.2 1.85 0 .69-.23 1.28-.82 2.47-2.01l2.21-2.21c1.19-1.19 1.78-1.78 2.01-2.47.2-.6.2-1.25 0-1.85-.23-.69-.82-1.28-2.01-2.47l-7.67-7.66c-.35-.35-.52-.52-.72-.64a2 2 0 0 0-.58-.24C10.41 2 10.16 2 9.67 2H5.2c-1.12 0-1.68 0-2.11.22-.38.19-.68.5-.87.87C2 3.52 2 4.08 2 5.2ZM8.5 8a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" /> },
  { id: 'category', title: 'Category Page', sub: 'E-commerce', icon: <path d="M8.4 3H4.6c-.56 0-.84 0-1.05.11a1 1 0 0 0-.44.44C3 3.76 3 4.04 3 4.6v3.8c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h3.8c.56 0 .84 0 1.05-.11a1 1 0 0 0 .44-.44c.11-.21.11-.49.11-1.05V4.6c0-.56 0-.84-.11-1.05a1 1 0 0 0-.44-.44C9.24 3 8.96 3 8.4 3ZM19.4 3h-3.8c-.56 0-.84 0-1.05.11a1 1 0 0 0-.44.44c-.11.21-.11.49-.11 1.05v3.8c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h3.8c.56 0 .84 0 1.05-.11a1 1 0 0 0 .44-.44c.11-.21.11-.49.11-1.05V4.6c0-.56 0-.84-.11-1.05a1 1 0 0 0-.44-.44C20.24 3 19.96 3 19.4 3ZM19.4 14h-3.8c-.56 0-.84 0-1.05.11a1 1 0 0 0-.44.44c-.11.21-.11.49-.11 1.05v3.8c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h3.8c.56 0 .84 0 1.05-.11a1 1 0 0 0 .44-.44c.11-.21.11-.49.11-1.05v-3.8c0-.56 0-.84-.11-1.05a1 1 0 0 0-.44-.44C20.24 14 19.96 14 19.4 14ZM8.4 14H4.6c-.56 0-.84 0-1.05.11a1 1 0 0 0-.44.44c-.11.21-.11.49-.11 1.05v3.8c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h3.8c.56 0 .84 0 1.05-.11a1 1 0 0 0 .44-.44c.11-.21.11-.49.11-1.05v-3.8c0-.56 0-.84-.11-1.05a1 1 0 0 0-.44-.44C9.24 14 8.96 14 8.4 14Z" /> },
  { id: 'service', title: 'Service Page', sub: 'Local business', icon: <path d="M9 21v-7.4c0-.56 0-.84.11-1.05a1 1 0 0 1 .44-.44c.21-.11.49-.11 1.05-.11h2.8c.56 0 .84 0 1.05.11a1 1 0 0 1 .44.44c.11.21.11.49.11 1.05V21M11.02 2.76 4.24 8.04c-.45.35-.68.53-.84.75a2 2 0 0 0-.32.65C3 9.7 3 9.99 3 10.57V17.8c0 1.12 0 1.68.22 2.11.19.38.5.68.87.87.43.22.99.22 2.11.22h11.6c1.12 0 1.68 0 2.11-.22.38-.19.68-.5.87-.87.22-.43.22-.99.22-2.11v-7.23c0-.58 0-.87-.07-1.13a2 2 0 0 0-.32-.65c-.16-.22-.39-.4-.84-.75l-6.78-5.28c-.35-.27-.53-.41-.72-.46a1 1 0 0 0-.52 0c-.2.05-.37.19-.72.46Z" /> },
  { id: 'llm', title: 'LLM Optimized', sub: 'Special', icon: <path d="M8.5 12.5S9.81 14 12 14s3.5-1.5 3.5-1.5M14.75 7.5h.01M9.25 7.5h.01M7 18v2.34c0 .53 0 .8.11.93.1.12.24.19.39.19.18 0 .38-.16.8-.5l2.39-1.9c.49-.39.73-.59 1-.73.24-.12.5-.21.76-.27.3-.06.61-.06 1.23-.06h2.52c1.68 0 2.52 0 3.16-.33.57-.29 1.03-.74 1.31-1.31.33-.64.33-1.48.33-3.16V7.8c0-1.68 0-2.52-.33-3.16a3 3 0 0 0-1.31-1.31C18.72 3 17.88 3 16.2 3H7.8c-1.68 0-2.52 0-3.16.33-.57.29-1.03.74-1.31 1.31C3 5.28 3 6.12 3 7.8V14c0 .93 0 1.4.1 1.78.28 1.03 1.09 1.84 2.12 2.12.39.1.85.1 1.78.1Z" /> },
];

// Custom (user-created) template demo entry — shown under "Your templates".
const CUSTOM: Template[] = [];

const TemplateCard = ({ t, selected, onSelect }: { t: Template; selected: boolean; onSelect: () => void; }) => (
  <div
    role="button"
    aria-pressed={selected}
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    style={{
      minHeight: 112, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: 16,
      borderRadius: 16, border: `1px solid ${selected ? '#E4E4E7' : '#F4F4F5'}`,
      background: selected ? '#f3f4f0' : '#fff', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
    }}
    onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#E4E4E7'; }}
    onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#F4F4F5'; }}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: t.iconColor || '#52525C', flexShrink: 0 }} strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {t.icon}
    </svg>
    <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }} title={t.title}>{t.title}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>{t.sub}</span>
    </div>
  </div>
);

const sectionLabel: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' };

const ContentTypePage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const [selected, setSelected] = useState('blog');
  const [hydrated, setHydrated] = useState(false);

  // Prefill from a resumed draft (shared/cached article fetch).
  const { data: article, isFetched } = useArticle(articleId);

  // Imported articles (meta_url set) belong in the editor, not the new-content wizard.
  useEffect(() => {
    if (!articleId || !isFetched) return;
    if (article?.meta_url) {
      router.replace(`/articles/${articleId}`);
    }
  }, [articleId, isFetched, article?.meta_url, router]);

  useEffect(() => {
    if (!articleId) { setHydrated(true); return; }
    if (!isFetched) return;
    try {
      const ws = article?.wizard_state ? JSON.parse(article.wizard_state) : null;
      if (ws?.type) setSelected(ws.type);
    } catch { /* ignore */ }
    setHydrated(true);
  }, [articleId, isFetched, article]);

  // Persist progress so the draft can be resumed if the user leaves.
  useEffect(() => {
    if (!hydrated || !articleId) return undefined;
    const t = setTimeout(() => saveWizardState(articleId, { step: 'content-type', type: selected }), 350);
    return () => clearTimeout(t);
  }, [hydrated, articleId, selected]);

  const next = () => {
    const q = new URLSearchParams();
    if (articleId) q.set('articleId', articleId);
    q.set('type', selected);
    router.push(`/articles/context?${q.toString()}`);
  };

  return (
    <WizardShell
      title="Select content type"
      footer={<WizardNextButton label="Context & instructions" onClick={next} />}
    >
      <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 600, color: '#000', fontFamily: 'var(--font-family-primary)' }}>
        Select content type
      </h2>

      {/* Your templates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={sectionLabel}>Your templates</span>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => toast('Custom templates — coming soon')}
            style={{ fontWeight: 600 }}
          >
            Create template
          </Button>
        </div>
        {CUSTOM.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CUSTOM.map((t) => <TemplateCard key={t.id} t={t} selected={selected === t.id} onSelect={() => setSelected(t.id)} />)}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
            No custom templates yet. Create one to reuse your best structure.
          </p>
        )}
      </div>

      {/* Built-in templates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
          Built-in templates
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#52525C', flexShrink: 0 }}>
            <path d="M12 16v-4M12 8h.01M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {BUILTIN.map((t) => <TemplateCard key={t.id} t={t} selected={selected === t.id} onSelect={() => setSelected(t.id)} />)}
        </div>
      </div>
    </WizardShell>
  );
};

export default ContentTypePage;
