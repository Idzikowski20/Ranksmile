/* eslint-disable max-len */
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useStaggerReveal } from '../../../lib/motion/useStaggerReveal';
import { useFetchDomains } from '../../../services/domains';
import { useWorkspaces } from '../../../services/workspaces';
import { deriveActiveId, workspaceHref } from '../../../lib/activeWorkspace';
import { writeAnalyzeSession } from '../../../lib/deepAnalysisProgress';
import { buildImportKeywordList } from '../../../lib/buildImportKeywordList';
import { normalizeUrlForMatch, kwScore, buildGscUrlKeywordMap } from '../../../utils/gsc';
import { slugToDomain } from '../../../utils/slugToDomain';
import toast from 'react-hot-toast';
import { Gauge, Checkbox, Toggle, SearchBar, Tabs, SlidePanel, SelectionBar, Skeleton, SortableHeader, CompactSelect, ToolRibbon, Button, DeltaDown, SortUpDown, DataTable, DataTableScroll, DataTableContent, DataTableHeader, DataTableBody, DataTableRow, DataTableEmpty, TableLoadMore, useTableLoadMore } from '../../../components/koala/core';
import { useSortState } from '../../../lib/useSortState';
import ChangeKeywordModal, { GscKeyword } from '../../../components/domains/ChangeKeywordModal';

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

/** Drop trailing " | Brand name" from scraped meta titles so rows stay scannable. */
function displayPageTitle(raw: string): string {
   const t = (raw || '').trim();
   if (!t) return '';
   const idx = t.lastIndexOf(' | ');
   if (idx >= 24) return t.slice(0, idx).trim();
   return t;
}

function absPageUrl(url: string, domainHost: string): string {
   if (/^https?:\/\//i.test(url)) return url;
   return `https://${domainHost}${url.startsWith('/') ? '' : '/'}${url}`;
}

const IMPORT_COUNTRY = 'PL';

function timeAgo(date: string | null | undefined): string {
   if (!date) return 'recently';
   try {
      const ms = Date.now() - new Date(date).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 2) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return `${Math.floor(days / 30)}mo ago`;
   } catch { return 'recently'; }
}

// ── Sliders / filter icon ─────────────────────────────────────────────────────
const SlidersIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75M4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11m.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0zM10 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4m-6.25 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4m12.5 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4" />
   </svg>
);

// ── External link icon ────────────────────────────────────────────────────────
const ExternalLinkIcon = () => (
   <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" style={{ flexShrink: 0 }}>
      <g fillRule="evenodd" clipRule="evenodd">
         <path d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5z" />
         <path d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06" />
      </g>
   </svg>
);

// ── Panel split icon ──────────────────────────────────────────────────────────
const PanelIcon = () => (
   <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M13 17H16.75C17.9926 17 19 15.9926 19 14.75V5.25C19 4.00736 17.9926 3 16.75 3H13V17Z" fill="currentColor" />
      <path d="M11 3.5V16.5H3.25C2.2835 16.5 1.5 15.7165 1.5 14.75V5.25C1.5 4.2835 2.2835 3.5 3.25 3.5H11Z" stroke="currentColor" />
   </svg>
);


// ── Types ─────────────────────────────────────────────────────────────────────
type DomainArticle = {
   id: number | string;
   title: string;
   publish_url?: string | null;
   meta_url?: string | null;
   target_keyword?: string | null;
   content_score?: number;
   status?: string;
   source?: string;
   meta_title?: string | null;
   word_count?: number;
   updated_at?: string | null;
   created_at?: string;
};

type SortKey = 'content_score' | 'position' | 'clicks' | 'impressions';


type RecommRow = {
   id: number | string;
   title: string;
   url: string;
   keyword: string;
   content_score: number;
   position: number;
   clicks: number;
   impressions: number;
   status: string;
   source?: string;
   meta_title?: string | null;
   word_count?: number;
   updatedAt?: string | null;
};


type FilterState = {
   rankDropsOnly: boolean;
   contentScoreMin: string; contentScoreMax: string;
   positionMin: string; positionMax: string;
   trafficMin: string; trafficMax: string;
   impressionsMin: string; impressionsMax: string;
   status: '' | 'not_started' | 'in_progress' | 'done';
};

const DEFAULT_FILTERS: FilterState = {
   rankDropsOnly: false,
   contentScoreMin: '', contentScoreMax: '',
   positionMin: '', positionMax: '',
   trafficMin: '', trafficMax: '',
   impressionsMin: '', impressionsMax: '',
   status: '' };

