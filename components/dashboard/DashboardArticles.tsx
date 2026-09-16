import React, { useState } from 'react';
import Link from 'next/link';
import { CompactSelect } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import ArticleCardGrid from '../articles/ArticleCardGrid';
import type { ArticleCardAuthor, ArticleCardData } from '../articles/ArticleCard';

export const DASHBOARD_ARTICLE_SORTS = [
  { value: 'updated', label: 'Last edited' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title A–Z' },
] as const;
export type DashboardArticleSort = (typeof DASHBOARD_ARTICLE_SORTS)[number]['value'];

const ts = (s: string | null | undefined) => new Date(s || 0).getTime();

export function sortDashboardArticles<T extends ArticleCardData>(articles: T[], sort: DashboardArticleSort): T[] {
  const out = [...articles];
  if (sort === 'title') return out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  if (sort === 'created') return out.sort((a, b) => ts(b.created_at) - ts(a.created_at));
  return out.sort((a, b) => ts(b.updated_at || b.created_at) - ts(a.updated_at || a.created_at));
}

type Props = {
  articles: ArticleCardData[];
  loading?: boolean;
  hrefFor: (a: ArticleCardData) => string;
  allHref: string;
  author?: ArticleCardAuthor;
  limit?: number;
};

/** "Articles | Last edited ▾" — the newest six as cards, the rest one click away. */
export default function DashboardArticles({ articles, loading, hrefFor, allHref, author, limit = 6 }: Props) {
  const [sort, setSort] = useState<DashboardArticleSort>('updated');
  const shown = sortDashboardArticles(articles, sort).slice(0, limit);
  if (!loading && !articles.length) return null;

  return (
    <section aria-label="Articles" data-testid="dashboard-articles">
      <div className="dash-articles__head">
        <h2 className="dash-articles__title">Articles</h2>
        <span className="dash-articles__divider" aria-hidden="true" />
        <CompactSelect
          size="sm"
          value={sort}
          onChange={(opt) => setSort(opt.value as DashboardArticleSort)}
          options={DASHBOARD_ARTICLE_SORTS.map((o) => ({ value: o.value, label: o.label }))}
          trigger={(props, isOpen) => (
            <button type="button" {...props} className="dash-articles__sort" aria-expanded={isOpen}>
              {DASHBOARD_ARTICLE_SORTS.find((o) => o.value === sort)?.label}
              <Icon name="CaretDown" size={14} />
            </button>
          )}
        />
        <Link href={allHref}><a className="dash-articles__all">View all</a></Link>
      </div>
      <ArticleCardGrid articles={shown} hrefFor={hrefFor} author={author} isLoading={loading} skeletonCount={3} />
    </section>
  );
}
