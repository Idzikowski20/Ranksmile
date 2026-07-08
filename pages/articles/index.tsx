import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { CSSTransition } from 'react-transition-group';
import DashboardLayout from '../../components/common/DashboardLayout';
import ArticleList from '../../components/articles/ArticleList';
import AddDomain from '../../components/domains/AddDomain';
import Settings from '../../components/settings/Settings';
import { SentryPage, SentryPageHeader, SentryPageFilters, SentryPanel } from '../../components/sentry-pages';
import { Button, CompactSelect, SearchBar } from '../../components/core';
import { useFetchDomains } from '../../services/domains';
import { useFetchSettings } from '../../services/settings';
import { useWorkspaces } from '../../services/workspaces';
import { useQuery, useQueryClient } from 'react-query';
import { getErrorMessage } from '../../lib/errors';
import { deriveActiveId } from '../../lib/activeWorkspace';
import { buildArticleWorkspaceLinks } from '../../lib/articleWorkspaceLinks';

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
    topicalMap: articleLinks.topicalMap,
  };

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: articlesData, isLoading } = useQuery(
    ['articles', selectedDomainId],
    () => fetchArticles(selectedDomainId),
    { refetchOnWindowFocus: false },
  );

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Article deleted');
      queryClient.invalidateQueries(['articles']);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteMultiple = async (ids: number[]) => {
    try {
      await Promise.all(ids.map((id) => fetch(`/api/articles/${id}`, { method: 'DELETE' })));
      toast.success(`${ids.length} article${ids.length !== 1 ? 's' : ''} deleted`);
      queryClient.invalidateQueries(['articles']);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Delete failed');
    }
  };

  const articles = articlesData?.articles || [];

  const headerActions = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button
        type="button"
        variant="transparent"
        size="sm"
        aria-label="Export"
        icon={(
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 7L11.8845 4.76892C11.5634 4.1268 11.4029 3.80573 11.1634 3.57116C10.9516 3.36373 10.6963 3.20597 10.4161 3.10931C10.0992 3 9.74021 3 9.02229 3H5.2C4.0799 3 3.51984 3 3.09202 3.21799C2.71569 3.40973 2.40973 3.71569 2.21799 4.09202C2 4.51984 2 5.0799 2 6.2V7M2 7H17.2C18.8802 7 19.7202 7 20.362 7.32698C20.9265 7.6146 21.3854 8.07354 21.673 8.63803C22 9.27976 22 10.1198 22 11.8V16.2C22 17.8802 22 18.7202 21.673 19.362C21.3854 19.9265 20.9265 20.3854 20.362 20.673C19.7202 21 18.8802 21 17.2 21H6.8C5.11984 21 4.27976 21 3.63803 20.673C3.07354 20.3854 2.6146 19.9265 2.32698 19.362C2 18.7202 2 17.8802 2 16.2V7ZM12 17V11M9 14H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      />
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
        Import content
      </Button>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
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
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
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
      <Head><title>Content Editor — SerpBear</title></Head>
      <SentryPage maxWidth={880}>
        <SentryPageHeader title="Content Editor" actions={headerActions} borderless />

        <SentryPageFilters trailing={<SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search" width={300} />}>
          <CompactSelect
            size="sm"
            value={sortBy}
            onChange={(opt) => setSortBy(opt.value)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {['Status', 'Tags', 'Author'].map((label) => (
            <Button key={label} type="button" variant="secondary" size="sm">{label}</Button>
          ))}
        </SentryPageFilters>

        <SentryPanel noPadding className="sentry-panel--cards">
          <ArticleList
            articles={articles}
            onDelete={handleDelete}
            onDeleteMultiple={handleDeleteMultiple}
            isLoading={isLoading}
            startLinks={startLinks}
          />
        </SentryPanel>
      </SentryPage>

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
