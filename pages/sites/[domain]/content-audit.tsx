import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import EmptyEyes from '../../../components/common/EmptyEyes';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { SentryPanel } from '../../../components/sentry-pages';
import { useStaggerReveal } from '../../../lib/motion/useStaggerReveal';
import { Gauge, Button, Badge, Checkbox, Toggle, SearchBar, SortableHeader, Skeleton, SlidePanel, ToolRibbon } from '../../../components/core';
import { useSortState } from '../../../lib/useSortState';
import { useFetchDomains } from '../../../services/domains';
import { useWorkspaces } from '../../../services/workspaces';
import { deriveActiveId } from '../../../lib/activeWorkspace';
import { useTrafficAlerts } from '../../../lib/useTrafficAlerts';
import { slugToDomain } from '../../../utils/slugToDomain';
import { kwScore } from '../../../utils/gsc';
import AddPagesModal, { AvailablePage } from '../../../components/domains/AddPagesModal';
import ChangeKeywordModal, { GscKeyword } from '../../../components/domains/ChangeKeywordModal';
import { computePortfolioPruning } from '../../../lib/contentEffort';

// Normalize a full URL or path down to its pathname (e.g. "https://x.pl/blog/" -> "/blog").
function toPath(url: string): string {
   if (!url) return '';
   try {
      const p = (url.startsWith('http') ? new URL(url).pathname : url).replace(/\/+$/, '');
      return p === '' ? '/' : p;
   } catch { return url; }
}

const StatusBadge = ({ status }: { status: string }) => {
   const variant = status === 'published' ? 'success' : status === 'draft' || status === 'review' || status === 'analyzing' ? 'muted' : status === 'error' ? 'danger' : 'muted';
   const label = status === 'review' || status === 'analyzing' ? status.charAt(0).toUpperCase() + status.slice(1) : status.charAt(0).toUpperCase() + status.slice(1);
   return <Badge variant={variant}>{label}</Badge>;
};

const FONT = 'var(--font-family-primary)';

type PendingStatus = 'processing' | 'done' | 'error';
type PendingPage = { path: string; url: string; keyword: string; clicks: number; impressions: number; status: PendingStatus };

const Spinner = ({ size = 16 }: { size?: number }) => (
   <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, animation: 'spin 0.7s linear infinite', color: 'var(--color-content-secondary)' }}>
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
   </svg>
);

const ProcessingPill = ({ status }: { status: PendingStatus }) => {
   const map: Record<PendingStatus, { bg: string; color: string; label: string }> = {
      processing: { bg: '#FFFBEB', color: '#B45309', label: 'Processing' },
      done: { bg: '#F0FDF4', color: '#15803D', label: 'Analyzed' },
      error: { bg: '#FEF2F2', color: '#DC2626', label: 'Failed' },
   };
   const s = map[status];
   return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, fontFamily: FONT }}>
         {status === 'processing' && <Spinner size={11} />}{s.label}
      </span>
   );
};

const CELL_FONT = { fontFamily: FONT, fontSize: 13, color: '#09090B' };
const CELL_MUTED = { fontFamily: FONT, fontSize: 13, color: '#9F9FA9' };

type DomainArticle = {
   id: number | string;
   title: string;
   publish_url?: string | null;
   meta_url?: string | null;
   target_keyword?: string | null;
   content_score?: number;
   status?: string;
   created_at?: string;
   updated_at?: string;
};

type AuditRow = {
   id: number | string; title: string; url: string; keyword: string;
   content_score: number; position: number; clicks: number; impressions: number;
   status: string; created_at?: string; updatedAt?: string;
};

const PencilIcon = () => (
   <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" style={{ flexShrink: 0 }}>
      <g><path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" /></g>
   </svg>
);

const ExternalLinkIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
      <g fillRule="evenodd" clipRule="evenodd"><path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" /><path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" /></g>
   </svg>
);

