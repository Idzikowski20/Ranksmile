import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { computeOverallContentScore } from '@/src/core/domain/aiScore/aiSearchScore';
import { ARTICLE_GREEN_AT } from '@/src/infrastructure/config/scoreColor';
import { articleCardStatus, ARTICLE_CARD_STATUS_LABEL, type ArticleCardStatus } from '@/src/core/domain/articles/articleCard';
import { Badge, HoverTooltip } from '../koala/core';
import { Avatar } from '../koala/primitives';
import { Icon } from '../koala/icons/Icon';
import ScoreGauge from './ScoreGauge';

export type ArticleCardData = {
  id: number | string;
  title: string;
  status: string;
  publish_url?: string | null;
  preview_html?: string | null;
  featured_image?: string | null;
  has_content?: boolean;
  is_outline?: boolean;
  content_score?: number | null;
  seo_score?: number | null;
  ai_score?: number | null;
  created_at: string;
  updated_at: string;
};

export type ArticleCardAuthor = { name: string; avatarUrl?: string | null };

type Props = {
  article: ArticleCardData;
  href: string;
  author?: ArticleCardAuthor;
  selected?: boolean;
  onDelete?: (id: number | string) => void | Promise<void>;
  onSelect?: (id: number | string) => void;
};

const BADGE: Record<ArticleCardStatus, { appearance: 'warning' | 'info' | 'success' | 'muted'; icon: string }> = {
  waiting_review: { appearance: 'warning', icon: 'Clock' },
  being_edited: { appearance: 'info', icon: 'PencilSimple' },
  published: { appearance: 'success', icon: 'CheckCircle' },
  generating: { appearance: 'muted', icon: 'Sparkle' },
};

export function relativeEditTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return '';
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The editor's centre gauge: SEO+AI blend when both exist, the stored score otherwise. */
export function cardScore(a: ArticleCardData): { score: number | null; halves?: { left: number; right: number } } {
  const seo = Number(a.seo_score);
  const ai = Number(a.ai_score);
  const hasBlend = a.seo_score != null && a.ai_score != null && Number.isFinite(seo) && Number.isFinite(ai);
  if (hasBlend) return { score: computeOverallContentScore(seo, ai), halves: { left: seo, right: ai } };
  return { score: typeof a.content_score === 'number' ? a.content_score : null };
}

const Placeholder = () => (
  <div className="article-card__placeholder" aria-hidden="true">
    <span style={{ width: '70%' }} />
    <span style={{ width: '92%' }} />
    <span style={{ width: '86%' }} />
    <span style={{ width: '60%' }} />
  </div>
);

/**
 * One article as the dashboard and the Content page show it: the article's own first
 * blocks scaled down to a thumbnail, its score on that page, a badge that says what a
 * click leads to, then the title and who touched it last.
 */
export default function ArticleCard({ article, href, author, selected, onDelete, onSelect }: Props) {
  const [edited, setEdited] = useState('');
  useEffect(() => { setEdited(relativeEditTime(article.updated_at || article.created_at)); }, [article.updated_at, article.created_at]);

  const status = articleCardStatus({
    status: article.status,
    publish_url: article.publish_url,
    is_outline: !!article.is_outline,
    has_content: !!article.has_content,
  });
  const { score, halves } = cardScore(article);
  const preview = (article.preview_html || '').trim();

  return (
    <article className={`article-card${selected ? ' is-selected' : ''}`} data-status={status}>
      <Link href={href}>
        <a className="article-card__link" aria-label={article.title || '(untitled)'} />
      </Link>

      <span className="article-card__badge">
        <Badge appearance={BADGE[status].appearance} size="sm" icon={<Icon name={BADGE[status].icon} size={12} />}>
          {ARTICLE_CARD_STATUS_LABEL[status]}
        </Badge>
      </span>

      {(onDelete || onSelect) ? (
        <div className="article-card-hover-actions" role="toolbar" aria-label="Article actions">
          <Link href={href}>
            <a className="article-card-hover-btn" aria-label="Edit" title="Edit"><Icon name="PencilSimple" size={20} /></a>
          </Link>
          {onDelete ? (
            <HoverTooltip label="Delete">
              <button type="button" className="article-card-hover-btn" aria-label="Delete" onClick={() => onDelete(article.id)}>
                <Icon name="Trash" size={20} />
              </button>
            </HoverTooltip>
          ) : null}
          {onSelect ? (
            <button type="button" className="article-card-hover-btn" aria-label="Select" title="Select" onClick={() => onSelect(article.id)}>
              <Icon name="CheckCircle" size={20} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* The editor in miniature: the article page and, beside it, the score panel. */}
      <div className="article-card__thumb" aria-hidden="true">
        <div className="article-card__page">
          <div className="article-card__doc-frame">
            {preview ? (
              <div className="article-card__doc">
                {article.featured_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.featured_image} alt="" loading="lazy" className="article-card__hero" />
                ) : null}
                <div dangerouslySetInnerHTML={{ __html: preview }} />
              </div>
            ) : <Placeholder />}
          </div>
          {/* The Content Score panel in grey: title, SEO · score · AI, the action bar, the step rows. */}
          <aside className="article-card__panel">
            <span className="article-card__panel-title" />
            <div className="article-card__panel-score">
              <i className="article-card__panel-ring" />
              {score != null ? (
                <div className="article-card__score">
                  <ScoreGauge score={score} size={34} greenAt={ARTICLE_GREEN_AT} halves={halves} />
                </div>
              ) : <i className="article-card__panel-ring article-card__panel-ring--big" />}
              <i className="article-card__panel-ring" />
            </div>
            <span className="article-card__panel-bar" />
            <ul className="article-card__panel-rows">
              <li><b /><span /></li>
              <li><b /><span /></li>
              <li><b /><span /></li>
              <li><b /><span /></li>
            </ul>
          </aside>
        </div>
      </div>

      <h3 className="article-card__title">{article.title || '(untitled)'}</h3>
      <div className="article-card__meta">
        <span suppressHydrationWarning>{edited ? `Last edited ${edited}` : ''}</span>
        {author?.name ? (
          <span className="article-card__author">
            <Avatar src={author.avatarUrl || undefined} name={author.name} size={20} />
            <span className="article-card__author-name">{author.name}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}