function countActiveFilters(f: FilterState): number {
   let n = 0;
   if (f.rankDropsOnly) n += 1;
   if (f.contentScoreMin || f.contentScoreMax) n += 1;
   if (f.positionMin || f.positionMax) n += 1;
   if (f.trafficMin || f.trafficMax) n += 1;
   if (f.impressionsMin || f.impressionsMax) n += 1;
   if (f.status) n += 1;
   return n;
}

// ── Filters panel (inside CompactSelect menu) ─────────────────────────────────
function FiltersPanel({ filters, onChange }: {
   filters: FilterState; onChange: (f: FilterState) => void;
}) {
   const set = (key: keyof FilterState, val: FilterState[keyof FilterState]) => onChange({ ...filters, [key]: val });

   const inputStyle: React.CSSProperties = { width: 76, height: 30, padding: '0 8px', border: '1px solid var(--koala-border-primary)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-family-primary)', color: 'var(--koala-text-primary)', outline: 'none', background: 'var(--koala-bg-primary)' };

   const RangeRow = ({ label, minKey, maxKey }: { label: string; minKey: keyof FilterState; maxKey: keyof FilterState }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
         <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" placeholder="Min" value={filters[minKey] as string} onChange={(e) => set(minKey, e.target.value)} style={inputStyle} />
            <span style={{ color: 'var(--koala-border-primary)', fontSize: 12 }}>—</span>
            <input type="number" placeholder="Max" value={filters[maxKey] as string} onChange={(e) => set(maxKey, e.target.value)} style={inputStyle} />
         </div>
      </div>
   );

   return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
         <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <Checkbox checked={filters.rankDropsOnly} onChange={(v) => set('rankDropsOnly', v)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>Rank drops only</span>
         </label>
         <div style={{ height: 1, background: 'var(--koala-bg-secondary)' }} />
         <RangeRow label="Content Score" minKey="contentScoreMin" maxKey="contentScoreMax" />
         <RangeRow label="Position" minKey="positionMin" maxKey="positionMax" />
         <RangeRow label="Clicks" minKey="trafficMin" maxKey="trafficMax" />
         <RangeRow label="Impressions" minKey="impressionsMin" maxKey="impressionsMax" />
         <div style={{ height: 1, background: 'var(--koala-bg-secondary)' }} />
         <CompactSelect
            prefix="Status"
            size="sm"
            options={[
               { value: '', label: 'All' },
               { value: 'not_started', label: 'Not started' },
               { value: 'in_progress', label: 'In progress' },
               { value: 'done', label: 'Done' },
            ]}
            value={filters.status}
            onChange={(opt) => set('status', opt.value as FilterState['status'])}
         />
         <Button type="button" variant="link" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} style={{ alignSelf: 'flex-start', padding: 0 }}>
            Clear all filters
         </Button>
      </div>
   );
}