const PanelIcon = () => (
   <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M13 17H16.75C17.9926 17 19 15.9926 19 14.75V5.25C19 4.00736 17.9926 3 16.75 3H13V17Z" fill="currentColor" />
      <path d="M11 3.5V16.5H3.25C2.2835 16.5 1.5 15.7165 1.5 14.75V5.25C1.5 4.2835 2.2835 3.5 3.25 3.5H11Z" stroke="currentColor" />
   </svg>
);

type SortKey = 'content_score' | 'position' | 'clicks' | 'impressions' | 'title';

const ContentAuditPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d) => d.slug === slug);

   // GSC weekly drop alerts → "Traffic drop" badge on pages that lost ranking this week.
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);
   const { data: wsData } = useWorkspaces();
   const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
   const { droppedPaths } = useTrafficAlerts(wsId);

   const [search, setSearch] = useState('');
   const [showUrls, setShowUrls] = useState(false);
   const [selected, setSelected] = useState<Set<string | number>>(new Set());
   const [addOpen, setAddOpen] = useState(false);
   const [pending, setPending] = useState<PendingPage[]>([]);
   const [panelRow, setPanelRow] = useState<AuditRow | null>(null);
   const [kwModalRow, setKwModalRow] = useState<AuditRow | null>(null);
   const [retryingIds, setRetryingIds] = useState<Set<string | number>>(new Set());
   // Stagger-reveal the article rows (`.audit-row`) as they scroll into view.
   const rowsRef = useStaggerReveal<HTMLDivElement>('.audit-row');
   const queryClient = useQueryClient();

   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('content_score');

   const { data: articlesData, isLoading } = useQuery(
      ['articles', activeDomain?.ID],
      async () => {
         const res = await fetch(`/api/articles?domainId=${activeDomain!.ID}`);
         return res.json();
      },
      { enabled: !!activeDomain?.ID },
   );

   const { data: scData } = useQuery(
      ['sc-data', slug],
      async () => {
         const res = await fetch(`/api/searchconsole?domain=${slug}`);
         return res.json();
      },
      { enabled: !!slug, staleTime: 5 * 60 * 1000 },
   );

   const rows = useMemo(() => {
      const articles: DomainArticle[] = articlesData?.articles || [];
      const scItems: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      // Aggregate the last-30-days GSC data per PAGE (not per target keyword): a page
      // ranks for many queries, so clicks/impressions are summed across all of them and
      // position is an impression-weighted average. Matching by keyword missed every page
      // whose target_keyword didn't exactly equal a GSC query → "—" everywhere.
      const pageMetrics = new Map<string, { clicks: number; impressions: number; posWeight: number }>();
      scItems.forEach((it) => {
         if (!it.page) return;
         const path = toPath(it.page);
         if (!path) return;
         const e = pageMetrics.get(path) || { clicks: 0, impressions: 0, posWeight: 0 };
         const imp = it.impressions || 0;
         e.clicks += it.clicks || 0;
         e.impressions += imp;
         e.posWeight += (it.position || 0) * imp;
         pageMetrics.set(path, e);
      });
      return articles.map((a) => {
         const url = a.publish_url || a.meta_url || '';
         const m = url ? pageMetrics.get(toPath(url)) : undefined;
         return {
            id: a.id,
            title: a.title,
            url,
            keyword: a.target_keyword || '',
            content_score: a.content_score || 0,
            position: m && m.impressions > 0 ? m.posWeight / m.impressions : 0,
            clicks: m?.clicks ?? 0,
            impressions: m?.impressions ?? 0,
            status: a.status || '',
            created_at: a.created_at,
            updatedAt: a.updated_at || a.created_at,
         };
      });
   }, [articlesData, scData]);

   // GSC pages available to add (page-level, excluding already-tracked & pending). Carries the
   // page's full URL + top-performing query, used to kick off the sidecar analysis on add.
   const availablePages = useMemo<(AvailablePage & { url: string; keyword: string })[]>(() => {
      const items: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      const exclude = new Set([
         ...rows.map((r) => toPath(r.url)),
         ...pending.map((p) => p.path),
      ].filter(Boolean));
      const map = new Map<string, { clicks: number; impressions: number; url: string; keyword: string; best: number }>();
      items.forEach((it) => {
         if (!it.page) return;
         const path = toPath(it.page);
         if (!path || exclude.has(path)) return;
         const e = map.get(path) || { clicks: 0, impressions: 0, url: it.page, keyword: it.keyword || '', best: -1 };
         e.clicks += it.clicks || 0;
         e.impressions += it.impressions || 0;
         const score = (it.clicks || 0) * 10 + (it.impressions || 0);
         if (score > e.best) { e.best = score; e.keyword = it.keyword || e.keyword; e.url = it.page; }
         map.set(path, e);
      });
      return [...map.entries()].map(([path, v]) => ({ path, clicks: v.clicks, impressions: v.impressions, url: v.url, keyword: v.keyword }));
   }, [scData, rows, pending]);

   const absUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${domain}${u.startsWith('/') ? '' : '/'}${u}`);

   // POST the sidecar deep-analysis and read the SSE stream to completion. Resolves to whether it errored.
   const streamDeepAnalysis = async (opts: { url: string; keyword: string; articleId?: number | string }): Promise<boolean> => {
      const body: Record<string, unknown> = { url: opts.url, domainId: activeDomain?.ID, keywords: opts.keyword ? [opts.keyword] : [] };
      if (opts.articleId !== undefined) body.articleId = opts.articleId;
      const res = await fetch('/api/articles/deep-analysis', {
         method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      let errored = !res.ok;
      if (res.body) {
         const reader = res.body.getReader();
         const decoder = new TextDecoder();
         let buf = '';
         // eslint-disable-next-line no-constant-condition
         while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            if (buf.includes('event: done') || buf.includes('event: error')) break;
         }
         errored = buf.includes('event: error');
      }
      return errored;
   };

   // Background analysis for a freshly-added page; once it resolves the real article row takes over.
   const runAnalysis = async (p: { path: string; url: string; keyword: string }) => {
      try {
         await streamDeepAnalysis({ url: absUrl(p.url || p.path), keyword: p.keyword });
         await queryClient.invalidateQueries(['articles', activeDomain?.ID]);
         setPending((prev) => prev.filter((x) => x.path !== p.path));
      } catch {
         setPending((prev) => prev.map((x) => (x.path === p.path ? { ...x, status: 'error' } : x)));
      }
   };

   // Re-run analysis for an article whose previous import failed (status === 'error').
   const handleRetry = async (row: AuditRow) => {
      setRetryingIds((prev) => new Set(prev).add(row.id));
      try {
         await streamDeepAnalysis({ url: absUrl(row.url), keyword: row.keyword, articleId: row.id });
      } catch { /* final status is reflected by the refetched article */ } finally {
         setRetryingIds((prev) => { const n = new Set(prev); n.delete(row.id); return n; });
         queryClient.invalidateQueries(['articles', activeDomain?.ID]);
      }
   };

   const handleAddPages = (paths: string[]) => {
      setAddOpen(false);
      const picked = availablePages.filter((p) => paths.includes(p.path));
      setPending((prev) => {
         const seen = new Set(prev.map((p) => p.path));
         const added: PendingPage[] = picked
            .filter((p) => !seen.has(p.path))
            .map((p) => ({ path: p.path, url: p.url, keyword: p.keyword, clicks: p.clicks, impressions: p.impressions, status: 'processing' }));
         return [...added, ...prev];
      });
      picked.forEach((p) => runAnalysis(p));
   };

   // All GSC keywords for the domain — used by the "Change main keyword" modal.
   const allGscKeywords = useMemo<GscKeyword[]>(() => {
      const raw: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      const seen = new Map<string, GscKeyword>();
      raw.forEach((kw) => {
         if (!kw.keyword) return;
         const k = kw.keyword.toLowerCase();
         const ex = seen.get(k);
         const candidate = { keyword: kw.keyword, position: kw.position ?? 0, clicks: kw.clicks ?? 0, impressions: kw.impressions ?? 0 };
         if (!ex || kwScore(candidate) > kwScore(ex)) seen.set(k, candidate);
      });
      return Array.from(seen.values()).sort((a, b) => kwScore(b) - kwScore(a));
   }, [scData]);

   const handleSaveKeyword = async (newKeyword: string) => {
      if (!kwModalRow) return;
      await fetch(`/api/articles/${kwModalRow.id}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ target_keyword: newKeyword }),
      });
      queryClient.invalidateQueries(['articles', activeDomain?.ID]);
   };

   const filtered = useMemo(() => {
      let out = rows;
      if (search.trim()) {
         const q = search.toLowerCase();
         out = out.filter((r) => r.title.toLowerCase().includes(q) || r.keyword.toLowerCase().includes(q));
      }
      out = [...out].sort((a, b) => {
         const va = a[sortKey] ?? 0;
         const vb = b[sortKey] ?? 0;
         if (typeof va === 'string' && typeof vb === 'string') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
         return sortDir === 'desc' ? Number(vb) - Number(va) : Number(va) - Number(vb);
      });
      return out;
   }, [rows, search, sortKey, sortDir]);

   const portfolioInsight = useMemo(
      () => computePortfolioPruning(rows.map((r) => ({
         id: r.id,
         title: r.title,
         url: r.url,
         content_score: r.content_score,
         clicks: r.clicks,
         impressions: r.impressions,
         created_at: r.created_at,
      }))),
      [rows],
   );

   const toggleSelect = (id: string | number) => {
      setSelected((prev) => {
         const n = new Set(prev);
         n.has(id) ? n.delete(id) : n.add(id);
         return n;
      });
   };

   const toggleAll = () => {
      if (selected.size === filtered.length) setSelected(new Set());
      else setSelected(new Set(filtered.map((r) => r.id)));
   };

   const exportCSV = () => {
      const headers = ['Title', 'Keyword', 'URL', 'Content Score', 'Position', 'Traffic', 'Impressions', 'Status'];
      const rows2 = filtered.map((r) => [r.title, r.keyword, r.url, r.content_score, r.position || '', r.clicks || '', r.impressions || '', r.status]);
      const csv = [headers, ...rows2].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `content-audit-${domain}.csv`;
      a.click();
   };

   // GSC data window — 30-day span ending ~3 days back (matches Search Console's reporting lag).
   const dataRangeLabel = useMemo(() => {
      const end = new Date(); end.setDate(end.getDate() - 3);
      const start = new Date(end); start.setDate(start.getDate() - 29);
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(start)} - ${fmt(end)}`;
   }, []);

   const actions = (
      <>
         <Button variant="secondary" onClick={exportCSV}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
         </Button>
         <Button variant="primary" onClick={() => setAddOpen(true)}>
            + Add Page
         </Button>
      </>
   );

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Content Audit — ${domain} — SerpBear`}</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Content Audit" heading="Content Audit" actions={actions} contentMaxWidth="100%"
            filters={(
               <ToolRibbon>
                  <span style={{ fontSize: 14, color: '#71717B', fontFamily: FONT }}>Data for {dataRangeLabel}.</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: FONT }}>
                        <Toggle checked={showUrls} onChange={() => setShowUrls((v) => !v)} />
                        Show URLs
                     </label>
                     <SearchBar value={search} onChange={setSearch} placeholder="Search" width={200} />
                  </div>
               </ToolRibbon>
            )}
         >
            {(portfolioInsight.warning || portfolioInsight.pruneCandidates.length > 0) && (
               <div style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #dad9de',
                  background: '#fff',
                  fontFamily: FONT,
               }}
               >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                     <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>Portfolio quality</span>
                     <span style={{ fontSize: 12, color: '#71717B' }}>
                        avg score {portfolioInsight.avgScore}
                        {portfolioInsight.scoreStdDev > 0 ? ` · spread ±${portfolioInsight.scoreStdDev}` : ''}
                     </span>
                  </div>
                  {portfolioInsight.warning && (
                     <p style={{ margin: '0 0 10px', fontSize: 13, color: '#B45309', lineHeight: 1.45 }}>
                        {portfolioInsight.warning}
                     </p>
                  )}
                  {portfolioInsight.pruneCandidates.length > 0 && (
                     <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#52525C', marginBottom: 6 }}>
                           Prune / rewrite candidates ({portfolioInsight.pruneCandidates.length})
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                           {portfolioInsight.pruneCandidates.slice(0, 8).map((c) => (
                              <li key={String(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                 <span style={{
                                    flexShrink: 0,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 9999,
                                    background: c.severity === 'high' ? '#FEF2F2' : '#FFFBEB',
                                    color: c.severity === 'high' ? '#B91C1C' : '#B45309',
                                 }}
                                 >
                                    {c.severity === 'high' ? 'Prune' : 'Rewrite'}
                                 </span>
                                 <Link href={`/articles/${c.id}`} style={{ color: '#18181B', fontWeight: 500, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.title || c.url}
                                 </Link>
                                 <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#9F9FA9', fontVariantNumeric: 'tabular-nums' }}>
                                    score {c.content_score} · {c.clicks} clicks
                                 </span>
                              </li>
                           ))}
                        </ul>
                     </div>
                  )}
               </div>
            )}
            <SentryPanel noPadding>
            <div ref={rowsRef} style={{ overflow: 'hidden' }}>
               {/* Header */}
               <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5' }}>
                  {/* Checkbox */}
                  <div style={{ padding: '10px 12px', borderRight: '1px solid #F4F4F5' }}>
                     <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </div>
                  <div style={{ padding: '10px 12px', flexGrow: 1, minWidth: 256, display: 'flex', gap: 8 }}>
                     <span style={{ fontSize: 12, color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Page</span>
                     <span style={{ color: '#D4D4D8', fontSize: 12 }}>/</span>
                     <span style={{ fontSize: 12, color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Main keyword</span>
                  </div>
                  <SortableHeader label="Content Score" sortKey="content_score" activeKey={sortKey} dir={sortDir} width={150} onSort={(k) => handleSort(k as SortKey)} />
                  <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                  <SortableHeader label="Traffic" sortKey="clicks" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                  <SortableHeader label="Impr." sortKey="impressions" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
               </div>

               {/* Pages added from the "Add pages" panel — analyzed in the background by the sidecar */}
               {pending.map((p) => (
                  <div key={`pending-${p.path}`} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #F4F4F5', minHeight: 64, background: '#FCFCFD' }}>
                     <div style={{ padding: '12px', borderRight: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44 }}>
                        {p.status === 'processing' ? <Spinner /> : <span style={{ width: 16, height: 16 }} />}
                     </div>
                     <div style={{ padding: '12px', flexGrow: 1, minWidth: 256, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <span style={{ fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
                           <ProcessingPill status={p.status} />
                        </div>
                        {p.keyword && <span style={{ fontSize: 12, color: '#71717B', fontFamily: FONT }}>{p.keyword}</span>}
                     </div>
                     <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', width: 150, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {p.status === 'processing' ? <Spinner /> : <span style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>—</span>}
                     </div>
                     <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, color: '#9F9FA9', fontFamily: FONT }}>—</div>
                     <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: FONT }}>{p.clicks > 0 ? p.clicks : '—'}</div>
                     <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: FONT }}>{p.impressions > 0 ? p.impressions : '—'}</div>
                  </div>
               ))}
               {isLoading ? (
                  <Skeleton />
               ) : filtered.length === 0 ? (
                  pending.length === 0 ? (
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '80px 24px 48px', textAlign: 'center' }}>
                        <EmptyEyes />
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>You haven&apos;t added any pages yet</span>
                        <p style={{ margin: 0, maxWidth: 408, color: '#3F3F47', fontSize: 14, lineHeight: '20px', fontFamily: FONT }}>Add existing pages you want to audit, get recommendations, and keep an eye out for. Modify anytime.</p>
                        <Button variant="primary" onClick={() => setAddOpen(true)}>
                           Add Page
                        </Button>
                     </div>
                  ) : null
               ) : (
                  filtered.map((row, i) => (
                     <div
                        key={row.id}
                        style={{
                           display: 'flex', alignItems: 'center',
                           borderBottom: i < filtered.length - 1 ? '1px solid #F4F4F5' : 'none',
                           minHeight: 64,
                           background: selected.has(row.id) ? '#FAFAF5' : 'transparent',
                           transition: 'background 0.1s',
                        }}
                        className="audit-row"
                     >
                        <div style={{ padding: '12px', borderRight: '1px solid #F4F4F5' }}>
                           <Checkbox checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                        </div>
                        <div style={{ padding: '12px', flexGrow: 1, minWidth: 256, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, overflow: 'hidden' }}>
                           <div onClick={() => setPanelRow(row)} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                 <span style={{ fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.title}
                                 </span>
                                 <StatusBadge status={row.status} />
                                 {row.url && droppedPaths.has(toPath(row.url)) && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 9999, padding: '1px 8px', whiteSpace: 'nowrap', fontFamily: FONT }}>Traffic drop</span>
                                 )}
                              </div>
                              {row.keyword ? (
                                 <Button type="button" variant="link" size="xs" className="ca-kw-btn" title="Change main keyword" onClick={(e) => { e.stopPropagation(); setKwModalRow(row); }} icon={<PencilIcon />} style={{ alignSelf: 'flex-start', maxWidth: '100%', padding: 0, color: '#71717B' }}>
                                    <span className="ca-kw-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.keyword}</span>
                                 </Button>
                              ) : (
                                 <Button type="button" variant="link" size="xs" title="Add keyword" onClick={(e) => { e.stopPropagation(); setKwModalRow(row); }} style={{ alignSelf: 'flex-start', padding: 0 }}>
                                    + Add keyword
                                 </Button>
                              )}
                              {showUrls && row.url && <span style={{ fontSize: 11, color: '#9F9FA9', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.url}</span>}
                           </div>
                           <div>
                              {row.status === 'error' ? (
                                 <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleRetry(row); }}
                                    disabled={retryingIds.has(row.id)}
                                 >
                                    {retryingIds.has(row.id) ? <><Spinner size={12} /> Retrying…</> : 'Retry'}
                                 </Button>
                              ) : (
                                 <Link href={`/articles/${row.id}`} legacyBehavior passHref>
                                    <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
                                       Optimize
                                    </Button>
                                 </Link>
                              )}
                           </div>
                        </div>
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', width: 150, display: 'flex', justifyContent: 'flex-end' }}>
                           <Gauge score={row.content_score} size="sm" />
                        </div>
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.position > 0 ? row.position.toFixed(1) : '—'}
                        </div>
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.clicks > 0 ? row.clicks : '—'}
                        </div>
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.impressions > 0 ? row.impressions : '—'}
                        </div>
                     </div>
                  ))
               )}
            </div>
            </SentryPanel>

            <style dangerouslySetInnerHTML={{ __html: `
               .audit-row:hover { background: #F8F8F9 !important; }
               .addpage-row:hover { background: #F8F8F9 !important; }
               .audit-row:hover .ca-row-actions { opacity: 1 !important; }
               .ca-kw-btn:hover .ca-kw-text { text-decoration-color: #D4D4D8 !important; }
            ` }} />

            <SlidePanel
               row={panelRow}
               onClose={() => setPanelRow(null)}
               onChangeKeyword={(r) => { setPanelRow(null); setKwModalRow(r as AuditRow); }}
            />

            {kwModalRow && (
               <ChangeKeywordModal
                  article={{ id: kwModalRow.id, title: kwModalRow.title, url: kwModalRow.url, keyword: kwModalRow.keyword }}
                  allKeywords={allGscKeywords}
                  onClose={() => setKwModalRow(null)}
                  onSave={handleSaveKeyword}
               />
            )}

            {addOpen && (
               <AddPagesModal
                  pages={availablePages}
                  onClose={() => setAddOpen(false)}
                  onAdd={handleAddPages}
               />
            )}
         </DomainSubLayout>
      </AppShell>
   );
};

export default ContentAuditPage;
