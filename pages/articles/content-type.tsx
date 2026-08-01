import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Button } from '../../components/koala/core';
import { Icon } from '../../components/koala/icons/Icon';
import { saveWizardState } from '../../lib/wizardState';
import { useArticle } from '../../services/article';

type ContentTypeOption = {
  id: string;
  label: string;
  details: string;
  icon: string;
  group: 'builtin' | 'custom';
};

/** Built-in templates — card grid (Figma Dialog/Template `8564:560408`). */
const CONTENT_TYPES: ContentTypeOption[] = [
  { id: 'article', label: 'Article', details: 'Long-form editorial content with structure, depth, and SEO coverage.', icon: 'Article', group: 'builtin' },
  { id: 'blog', label: 'Blog Post', details: 'Engaging posts for updates, education, and organic traffic.', icon: 'NoteBlank', group: 'builtin' },
  { id: 'landing', label: 'Landing Page', details: 'Conversion-focused page with clear offer and CTA flow.', icon: 'Browser', group: 'builtin' },
  { id: 'comparison', label: 'Comparison', details: 'Side-by-side evaluation to help readers choose with confidence.', icon: 'Scales', group: 'builtin' },
  { id: 'listicle', label: 'Listicle', details: 'Scannable numbered or bulleted list that ranks and shares well.', icon: 'ListBullets', group: 'builtin' },
  { id: 'product', label: 'Product Page', details: 'E-commerce product copy covering benefits, specs, and proof.', icon: 'Package', group: 'builtin' },
  { id: 'category', label: 'Category Page', details: 'Collection hub that guides shoppers to the right products.', icon: 'SquaresFour', group: 'builtin' },
  { id: 'service', label: 'Service Page', details: 'Local or professional service page with trust and conversion cues.', icon: 'Storefront', group: 'builtin' },
  { id: 'llm', label: 'LLM Optimized', details: 'Structured for AI answer engines and citation-friendly clarity.', icon: 'Robot', group: 'builtin' },
];

const CUSTOM_TYPES: ContentTypeOption[] = [];

function TemplateCard({
  option,
  selected,
  onSelect,
}: {
  option: ContentTypeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`koala-template-card${selected ? ' koala-template-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="koala-template-card__icon" aria-hidden="true">
        <Icon name={option.icon} size={24} weight="bold" color="var(--koala-text-primary)" />
      </span>
      {selected ? (
        <span className="koala-template-card__badge" aria-hidden="true">
          <Icon name="Plus" size={20} weight="bold" color="var(--koala-text-primary)" />
        </span>
      ) : null}
      <span className="koala-template-card__text">
        <span className="koala-template-card__title">{option.label}</span>
        <span className="koala-template-card__desc">{option.details}</span>
      </span>
    </button>
  );
}

const ContentTypePage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const [selected, setSelected] = useState('article');
  const [hydrated, setHydrated] = useState(false);

  const { data: article, isFetched } = useArticle(articleId);

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
      const ws = article?.wizard_state ? JSON.parse(article.wizard_state) as { type?: string } : null;
      if (ws?.type) setSelected(ws.type);
    } catch { /* ignore */ }
    setHydrated(true);
  }, [articleId, isFetched, article]);

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

  const renderCardGrid = (types: ContentTypeOption[]) => (
    <div className="koala-template-card-grid" role="listbox" aria-label="Templates">
      {types.map((t) => (
        <TemplateCard
          key={t.id}
          option={t}
          selected={selected === t.id}
          onSelect={() => setSelected(t.id)}
        />
      ))}
    </div>
  );

  return (
    <WizardShell
      title="Select content type"
      footer={<WizardNextButton label="Context & instructions" onClick={next} />}
    >
      <div className="koala-content-type">
        <header className="koala-content-type__header">
          <span className="koala-content-type__header-icon" aria-hidden="true">
            <Icon name="FileText" size={24} weight="bold" color="var(--koala-text-secondary)" />
          </span>
          <h2 className="koala-content-type__title">Select content type</h2>
          <p className="koala-content-type__subtitle">
            Choose the template to create the document and start from a base.
          </p>
        </header>

        <section className="koala-content-type__section">
          <div className="koala-content-type__section-head">
            <h3 className="koala-content-type__section-title">Your templates</h3>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => toast('Custom templates — coming soon')}
              style={{ fontWeight: 500, borderRadius: 999 }}
            >
              Create template
            </Button>
          </div>
          {CUSTOM_TYPES.length > 0 ? renderCardGrid(CUSTOM_TYPES) : (
            <p className="koala-content-type__empty">
              No custom templates yet. Create one to reuse your best structure.
            </p>
          )}
        </section>

        <section className="koala-content-type__section">
          <div className="koala-content-type__section-head">
            <h3 className="koala-content-type__section-title">
              Built-in templates
              <Icon name="Info" size={16} weight="bold" color="var(--koala-text-secondary)" />
            </h3>
          </div>
          {renderCardGrid(CONTENT_TYPES)}
        </section>
      </div>
    </WizardShell>
  );
};

export default ContentTypePage;
