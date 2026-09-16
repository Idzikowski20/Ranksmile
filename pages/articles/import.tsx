import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { writeAnalyzeSession } from '@/src/core/domain/articles/deepAnalysisProgress';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '@/src/core/domain/navigation/activeWorkspace';
import toast from 'react-hot-toast';
import { useWorkspaces } from '../../services/workspaces';
import { useFetchDomains } from '../../services/domains';
import { useDomainBusy } from '../../services/domainPipeline';
import DomainBusyNotice from '../../components/dashboard/DomainBusyNotice';
import AddPagesModal from '../../components/domains/AddPagesModal';
import { aggregateGscPages } from '../../utils/gsc';
import { Icon } from '../../components/koala/icons/Icon';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Flag } from '../../components/koala';

const COUNTRIES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  PL: 'Poland',
  DE: 'Germany',
  FR: 'France',
};

/** Import sources — same template-card grid as the content-type step (Figma `8564:560408`). */
const SOURCES = [
  {
    id: 'gsc' as const,
    label: 'From Search Console',
    details: 'Pick indexed pages by traffic and impressions, then import them in bulk.',
    icon: 'MagnifyingGlass',
  },
  {
    id: 'url' as const,
    label: 'From URL',
    details: 'Paste the address of an existing page and target it with keywords.',
    icon: 'Globe',
  },
];

