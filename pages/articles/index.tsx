import React, { useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import DashboardLayout from '../../components/common/DashboardLayout';
import ArticleList from '../../components/articles/ArticleList';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
import { KoalaPage, KoalaPageHeader, KoalaPageFilters, KoalaPanel } from '../../components/koala/layout';
import { Button, CompactSelect, SearchBar, useTableLoadMore } from '../../components/koala/core';
import { useFetchDomains } from '../../services/domains';
import { useFetchSettings } from '../../services/settings';
import { useWorkspaces } from '../../services/workspaces';
import { useQuery, useQueryClient } from 'react-query';
import { getErrorMessage } from '../../lib/errors';
import { deriveActiveId } from '../../lib/activeWorkspace';
import { buildArticleWorkspaceLinks } from '../../lib/articleWorkspaceLinks';

type ArticleRow = {
  id: number | string;
  title: string;
  status: string;
  score_data?: string;
  content_score?: number;
  target_keyword: string;
  word_count: number | null;
  publish_target: string | null;
  publish_url: string | null;
  created_at: string;
  updated_at: string;
};

function filterAndSortArticles(articles: ArticleRow[], searchQuery: string, sortBy: string): ArticleRow[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? articles.filter((a) => {
        const title = (a.title || '').toLowerCase();
        const kw = (a.target_keyword || '').toLowerCase();
        return title.includes(q) || kw.includes(q);
      })
    : articles;

  return [...filtered].sort((a, b) => {
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
  const [selectedDomainId, setSelectedDomainId] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState('ContentUpdatedAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  const { data: domainsData } = useFetchDomains(router);
  const { data: appSettingsData } = useFetchSettings();
  const { data: wsData } = useWorkspaces();
  const appSettings: SettingsType = appSettingsData?.settings || {};
  const domains: DomainType[] = domainsData?.domains || [];
  const activeWsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const activeDomain = domains.find((domain) => domain.ID === selectedDomainId) || domains[0] || null;
  const activeSlug = activeDomain?.slug || '';
  const articleLinks = buildArticleWorkspaceLinks(activeWsId, activeSlug);
  const startLinks = {
    recommendations: articleLinks.recommendations,
    keyword: articleLinks.keyword,
    contentAudit: articleLinks.contentAudit,
  };

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

  const articles: ArticleRow[] = articlesData?.articles || [];
  const filteredArticles = useMemo(
    () => filterAndSortArticles(articles, searchQuery, sortBy),
    [articles, searchQuery, sortBy],
  );
  const articlesChunk = useTableLoadMore(filteredArticles, {
    pageSize: 20,
    resetKey: `articles-${selectedDomainId ?? 'all'}-${sortBy}-${searchQuery}-${filteredArticles.length}`,
  });

  const headerActions = (
    <div className="articles-page-actions">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => router.push(articleLinks.import)}
        icon={(
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
      >
        <span className="articles-page-actions-label">Import content</span>
      </Button>
      <div className="articles-page-actions-new">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => router.push(articleLinks.keyword)}
          icon={(
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />
            </svg>
          )}
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
        >
          New Content
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          aria-label="New content options"
          onClick={() => router.push(articleLinks.keyword)}
          icon={(
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
            </svg>
          )}
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, minWidth: 36, paddingLeft: 6, paddingRight: 6 }}
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout domains={domains} showAddModal={() => setShowAddDomain(true)} showSettings={() => setShowSettings(true)}>
      <Head><title>Articles — Ranksmile</title></Head>
      <KoalaPage maxWidth={880} className="articles-page">
        <KoalaPageHeader title="Articles" actions={headerActions} borderless />

        <KoalaPageFilters trailing={<SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search" width={300} />}>
          <CompactSelect
            size="sm"
            value={sortBy}
            onChange={(opt) => setSortBy(opt.value)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {['Status', 'Author'].map((label) => (
            <Button key={label} type="button" variant="secondary" size="sm">{label}</Button>
          ))}
        </KoalaPageFilters>

        <KoalaPanel noPadding className="koala-panel--cards">
          {!isLoading && articles.length > 0 && filteredArticles.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: '48px 24px',
                textAlign: 'center',
                fontSize: 14,
                lineHeight: '20px',
                color: 'var(--koala-text-secondary)',
                fontFamily: 'var(--font-family-primary)',
              }}
            >
              No articles match your search.
            </p>
          ) : (
            <ArticleList
              articles={articles.length === 0 ? articles : articlesChunk.visibleItems}
              onDelete={handleDelete}
              onDeleteMultiple={handleDeleteMultiple}
              isLoading={isLoading}
              hasMore={articlesChunk.hasMore}
              onLoadMore={articlesChunk.loadMore}
              isLoadingMore={articlesChunk.isLoading}
              startLinks={startLinks}
            />
          )}
        </KoalaPanel>
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
