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

  return (
    <DashboardLayout domains={domains} showAddModal={() => setShowAddDomain(true)} showSettings={() => setShowSettings(true)}>
      <Head><title>Content Editor — SerpBear</title></Head>
      {/* Main scrollable area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          background: '#fff',
          padding: '0 16px',
        }}
        className="styled-scrollbar content-editor-scroll"
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            paddingTop: 0,
            paddingBottom: 16,
          }}
        >
          {/* ─── Header ─── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 40,
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontSize: 20,
                      lineHeight: '28px',
                      fontWeight: 600,
                      color: '#2F2F34',
                      fontFamily: 'var(--font-family-primary)',
                      letterSpacing: 0,
                    }}
                  >
                    Content Editor
                  </span>
                </div>
              </div>

              {/* Toolbar buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Create folder */}
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#3F3F47',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#2F2F34'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#3F3F47'; }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M13 7L11.8845 4.76892C11.5634 4.1268 11.4029 3.80573 11.1634 3.57116C10.9516 3.36373 10.6963 3.20597 10.4161 3.10931C10.0992 3 9.74021 3 9.02229 3H5.2C4.0799 3 3.51984 3 3.09202 3.21799C2.71569 3.40973 2.40973 3.71569 2.21799 4.09202C2 4.51984 2 5.0799 2 6.2V7M2 7H17.2C18.8802 7 19.7202 7 20.362 7.32698C20.9265 7.6146 21.3854 8.07354 21.673 8.63803C22 9.27976 22 10.1198 22 11.8V16.2C22 17.8802 22 18.7202 21.673 19.362C21.3854 19.9265 20.9265 20.3854 20.362 20.673C19.7202 21 18.8802 21 17.2 21H6.8C5.11984 21 4.27976 21 3.63803 20.673C3.07354 20.3854 2.6146 19.9265 2.32698 19.362C2 18.7202 2 17.8802 2 16.2V7ZM12 17V11M9 14H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Import content */}
                  <button
                    type="button"
                    onClick={() => router.push(articleLinks.import)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#F4F4F5',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 600,
                      color: '#2F2F34',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
                      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>Import content</span>
                  </button>

                  {/* New Content split button */}
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 1 }}>
                    <button
                      type="button"
                      onClick={() => router.push(articleLinks.keyword)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 16px',
                        borderRadius: '6px 0 0 6px',
                        border: 'none',
                        background: '#2F2F34',
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34'; }}
                    >
                      <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0 }}>
                        <path fill="currentColor" d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />
                      </svg>
                      <span>New Content</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(articleLinks.keyword)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 6,
                        borderRadius: '0 6px 6px 0',
                        border: 'none',
                        background: '#2F2F34',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34'; }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters row */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
                  {/* Sort dropdown */}
                  <div style={{ width: 180 }}>
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        height: 32,
                        padding: '0 12px 0 12px',
                        borderRadius: 8,
                        border: '1px solid #D4D4D8',
                        background: '#fff',
                        fontSize: 13,
                        lineHeight: '16px',
                        fontWeight: 600,
                        color: '#2F2F34',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family-primary)',
                        boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Last edited'}
                      </span>
                      <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0, color: '#9F9FA9' }}>
                        <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Filter buttons group */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Status', 'Tags', 'Author'].map((label) => (
                        <button
                          key={label}
                          type="button"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 16px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'transparent',
                            fontSize: 14,
                            lineHeight: '20px',
                            fontWeight: 600,
                            color: '#3F3F47',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family-primary)',
                            boxShadow: 'inset 0 0 0 1px #E4E4E7',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          {label}
                          <svg viewBox="0 0 20 20" width="20" height="20" style={{ color: '#9F9FA9' }}>
                            <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                          </svg>
                        </button>
                      ))}
                    </div>

                    {/* Search input */}
                    <div style={{ width: 300, position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#9F9FA9',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                        </svg>
                      </div>
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        style={{
                          width: '100%',
                          height: 32,
                          paddingLeft: 32,
                          paddingRight: 12,
                          border: '1px solid #D4D4D8',
                          borderRadius: 8,
                          fontSize: 13,
                          lineHeight: '16px',
                          color: '#2F2F34',
                          background: '#fff',
                          outline: 'none',
                          fontFamily: 'var(--font-family-primary)',
                          boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#AA93FD';
                          e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06), 0 0 0 2px rgba(120,58,251,0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#D4D4D8';
                          e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(26,29,40,0.06)';
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Article list */}
                <ArticleList
                  articles={articles}
                  onDelete={handleDelete}
                  onDeleteMultiple={handleDeleteMultiple}
                  isLoading={isLoading}
                  startLinks={startLinks}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