const ImportPage: NextPage = () => {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [country, setCountry] = useState('PL');
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [source, setSource] = useState<'gsc' | 'url' | null>(null);
  const [importingCount, setImportingCount] = useState(0);
  const { data: wsData } = useWorkspaces();
  const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const { data: domainsData } = useFetchDomains(router, false);
  const domains: DomainType[] = domainsData?.domains || [];
  const activeDomain = resolveActiveDomain(domains, wsId, null) || domains[0] || null;
  const busy = useDomainBusy(activeDomain?.slug);

  const { data: scData, isLoading: gscLoading } = useQuery(
    ['sc-data', activeDomain?.slug],
    async () => {
      const res = await fetch(`/api/gsc/search-data?domain=${activeDomain?.slug}`);
      return res.json();
    },
    { enabled: source === 'gsc' && !!activeDomain?.slug, staleTime: 5 * 60 * 1000 },
  );

  const gscPages = useMemo(
    () => aggregateGscPages((scData?.data?.thirtyDays || []) as SearchAnalyticsItem[]),
    [scData],
  );

  // ponytail: imports fire in parallel with no concurrency cap — add batching if
  // selecting 50+ pages starts timing out the scraper.
  const importPages = async (paths: string[]) => {
    const picked = gscPages.filter((p) => paths.includes(p.path));
    if (!picked.length) return;
    setSource(null);
    setImportingCount(picked.length);
    try {
      const results = await Promise.all(picked.map((p) => fetch('/api/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: p.url,
          keywords: p.keyword ? [p.keyword] : [],
          country,
          domainId: activeDomain?.ID,
          startAnalysis: true,
        }),
      }).then((r) => r.ok).catch(() => false)));
      const failed = results.filter((ok) => !ok).length;
      if (failed) toast.error(`${failed} of ${picked.length} pages failed to import`);
      if (failed < picked.length) toast.success(`Imported ${picked.length - failed} page(s)`);
      await router.push(workspaceHref(wsId, '/articles'));
    } finally {
      setImportingCount(0);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleNext = async () => {
    if (!url.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          keywords,
          country,
          startAnalysis: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Import failed');
        return;
      }
      const articleId = Number(data.articleId);
      if (!Number.isFinite(articleId)) {
        toast.error('Import succeeded but could not open the editor');
        return;
      }
      writeAnalyzeSession(articleId, {
        url: url.trim(),
        keywords,
        country,
      });
      await router.replace(workspaceHref(wsId, `/articles/${articleId}`));
    } catch {
      toast.error('Import failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = url.trim().length > 0 && !isSubmitting;
  const countryName = COUNTRIES[country] || COUNTRIES.US;

  if (busy) {
    return (
      <WizardShell title="Import Content">
        <DomainBusyNotice dashboardHref={workspaceHref(wsId, '/dashboard')} />
      </WizardShell>
    );
  }

  if (source !== 'url') {
    return (
      <WizardShell title="Import Content">
        <div className="koala-content-type koala-content-type--centered">
          <header className="koala-content-type__header">
            <span className="koala-content-type__header-icon" aria-hidden="true">
              <Icon name="DownloadSimple" size={24} weight="bold" color="var(--koala-text-secondary)" />
            </span>
            <h2 className="koala-content-type__title">Import existing content</h2>
            <p className="koala-content-type__subtitle">
              Pull pages straight from Search Console, or import a single URL.
            </p>
          </header>

          <section className="koala-content-type__section">
            <div className="koala-template-card-grid" role="listbox" aria-label="Import source">
              {SOURCES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="koala-template-card"
                  onClick={() => setSource(o.id)}
                  disabled={importingCount > 0}
                >
                  <span className="koala-template-card__icon" aria-hidden="true">
                    <Icon name={o.icon} size={24} weight="bold" color="var(--koala-text-primary)" />
                  </span>
                  <span className="koala-template-card__text">
                    <span className="koala-template-card__title">{o.label}</span>
                    <span className="koala-template-card__desc">{o.details}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {importingCount > 0 ? (
            <p className="koala-content-type__empty">Importing {importingCount} page(s)…</p>
          ) : null}
          {source === 'gsc' && gscLoading ? (
            <p className="koala-content-type__empty">Loading pages from Search Console…</p>
          ) : null}
        </div>

        {source === 'gsc' && !gscLoading ? (
          <AddPagesModal
            pages={gscPages}
            onClose={() => setSource(null)}
            onAdd={(paths) => { importPages(paths).catch(() => undefined); }}
          />
        ) : null}
      </WizardShell>
    );
  }

  return (
    <WizardShell
      title="Import Content"
      footer={(
        <WizardNextButton
          label={isSubmitting ? 'Importing…' : 'Open in editor'}
          disabled={!canProceed}
          onClick={() => { void handleNext(); }}
        />
      )}
    >
      <div>
        <h2 className="koala-wizard-title">Import content from URL</h2>
        <p className="koala-wizard-subtitle">
          Enter the URL of an existing page and select keywords to target
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <label className="koala-wizard-label">Keyword</label>
            <KeywordSuggestInput
              keywords={keywords}
              onAdd={addKeyword}
              onRemove={removeKeyword}
              country={country}
              placeholder="Enter keyword(s) you want to rank for..."
            />
          </div>

          <div style={{ width: 188 }}>
            <label className="koala-wizard-label">Folder</label>
            <button
              type="button"
              disabled
              style={{
                width: '100%', height: 40, display: 'flex', alignItems: 'center',
                gap: 8, padding: '0 12px',
                background: 'var(--koala-bg-secondary)',
                border: '1px solid var(--koala-border-primary)',
                borderRadius: 8, fontSize: 14, lineHeight: '20px',
                color: 'var(--koala-text-tertiary)', cursor: 'not-allowed',
                opacity: 0.6, fontFamily: 'var(--font-family-primary)',
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }} aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 9.776q.168-.026.344-.026h15.812q.176 0 .344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
              </svg>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Unassigned
              </span>
              <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0 }} aria-hidden="true">
                <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="koala-wizard-label">URL</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', display: 'flex',
                alignItems: 'center', color: 'var(--koala-text-tertiary)', zIndex: 1,
                pointerEvents: 'none',
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" />
              </svg>
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article.html"
              style={{
                width: '100%', height: 40, paddingLeft: 40, paddingRight: 12,
                border: '1px solid var(--koala-border-primary)', borderRadius: 8, fontSize: 14,
                lineHeight: '20px', color: 'var(--koala-text-primary)',
                background: 'var(--koala-bg-primary)',
                outline: 'none', fontFamily: 'var(--font-family-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <span
            style={{
              display: 'inline-block', minHeight: 20, paddingTop: 6,
              fontSize: 14, lineHeight: '20px', color: 'var(--koala-text-secondary)',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            Enter the URL from which you&apos;d like to import content into Content Editor
          </span>
        </div>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--koala-border-primary)',
            paddingTop: 24, gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', lineHeight: '32px' }}>
            <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>
              Results for
            </span>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowCountryMenu(!showCountryMenu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 0, fontSize: 14, fontWeight: 600,
                  color: 'var(--koala-text-primary)',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                <Flag code={country} size={20} />
                <span>{countryName}</span>
                <svg viewBox="0 0 20 20" width="20" height="20" style={{ color: 'var(--koala-text-tertiary)' }} aria-hidden="true">
                  <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                </svg>
              </button>
              {showCountryMenu && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    background: 'var(--koala-bg-primary)',
                    border: '1px solid var(--koala-border-primary)',
                    borderRadius: 8, boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                    zIndex: 10, minWidth: 180, overflow: 'hidden',
                  }}
                >
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setCountry(code); setShowCountryMenu(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px',
                        background: code === country ? 'var(--koala-bg-tertiary)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontSize: 14,
                        color: 'var(--koala-text-primary)',
                        fontFamily: 'var(--font-family-primary)', textAlign: 'left',
                      }}
                    >
                      <Flag code={code} size={20} />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </WizardShell>
  );
};

export default ImportPage;