// ── Main page ─────────────────────────────────────────────────────────────────
const RecommendationsPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData, isLoading: domainsLoading } = useFetchDomains(router, true);
   const { data: wsData } = useWorkspaces();
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);
   const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: DomainType) => d.slug === slug);

   const [tab, setTab] = useState<'optimize' | 'ideas'>('optimize');
   const [search, setSearch] = useState('');
   const [showUrls, setShowUrls] = useState(false);
   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('content_score');
   const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
   const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
   const [panelRow, setPanelRow] = useState<RecommRow | null>(null);
   const [kwModalRow, setKwModalRow] = useState<RecommRow | null>(null);
   const queryClient = useQueryClient();

   const { data: articlesData, isLoading: articlesLoading } = useQuery(
      ['articles', slug],
      async () => {
         const r = await fetch(`/api/articles?domain=${encodeURIComponent(slug)}`);
         return r.json();
      },
      { enabled: !!slug },
   );
   const { data: scData, isLoading: scLoading } = useQuery(
      ['sc-data', slug],
      async () => { const r = await fetch(`/api/gsc/search-data?domain=${slug}`); return r.json(); },
      { enabled: !!slug, staleTime: 5 * 60 * 1000 },
   );
   // Domain-scan recommendations (domain_recommendations). Shares the dashboard/sidebar
   // ['domainRecs', slug] cache so the scan's "pages worth optimizing" stay in sync.
   const { data: recsData } = useQuery(
      ['domainRecs', slug],
      async () => {
         const r = await fetch(`/api/domains/${slug}/recommendations`);
         return r.json() as Promise<{ recommendations: Array<{ id: number; title: string; type: string | null; url: string | null; score: number | null; word_count: number | null }> }>;
      },
      { enabled: !!slug, staleTime: 60_000 },
   );

   const loading = domainsLoading || articlesLoading || scLoading;

   // All GSC keywords for the domain — used in the "Change main keyword" modal
   const allGscKeywords = useMemo<GscKeyword[]>(() => {
      const raw: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      const seen = new Map<string, GscKeyword>();
      raw.forEach((kw) => {
         if (!kw.keyword) return;
         const k = kw.keyword.toLowerCase();
         const ex = seen.get(k);
         const candidate = { keyword: kw.keyword, position: kw.position ?? 0, clicks: kw.clicks ?? 0, impressions: kw.impressions ?? 0 };
         if (!ex || kwScore(candidate) > kwScore(ex)) {
            seen.set(k, candidate);
         }
      });
      return Array.from(seen.values()).sort((a, b) => kwScore(b) - kwScore(a));
   }, [scData]);

   // URL → best keyword map for site_context entries (no target_keyword — match by page URL)
   const urlKeywordMap = useMemo(() => {
      const raw: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      return buildGscUrlKeywordMap(raw);
   }, [scData]);

   // Auto-backfill: extract content_score from score_data + assign GSC keywords
   const backfillRan = useRef<string | null>(null);
   useEffect(() => {
      if (backfillRan.current !== slug) backfillRan.current = null;
      if (backfillRan.current) return;
      const articles: DomainArticle[] = articlesData?.articles || [];
      const hasStaleScores = articles.some((a) => a.content_score === 0 && a.source !== 'site_context');
      const hasMissingKeywords = articles.some((a) => !a.target_keyword && (a.publish_url || a.meta_url));
      if ((hasStaleScores || hasMissingKeywords) && activeDomain?.ID && scData?.data?.thirtyDays?.length > 0) {
         backfillRan.current = slug;
         fetch('/api/articles/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainId: activeDomain.ID }) }).then(() => {
            queryClient.invalidateQueries(['articles', slug]);
         }).catch(() => {});
      }
   }, [articlesData, scData, activeDomain?.ID]);

   const rows = useMemo<RecommRow[]>(() => {
      const articles: DomainArticle[] = articlesData?.articles || [];
      const scMap = new Map<string, GscKeyword>();
      allGscKeywords.forEach((kw) => { scMap.set(kw.keyword.toLowerCase(), kw); });
      return articles.map((a) => {
         let sc: GscKeyword | undefined;
         // Try URL match first (more reliable) — then fall back to keyword match
         if (a.publish_url || a.meta_url) {
            const urlKey = normalizeUrlForMatch(String(a.publish_url || a.meta_url || ''));
            const fromUrl = urlKeywordMap.get(urlKey);
            if (fromUrl) {
               sc = {
                  keyword: fromUrl.keyword,
                  position: fromUrl.position ?? 0,
                  clicks: fromUrl.clicks ?? 0,
                  impressions: fromUrl.impressions ?? 0 };
            }
         }
         if (!sc && a.target_keyword) {
            sc = scMap.get(a.target_keyword.toLowerCase());
         }
         const cs = a.content_score || 0;
         const pos = sc?.position ?? 0;
         return {
            id: a.id,
            title: a.title,
            url: a.publish_url || a.meta_url || '',
            keyword: a.target_keyword || sc?.keyword || '',
            content_score: cs,
            position: pos,
            clicks: sc?.clicks ?? 0,
            impressions: sc?.impressions ?? 0,
            status: a.status || 'not_started',
            source: a.source || 'article',
            meta_title: a.meta_title || null,
            word_count: a.word_count || 0,
            updatedAt: a.updated_at || null };
      });
   }, [articlesData, allGscKeywords, urlKeywordMap]);

   // Pages the domain scan flagged for optimization (type=optimize, with a URL + score),
   // mapped into the Optimize table shape and enriched with GSC stats by URL.
   const auditRows = useMemo<RecommRow[]>(() => {
      const recs = recsData?.recommendations || [];
      return recs
         .filter((r) => r.type === 'optimize' && !!r.url && (r.score ?? 0) > 0)
         .map((r) => {
            const sc = urlKeywordMap.get(normalizeUrlForMatch(r.url || ''));
            return {
               id: `rec_${r.id}`,
               title: r.title,
               url: r.url || '',
               keyword: sc?.keyword || '',
               content_score: r.score ?? 0,
               position: sc?.position ?? 0,
               clicks: sc?.clicks ?? 0,
               impressions: sc?.impressions ?? 0,
               status: 'not_started',
               source: 'audit',
               meta_title: null,
               word_count: r.word_count ?? 0,
               updatedAt: null };
         });
   }, [recsData, urlKeywordMap]);

   // Optimize tab = existing articles + scan-flagged pages, all under 70, deduped by URL.
   const optimizeRows = useMemo(() => {
      const seen = new Set(rows.map((r) => normalizeUrlForMatch(r.url)).filter(Boolean));
      const fromScan = auditRows.filter((a) => a.url && !seen.has(normalizeUrlForMatch(a.url)));
      return [...rows, ...fromScan].filter((r) => r.content_score < 70);
   }, [rows, auditRows]);

   // ── Content gap rows (ideas tab) — GSC keywords not covered by any article ──
   const gapRows = useMemo(() => {
      const coveredKws = new Set(rows.map((r) => r.keyword.toLowerCase()).filter(Boolean));
      return allGscKeywords
         .filter((kw) => kw.impressions > 20 && !coveredKws.has(kw.keyword.toLowerCase()))
         .slice(0, 150);
   }, [allGscKeywords, rows]);


   const filtered = useMemo(() => {
      let out = optimizeRows;
      if (search.trim()) { const q = search.toLowerCase(); out = out.filter((r) => r.title.toLowerCase().includes(q) || r.keyword.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)); }
      if (filters.contentScoreMin) out = out.filter((r) => r.content_score >= Number(filters.contentScoreMin));
      if (filters.contentScoreMax) out = out.filter((r) => r.content_score <= Number(filters.contentScoreMax));
      if (filters.positionMin) out = out.filter((r) => r.position >= Number(filters.positionMin));
      if (filters.positionMax) out = out.filter((r) => r.position <= Number(filters.positionMax));
      if (filters.trafficMin) out = out.filter((r) => r.clicks >= Number(filters.trafficMin));
      if (filters.trafficMax) out = out.filter((r) => r.clicks <= Number(filters.trafficMax));
      if (filters.impressionsMin) out = out.filter((r) => r.impressions >= Number(filters.impressionsMin));
      if (filters.impressionsMax) out = out.filter((r) => r.impressions <= Number(filters.impressionsMax));
      if (filters.status) out = out.filter((r) => r.status === filters.status);
      return [...out].sort((a, b) => { const va = a[sortKey] ?? 0; const vb = b[sortKey] ?? 0; return sortDir === 'desc' ? vb - va : va - vb; });
   }, [optimizeRows, search, filters, sortKey, sortDir]);

   const filteredGapRows = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return gapRows;
      return gapRows.filter((kw) => kw.keyword.toLowerCase().includes(q));
   }, [gapRows, search]);

   const allChecked = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
   const someChecked = filtered.some((r) => selectedIds.has(r.id));
   const toggleAll = () => { const next = new Set(selectedIds); if (allChecked) filtered.forEach((r) => next.delete(r.id)); else filtered.forEach((r) => next.add(r.id)); setSelectedIds(next); };
   const toggleRow = (id: string | number) => { const next = new Set(selectedIds); next.has(id) ? next.delete(id) : next.add(id); setSelectedIds(next); };

   const [analyzingIds, setAnalyzingIds] = useState<Set<string | number>>(new Set());
   const [creatingKw, setCreatingKw] = useState<string | null>(null);
   const [optimizingId, setOptimizingId] = useState<string | number | null>(null);
   // Stagger-reveal table rows (both tabs render `.rec-row`; only the active tab is in the DOM).
   const rowsRef = useStaggerReveal<HTMLDivElement>('.rec-row');
   const scrollRef = useRef<HTMLDivElement>(null);

   const optimizeChunk = useTableLoadMore(filtered, {
      pageSize: 20,
      resetKey: `opt-${sortKey}-${sortDir}-${search}-${filtered.length}-${JSON.stringify(filters)}` });
   const ideasChunk = useTableLoadMore(filteredGapRows, {
      pageSize: 20,
      resetKey: `ideas-${search}-${filteredGapRows.length}` });

   // Optimize → same path as Articles → Import content: scrape URL, startAnalysis, editor + deep analysis.
   const handleOptimize = async (row: RecommRow, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeDomain?.ID) return;

      if (!row.url) {
         if (typeof row.id === 'number') router.push(workspaceHref(wsId, `/articles/${row.id}`));
         return;
      }

      const pageUrl = absPageUrl(row.url, domain);
      const gscRows: SearchAnalyticsItem[] = scData?.data?.thirtyDays || [];
      const { primaryKeyword, keywords } = buildImportKeywordList({
         pageUrl,
         title: row.title,
         userKeywords: row.keyword ? [row.keyword] : [],
         gscRows });
      if (!primaryKeyword && !keywords.length) {
         toast.error('Brak słów kluczowych dla tej strony — ustaw keyword w GSC lub ręcznie.');
         return;
      }

      // Existing article: editor hook runs deep-analysis (avoid duplicate pipeline).
      if (typeof row.id === 'number') {
         writeAnalyzeSession(row.id, { url: pageUrl, keywords, country: IMPORT_COUNTRY });
         void fetch(`/api/articles/${row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'analyzing' }) }).catch(() => {});
         router.push(workspaceHref(wsId, `/articles/${row.id}`));
         return;
      }

      setOptimizingId(row.id);
      try {
         const res = await fetch('/api/articles/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               url: pageUrl,
               keywords,
               country: IMPORT_COUNTRY,
               domainId: activeDomain.ID,
               startAnalysis: true }) });
         const data = await res.json() as { articleId?: number; error?: string };
         if (!res.ok) {
            toast.error(data.error || 'Import failed');
            return;
         }
         const articleId = Number(data.articleId);
         if (!Number.isFinite(articleId)) {
            toast.error('Import succeeded but could not open the editor');
            return;
         }
         writeAnalyzeSession(articleId, { url: pageUrl, keywords, country: IMPORT_COUNTRY });
         await router.push(workspaceHref(wsId, `/articles/${articleId}`));
      } catch {
         toast.error('Import failed');
      } finally {
         setOptimizingId(null);
      }
   };


   const handleCreateArticleForKeyword = async (keyword: string) => {
      if (!activeDomain?.ID || !keyword.trim()) return;
      setCreatingKw(keyword);
      try {
         const res = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               domain_id: activeDomain.ID,
               title: keyword,
               target_keyword: keyword }) });
         const data = await res.json() as { articleId?: number; error?: string };
         if (!res.ok || !data.articleId) {
            toast.error(data.error || 'Could not create article');
            return;
         }
         await router.push(
            workspaceHref(wsId, `/articles/${data.articleId}?from=recommendations&keyword=${encodeURIComponent(keyword)}`),
         );
      } catch {
         toast.error('Could not create article');
      } finally {
         setCreatingKw(null);
      }
   };

   const handleAnalyze = async (row: RecommRow, e: React.MouseEvent) => {
      e.stopPropagation();
      const id = row.id;
      setAnalyzingIds((prev) => new Set(prev).add(id));
      try {
         const body: Record<string, unknown> = {
            url: row.url,
            domainId: activeDomain!.ID,
            // Sidecar requires a keyword in the payload — send the page's main keyword.
            keywords: row.keyword ? [row.keyword] : [] };
         // If it's a real article (not site_context), pass articleId to reuse it
         if (typeof id === 'number' || (typeof id === 'string' && !String(id).startsWith('sc_'))) {
            body.articleId = id;
         }
         const res = await fetch('/api/articles/deep-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body) });
         // This endpoint streams SSE and stays open until the sidecar finishes;
         // fetch() resolves on the headers, so read the stream until the
         // done/error event to keep the spinner up for the whole analysis.
         if (res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            // eslint-disable-next-line no-constant-condition
            while (true) {
               // eslint-disable-next-line no-await-in-loop
               const { done, value } = await reader.read();
               if (done) break;
               buf += decoder.decode(value, { stream: true });
               if (buf.includes('event: done') || buf.includes('event: error')) break;
            }
         }
         // Wait for the refetch so the score + "Updated …" date are fresh before
         // the spinner clears (the open panel re-syncs via the effect below).
         await queryClient.invalidateQueries(['articles', slug]);
      } catch { /* ignore */ }
      setAnalyzingIds((prev) => {
         const next = new Set(prev);
         next.delete(id);
         return next;
      });
   };

   const handleRemoveSelected = async () => {
      const ids = Array.from(selectedIds);
      // Rows come from 3 sources with different delete endpoints:
      //  - `sc_<id>`  → GSC/imported pages in site_context
      //  - `rec_<id>` → audit recommendations in domain_recommendations
      //  - numeric    → real articles
      // (the articles route 403s on a non-numeric id, which is what broke rec_ deletes.)
      await Promise.all(ids.map((id) => {
         const s = String(id);
         let url: string;
         if (s.startsWith('sc_')) url = `/api/site-context/${s.slice(3)}`;
         else if (s.startsWith('rec_')) url = `/api/domains/${encodeURIComponent(slug)}/recommendations?id=${s.slice(4)}`;
         else url = `/api/articles/${id}`;
         return fetch(url, { method: 'DELETE' }).catch(() => {});
      }));
      setSelectedIds(new Set());
      queryClient.invalidateQueries(['articles', slug]);
      queryClient.invalidateQueries(['domainRecs', slug]);
   };

   const handleSaveKeyword = async (newKeyword: string) => {
      if (!kwModalRow) return;
      await fetch(`/api/articles/${kwModalRow.id}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ target_keyword: newKeyword }) });
      // Refresh articles data
      queryClient.invalidateQueries(['articles', slug]);
   };

   // Keep the open detail panel in sync after a re-analysis (refreshes score + date).
   useEffect(() => {
      if (!panelRow) return;
      const fresh = rows.find((r) => String(r.id) === String(panelRow.id));
      if (fresh && (fresh.content_score !== panelRow.content_score || fresh.updatedAt !== panelRow.updatedAt)) {
         setPanelRow(fresh);
      }
   }, [rows, panelRow]);

   const activeFilterCount = countActiveFilters(filters);

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head><title>{`Recommendations — ${domain} — Ranksmile`}</title></Head>

         <DomainSubLayout
            domain={domain}
            slug={slug || ''}
            section="Recommendations"
            heading="Recommendations"
            subtitle="Pages and keywords worth optimizing for this site"
            contentMaxWidth="100%"
            fillHeight
            filters={(
               <ToolRibbon className="rec-tool-ribbon">
                  <Tabs
                     items={[
                        { value: 'optimize', label: 'Optimize', count: optimizeRows.length },
                        { value: 'ideas', label: 'Content Ideas', count: gapRows.length },
                     ]}
                     value={tab}
                     onChange={(v) => setTab(v as 'optimize' | 'ideas')}
                  />
                  <div className="rec-tool-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
                     <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                        <Toggle checked={showUrls} onChange={() => setShowUrls((v) => !v)} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>Show URLs</span>
                     </label>
                     <CompactSelect
                        size="sm"
                        options={[]}
                        hideOptions
                        menuTitle="Filters"
                        menuWidth={300}
                        triggerLabel={(
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <SlidersIcon />
                              Filters
                              {activeFilterCount > 0 && (
                                 <span className="koala-compact-select-badge">{activeFilterCount}</span>
                              )}
                           </span>
                        )}
                        menuBody={<FiltersPanel filters={filters} onChange={setFilters} />}
                     />
                     <SearchBar value={search} onChange={setSearch} placeholder="Search" width={250} />
                  </div>
               </ToolRibbon>
            )}
         >
            <DataTable ref={rowsRef}>
            <DataTableScroll ref={scrollRef}>
               {/* ── Content Ideas tab — content gap from GSC ── */}
               {tab === 'ideas' && (
                  <DataTableContent minWidth={560} aria-label="Content ideas">
                     <DataTableHeader>
                        <div style={{ padding: '8px 16px', flex: '1 1 0', minWidth: 160, fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--koala-text-secondary, #575757)', fontFamily: 'var(--font-family-primary)' }}>Keyword (not yet covered)</div>
                        <div style={{ padding: '8px 16px', width: 120, flexShrink: 0, textAlign: 'right', fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--koala-text-secondary, #575757)', fontFamily: 'var(--font-family-primary)' }}>Impressions</div>
                        <div style={{ padding: '8px 16px', width: 120, flexShrink: 0, textAlign: 'right', fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--koala-text-secondary, #575757)', fontFamily: 'var(--font-family-primary)' }}>Avg Position</div>
                        <div style={{ padding: '8px 16px', width: 120, flexShrink: 0, textAlign: 'right', fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px', color: 'var(--koala-text-secondary, #575757)', fontFamily: 'var(--font-family-primary)' }}>Action</div>
                     </DataTableHeader>
                     {loading ? (
                        <DataTableBody><Skeleton /></DataTableBody>
                     ) : filteredGapRows.length === 0 ? (
                        <DataTableEmpty>
                           No content gaps found — all GSC keywords already have articles.
                        </DataTableEmpty>
                     ) : (
                        <DataTableBody>
                           {ideasChunk.visibleItems.map((kw) => (
                              <DataTableRow key={kw.keyword} className="rec-row" style={{ minHeight: 56, alignItems: 'center' }}>
                                 <div style={{ padding: '10px 16px', flex: '1 1 0', minWidth: 160 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>{kw.keyword}</span>
                                 </div>
                                 <div style={{ padding: '10px 16px', width: 120, flexShrink: 0, textAlign: 'right', fontSize: 13, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                                    {compactNum(kw.impressions)}
                                 </div>
                                 <div style={{ padding: '10px 16px', width: 120, flexShrink: 0, textAlign: 'right', fontSize: 13, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                                    {kw.position > 0 ? kw.position.toFixed(1) : '—'}
                                 </div>
                                 <div style={{ padding: '10px 16px', width: 120, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button type="button" variant="secondary" size="xs" disabled={creatingKw === kw.keyword} onClick={() => handleCreateArticleForKeyword(kw.keyword)}>
                                       {creatingKw === kw.keyword ? '…' : '+ Create'}
                                    </Button>
                                 </div>
                              </DataTableRow>
                           ))}
                           <TableLoadMore hasMore={ideasChunk.hasMore} isLoading={ideasChunk.isLoading} onLoadMore={ideasChunk.loadMore} scrollRootRef={scrollRef} />
                        </DataTableBody>
                     )}
                  </DataTableContent>
               )}


               {/* ── Optimize tab ── */}
               {tab === 'optimize' && (
                  <DataTableContent minWidth={780} aria-label="Optimize recommendations">
                     <DataTableHeader>
                        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                           <Checkbox checked={someChecked && !allChecked ? 'indeterminate' : allChecked} onChange={toggleAll} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', flex: '1 1 0', minWidth: 200, overflow: 'hidden' }}>
                           <Button type="button" variant="transparent" size="sm" onClick={() => handleSort('content_score')} style={{ gap: 4, padding: 0, color: 'var(--koala-text-secondary, #575757)' }}>
                              <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px' }}>Page</span>
                              <SortUpDown active={false} dir={null} />
                           </Button>
                           <span style={{ color: 'var(--koala-border-primary, #e5e5e5)', lineHeight: '1rem' }}>/</span>
                           <Button type="button" variant="transparent" size="sm" style={{ gap: 4, padding: 0, color: 'var(--koala-text-secondary, #575757)' }}>
                              <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.4px' }}>Main keyword</span>
                              <SortUpDown active={false} dir={null} />
                           </Button>
                        </div>
                        <SortableHeader label="Content Score" sortKey="content_score" activeKey={sortKey} dir={sortDir} width={154} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Clicks" sortKey="clicks" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Impr." sortKey="impressions" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                     </DataTableHeader>

                     {loading ? (
                        <DataTableBody><Skeleton /></DataTableBody>
                     ) : filtered.length === 0 ? (
                        <DataTableEmpty>No pages need optimization. Great job!</DataTableEmpty>
                     ) : (
                        <DataTableBody>
                           {optimizeChunk.visibleItems.map((row) => {
                              const isSelected = selectedIds.has(row.id);
                              return (
                                 <DataTableRow
                                    key={row.id}
                                    className="rec-row"
                                    selected={isSelected}
                                    style={{ minHeight: 72 }}
                                 >
                                    <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 1 }}>
                                       <Checkbox checked={isSelected} onChange={() => toggleRow(row.id)} />
                                    </div>

                                    <div
                                       style={{ position: 'relative', flex: '1 1 0', minWidth: 200, overflow: 'hidden', padding: '12px 16px', cursor: 'pointer' }}
                                       onClick={() => setPanelRow(row)}
                                    >
                                       <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                          <span
                                             title={row.title}
                                             style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                          >
                                             {displayPageTitle(row.title)}
                                          </span>
                                          <Button type="button" variant="link" size="xs" className="kw-btn" title="Change main keyword" onClick={(e) => { e.stopPropagation(); setKwModalRow(row); }} icon={(
                                             <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" style={{ flexShrink: 0, color: 'var(--koala-text-tertiary)' }} className="kw-btn-icon">
                                                <g><path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" /></g>
                                             </svg>
                                          )} style={{ alignSelf: 'flex-start', maxWidth: '100%', padding: 0 }}>
                                             <span className="kw-btn-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{row.keyword || 'Set keyword'}</span>
                                          </Button>
                                          {showUrls && row.url && (
                                             <span style={{ fontSize: 11, color: 'var(--koala-text-tertiary)', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                {row.url}
                                             </span>
                                          )}
                                       </div>

                                       <div className="row-actions" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 0 32px', flexShrink: 0, opacity: 0, transition: 'opacity 150ms ease', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, var(--koala-bg-primary) 28%)' }}>
                                          {row.url && (
                                             <a href={row.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', color: 'var(--koala-text-secondary)', textDecoration: 'none' }}>
                                                <ExternalLinkIcon />
                                             </a>
                                          )}
                                          <Button type="button" variant="transparent" size="sm" onClick={(e) => { e.stopPropagation(); setPanelRow(row); }} icon={<PanelIcon />} style={{ padding: 0, color: 'var(--koala-text-secondary)' }} aria-label="Open panel" />
                                          <Button type="button" variant="secondary" size="xs" disabled={optimizingId === row.id} onClick={(e) => handleOptimize(row, e)}>
                                             {optimizingId === row.id ? 'Optimizing…' : 'Optimize'}
                                          </Button>
                                       </div>
                                    </div>

                                    <div style={{ width: 154, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px' }}>
                                       {row.content_score > 0 ? (
                                          <div style={{ cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                             <Gauge score={row.content_score} size="sm" />
                                          </div>
                                       ) : analyzingIds.has(row.id) ? (
                                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--koala-text-tertiary)', fontFamily: 'var(--font-family-primary)' }}>Analyzing…</span>
                                       ) : (
                                          <Button type="button" variant="secondary" size="xs" className="analyze-btn" onClick={(e) => handleAnalyze(row, e)}>
                                             Analyze
                                          </Button>
                                       )}
                                    </div>

                                    <div style={{ width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {row.position > 0 && <DeltaDown />}
                                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                                             {row.position > 0 ? row.position.toFixed(1) : '—'}
                                          </span>
                                       </div>
                                    </div>

                                    <div style={{ width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {row.clicks > 0 && <DeltaDown />}
                                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                                             {row.clicks > 0 ? compactNum(row.clicks) : '0'}
                                          </span>
                                       </div>
                                    </div>

                                    <div style={{ width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {row.impressions > 0 && <DeltaDown />}
                                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
                                             {row.impressions > 0 ? compactNum(row.impressions) : '—'}
                                          </span>
                                       </div>
                                    </div>
                                 </DataTableRow>
                              );
                           })}
                           <TableLoadMore hasMore={optimizeChunk.hasMore} isLoading={optimizeChunk.isLoading} onLoadMore={optimizeChunk.loadMore} scrollRootRef={scrollRef} />
                        </DataTableBody>
                     )}
                  </DataTableContent>
               )}
            </DataTableScroll>
            </DataTable>
         </DomainSubLayout>

         <SlidePanel
            row={panelRow}
            onClose={() => setPanelRow(null)}
            onRefresh={handleAnalyze}
            onChangeKeyword={(row) => { setPanelRow(null); setKwModalRow(row); }}
            analyzing={panelRow ? analyzingIds.has(panelRow.id) : false}
         />
         {selectedIds.size > 0 && <SelectionBar count={selectedIds.size} onRemove={handleRemoveSelected} onClear={() => setSelectedIds(new Set())} />}
         {kwModalRow && (
            <ChangeKeywordModal
               article={{ id: kwModalRow.id, title: kwModalRow.title, url: kwModalRow.url, keyword: kwModalRow.keyword }}
               allKeywords={allGscKeywords}
               onClose={() => setKwModalRow(null)}
               onSave={handleSaveKeyword}
            />
         )}

         <style dangerouslySetInnerHTML={{ __html: `
            .rec-row:hover { background: var(--koala-bg-secondary) !important; }
            .rec-row:hover .row-actions { opacity: 1 !important; background: linear-gradient(90deg, rgba(250,250,250,0) 0%, var(--koala-bg-secondary) 28%) !important; }
            .rec-row:hover .kw-btn-text { text-decoration-color: var(--koala-border-primary) !important; }
            .rec-row:hover .kw-btn-icon { opacity: 1 !important; }
            .rec-row:hover .analyze-btn { opacity: 1 !important; }
            .kw-row:hover { background: rgba(242,153,100,0.03) !important; }
            @keyframes growOut { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            @keyframes barSlideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
            @keyframes spin { to { transform: rotate(360deg); } }
         ` }} />
      </AppShell>
   );
};

export default RecommendationsPage;
