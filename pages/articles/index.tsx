import React, { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import { useQuery, useQueryClient } from 'react-query';
import { getErrorMessage } from '@/src/core/shared/errors';
import { deriveActiveId, workspaceHref } from '@/src/core/domain/navigation/activeWorkspace';
import { buildArticleWorkspaceLinks } from '@/src/core/domain/articles/articleWorkspaceLinks';
import { authClient } from '@/src/infrastructure/auth/client';
import DashboardLayout from '../../components/common/DashboardLayout';
import ArticleCardGrid from '../../components/articles/ArticleCardGrid';
import ArticleEmptyStart from '../../components/articles/ArticleEmptyStart';
import type { ArticleCardData } from '../../components/articles/ArticleCard';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
import { KoalaPage } from '../../components/koala/layout';
import { CompactSelect, useTableLoadMore } from '../../components/koala/core';
import { Icon } from '../../components/koala/icons/Icon';
import ActionTiles from '../../components/dashboard/ActionTiles';
import { useFetchDomains } from '../../services/domains';
import { useProfile } from '../../services/profile';
import { useWorkspaces } from '../../services/workspaces';

export function sortArticles(articles: ArticleCardData[], sortBy: string): ArticleCardData[] {
  return [...articles].sort((a, b) => {
    if (sortBy === 'Title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'CreatedAt') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const aTs = new Date(a.updated_at || a.created_at).getTime();
    const bTs = new Date(b.updated_at || b.created_at).getTime();
    return bTs - aTs;
  });
}

const fetchArticles = async (domainId?: number) => {
  const url = domainId ? `/api/articles?domainId=${domainId}` : '/api/articles';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
};

const SORT_OPTIONS = [
  { label: 'Last edited', value: 'ContentUpdatedAt' },
  { label: 'Created', value: 'CreatedAt' },
  { label: 'Title A–Z', value: 'Title' },
];

const ArticlesPage: NextPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [selectedDomainId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState('ContentUpdatedAt');
  const [mounted, setMounted] = useState(false);

  const { data: domainsData } = useFetchDomains(router);
  const { data: wsData } = useWorkspaces();
  const { data: profile } = useProfile();
  const session = authClient.useSession?.();
  const domains: DomainType[] = domainsData?.domains || [];
  const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeDomain = domains.find((domain) => domain.ID === selectedDomainId) || domains[0] || null;
  const activeSlug = activeDomain?.slug || '';
  const articleLinks = buildArticleWorkspaceLinks(activeWsId, activeSlug);
  const userName = mounted ? (profile?.name || session?.data?.user?.name || '') : '';
  const author = userName ? { name: userName, avatarUrl: profile?.avatarUrl } : undefined;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: articlesData, isLoading } = useQuery(
    ['articles', selectedDomainId],
    () => fetchArticles(selectedDomainId),
    { refetchOnWindowFocus: false },
  );

  const handleDelete = async (id: number | string) => {
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Article deleted');
      queryClient.invalidateQueries(['articles']);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteMultiple = async (ids: Array<number | string>) => {
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/articles/${id}`, { method: 'DELETE' })),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        throw new Error(`Delete failed for ${failed.length} of ${ids.length} articles`);
      }
      toast.success(`${ids.length} article${ids.length !== 1 ? 's' : ''} deleted`);
      queryClient.invalidateQueries(['articles']);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Delete failed');
    }
  };

  const articles: ArticleCardData[] = useMemo(() => articlesData?.articles || [], [articlesData]);
  const sortedArticles = useMemo(() => sortArticles(articles, sortBy), [articles, sortBy]);
  const articlesChunk = useTableLoadMore(sortedArticles, {
    pageSize: 21,
    resetKey: `articles-${selectedDomainId ?? 'all'}-${sortBy}-${sortedArticles.length}`,
  });

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label;

  return (
    <DashboardLayout domains={domains} showAddModal={() => setShowAddDomain(true)} showSettings={() => setShowSettings(true)}>
      <Head><title>Articles — Ranksmile</title></Head>
      <KoalaPage maxWidth={1120} className="articles-page">
        <div className="articles-page__stack">
          <ActionTiles tiles={[
            { key: 'new', title: 'New content', description: 'Write an article that ranks', href: articleLinks.keyword, icon: 'NotePencil' },
            { key: 'import', title: 'Import content', description: 'Bring in an article you already have', href: articleLinks.import, icon: 'DownloadSimple' },
          ]} />

          <section aria-label="Articles">
            <div className="dash-articles__head">
              <h1 className="dash-articles__title">Articles</h1>
              <span className="dash-articles__divider" aria-hidden="true" />
              <CompactSelect
                size="sm"
                value={sortBy}
                onChange={(opt) => setSortBy(opt.value)}
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                trigger={(props, isOpen) => (
                  <button type="button" {...props} className="dash-articles__sort" aria-expanded={isOpen}>
                    {sortLabel}
                    <Icon name="CaretDown" size={14} />
                  </button>
                )}
              />
            </div>

            <ArticleCardGrid
              articles={articles.length === 0 ? articles : articlesChunk.visibleItems}
              hrefFor={(a) => workspaceHref(activeWsId, `/articles/${a.id}`)}
              author={author}
              isLoading={isLoading}
              emptyState={(
                <ArticleEmptyStart links={{
                  recommendations: articleLinks.recommendations,
                  keyword: articleLinks.keyword,
                  contentAudit: articleLinks.contentAudit,
                }} />
              )}
              onDelete={handleDelete}
              onDeleteMultiple={handleDeleteMultiple}
              hasMore={articlesChunk.hasMore}
              onLoadMore={articlesChunk.loadMore}
              isLoadingMore={articlesChunk.isLoading}
            />
          </section>
        </div>
      </KoalaPage>

      {showAddDomain && (
        <AddDomain
          domains={domains}
          closeModal={() => setShowAddDomain(false)}
        />
      )}

      <CSSTransition in={showSettings} timeout={300} classNames="settings_anim" unmountOnExit mountOnEnter>
        <Settings closeSettings={() => setShowSettings(false)} />
      </CSSTransition>

    </DashboardLayout>
  );
};

export default ArticlesPage;
