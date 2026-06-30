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
import { normalizeUrlForMatch, kwScore } from '../../../utils/gsc';
import { slugToDomain } from '../../../utils/slugToDomain';
import { Gauge, Checkbox, Toggle, SearchBar, Tabs, SlidePanel, SelectionBar, Skeleton, SortableHeader } from '../../../components/ui';
import { DeltaDown, SortUpDown } from '../../../components/ui/icons';
import { useSortState } from '../../../lib/useSortState';
import ChangeKeywordModal, { GscKeyword } from '../../../components/domains/ChangeKeywordModal';

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

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
   status: '',
};

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

// ── Filters popover ───────────────────────────────────────────────────────────
function FiltersPopover({ filters, onChange, onClose }: {
   filters: FilterState; onChange: (f: FilterState) => void; onClose: () => void;
}) {
   const ref = useRef<HTMLDivElement>(null);
   useEffect(() => {
      const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
      document.addEventListener('mousedown', fn);
      return () => document.removeEventListener('mousedown', fn);
   }, [onClose]);

   const set = (key: keyof FilterState, val: FilterState[keyof FilterState]) => onChange({ ...filters, [key]: val });

   const inputStyle: React.CSSProperties = { width: 76, height: 30, padding: '0 8px', border: '1px solid #D4D4D8', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-family-primary)', color: '#18181B', outline: 'none', background: '#fff' };

   const RangeRow = ({ label, minKey, maxKey }: { label: string; minKey: keyof FilterState; maxKey: keyof FilterState }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
         <span style={{ fontSize: 12, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" placeholder="Min" value={filters[minKey] as string} onChange={(e) => set(minKey, e.target.value)} style={inputStyle} />
            <span style={{ color: '#D4D4D8', fontSize: 12 }}>—</span>
            <input type="number" placeholder="Max" value={filters[maxKey] as string} onChange={(e) => set(maxKey, e.target.value)} style={inputStyle} />
         </div>
      </div>
   );

   return (
      <div ref={ref} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, boxShadow: '0px 18px 40px rgba(17,24,39,0.14), 0px 8px 18px rgba(17,24,39,0.09)', padding: 16, width: 280, display: 'flex', flexDirection: 'column', gap: 14, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top left' }}>
         <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.rankDropsOnly} onChange={(e) => set('rankDropsOnly', e.target.checked)} style={{ accentColor: '#783AFB', width: 14, height: 14 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Rank drops only</span>
         </label>
         <div style={{ height: 1, background: '#F4F4F5' }} />
         <RangeRow label="Content Score" minKey="contentScoreMin" maxKey="contentScoreMax" />
         <RangeRow label="Position" minKey="positionMin" maxKey="positionMax" />
         <RangeRow label="Clicks" minKey="trafficMin" maxKey="trafficMax" />
         <RangeRow label="Impressions" minKey="impressionsMin" maxKey="impressionsMax" />
         <div style={{ height: 1, background: '#F4F4F5' }} />
         <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Status</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
               {([{ value: '' as const, label: 'All' }, { value: 'not_started' as const, label: 'Not started' }, { value: 'in_progress' as const, label: 'In progress' }, { value: 'done' as const, label: 'Done' }]).map((opt) => (
                  <button key={opt.value} type="button" onClick={() => set('status', opt.value)} style={{ padding: '4px 10px', borderRadius: 9999, border: filters.status === opt.value ? '1px solid #09090B' : '1px solid #E4E4E7', background: filters.status === opt.value ? '#09090B' : '#fff', color: filters.status === opt.value ? '#fff' : '#52525C', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>{opt.label}</button>
               ))}
            </div>
         </div>
         <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#783AFB', fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Clear all filters</button>
      </div>
   );
}


// ── Main page ─────────────────────────────────────────────────────────────────
const RecommendationsPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData, isLoading: domainsLoading } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d: any) => d.slug === slug);

   const [tab, setTab] = useState<'optimize' | 'ideas'>('optimize');
   const [search, setSearch] = useState('');
   const [showUrls, setShowUrls] = useState(false);
   const { sortKey, sortDir, handleSort } = useSortState<SortKey>('content_score');
   const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
   const [filtersOpen, setFiltersOpen] = useState(false);
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
      async () => { const r = await fetch(`/api/searchconsole?domain=${slug}`); return r.json(); },
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
      const raw: any[] = scData?.data?.thirtyDays || [];
      const seen = new Map<string, GscKeyword>();
      raw.forEach((kw: any) => {
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
      const raw: any[] = scData?.data?.thirtyDays || [];
      const map = new Map<string, GscKeyword>();
      raw.forEach((kw: any) => {
         if (!kw.page) return;
         const urlKey = normalizeUrlForMatch(kw.page);
         const ex = map.get(urlKey);
         const candidate = { keyword: kw.keyword, position: kw.position ?? 0, clicks: kw.clicks ?? 0, impressions: kw.impressions ?? 0 };
         if (!ex || kwScore(candidate) > kwScore(ex)) {
            map.set(urlKey, candidate);
         }
      });
      return map;
   }, [scData]);

   // Auto-backfill: extract content_score from score_data + assign GSC keywords
   const backfillRan = useRef<string | null>(null);
   useEffect(() => {
      if (backfillRan.current !== slug) backfillRan.current = null;
      if (backfillRan.current) return;
      const articles: any[] = articlesData?.articles || [];
      const hasStaleScores = articles.some((a: any) => a.content_score === 0 && a.source !== 'site_context');
      const hasMissingKeywords = articles.some((a: any) => !a.target_keyword && (a.publish_url || a.meta_url));
      if ((hasStaleScores || hasMissingKeywords) && activeDomain?.ID && scData?.data?.thirtyDays?.length > 0) {
         backfillRan.current = slug;
         fetch('/api/articles/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainId: activeDomain.ID }),
         }).then(() => {
            queryClient.invalidateQueries(['articles', slug]);
         }).catch(() => {});
      }
   }, [articlesData, scData, activeDomain?.ID]);

   const rows = useMemo<RecommRow[]>(() => {
      const articles: any[] = articlesData?.articles || [];
      const scMap = new Map<string, GscKeyword>();
      allGscKeywords.forEach((kw) => { scMap.set(kw.keyword.toLowerCase(), kw); });
      return articles.map((a: any) => {
         let sc: GscKeyword | undefined;
         // Try URL match first (more reliable) — then fall back to keyword match
         if (a.publish_url || a.meta_url) {
            const urlKey = normalizeUrlForMatch(a.publish_url || a.meta_url);
            sc = urlKeywordMap.get(urlKey);
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
            updatedAt: a.updated_at || null,
         };
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
               updatedAt: null,
            };
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

   // Optimize: real articles (numeric id) open straight in the editor; scanned pages
   // (audit/site_context rows, no article yet) are scraped into a draft via the import
   // endpoint and then opened — the "pull the page into the Content Editor" step.
   const handleOptimize = async (row: RecommRow, e: React.MouseEvent) => {
      e.stopPropagation();
      if (typeof row.id === 'number') { router.push(`/articles/${row.id}`); return; }
      if (!row.url) return;
      setOptimizingId(row.id);
      try {
         const res = await fetch('/api/articles/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: row.url, keywords: row.keyword ? [row.keyword] : [], domainId: activeDomain?.ID }),
         });
         const data = await res.json();
         if (data.articleId) { router.push(`/articles/${data.articleId}`); return; }
      } catch { /* ignore */ }
      setOptimizingId(null);
   };


   const handleCreateArticleForKeyword = async (keyword: string) => {
      if (!activeDomain?.ID) return;
      setCreatingKw(keyword);
      try {
         const res = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain_id: activeDomain.ID, title: keyword, target_keyword: keyword }),
         });
         const data = await res.json();
         if (data.articleId) router.push(`/articles/${data.articleId}`);
      } catch { /* ignore */ }
      setCreatingKw(null);
   };

   const handleAnalyze = async (row: RecommRow, e: React.MouseEvent) => {
      e.stopPropagation();
      const id = row.id;
      setAnalyzingIds((prev) => new Set(prev).add(id));
      try {
         const body: any = {
            url: row.url,
            domainId: activeDomain!.ID,
            // Sidecar requires a keyword in the payload — send the page's main keyword.
            keywords: row.keyword ? [row.keyword] : [],
         };
         // If it's a real article (not site_context), pass articleId to reuse it
         if (typeof id === 'number' || (typeof id === 'string' && !String(id).startsWith('sc_'))) {
            body.articleId = id;
         }
         const res = await fetch('/api/articles/deep-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
         });
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
         body: JSON.stringify({ target_keyword: newKeyword }),
      });
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
         <Head><title>{`Recommendations — ${domain} — SerpBear`}</title></Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Recommendations" contentMaxWidth="100%">
            {/* ── Controls row ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>

               {/* Tab switcher */}
               <Tabs
                  items={[
                     { value: 'optimize', label: 'Optimize', count: optimizeRows.length },
                     { value: 'ideas', label: 'Content Ideas', count: gapRows.length },
                  ]}
                  value={tab}
                  onChange={(v) => setTab(v as 'optimize' | 'ideas')}
               />

               {/* Right controls */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

                  {/* Show URLs toggle */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                     <Toggle checked={showUrls} onChange={() => setShowUrls((v) => !v)} />
                     <span style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Show URLs</span>
                  </label>

                  {/* Filters — plain text button (no border) */}
                  <div style={{ position: 'relative' }}>
                     <button
                        type="button"
                        onClick={() => setFiltersOpen((v) => !v)}
                        style={{
                           display: 'inline-flex', alignItems: 'center', gap: 6,
                           border: 'none', background: 'transparent', padding: 0,
                           fontSize: 14, fontWeight: 600, color: activeFilterCount > 0 ? '#09090B' : '#3F3F47',
                           fontFamily: 'var(--font-family-primary)', cursor: 'pointer',
                        }}
                     >
                        <SlidersIcon />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                           <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 9999, background: '#09090B', color: '#fff', fontSize: 10, fontWeight: 700 }}>{activeFilterCount}</span>
                        )}
                     </button>
                     {filtersOpen && <FiltersPopover filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />}
                  </div>

                  {/* Search — 250px, shadow-xs, left icon */}
                  <SearchBar value={search} onChange={setSearch} placeholder="Search" width={250} />
               </div>
            </div>

            {/* ── Table ────────────────────────────────────────────────────── */}
            <div ref={rowsRef} style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflowX: 'auto' }}>

               {/* ── Content Ideas tab — content gap from GSC ── */}
               {tab === 'ideas' && (
                  <div style={{ minWidth: '100%' }}>
                     <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5', borderRadius: '8px 8px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
                        <div style={{ padding: '10px 16px', flexGrow: 1, fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>Keyword (not yet covered)</div>
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>Impressions</div>
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>Avg Position</div>
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>Action</div>
                     </div>
                     {loading ? (
                        <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Loading…</div>
                     ) : filteredGapRows.length === 0 ? (
                        <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                           No content gaps found — all GSC keywords already have articles.
                        </div>
                     ) : filteredGapRows.map((kw, i) => (
                        <div key={kw.keyword} className="rec-row" style={{ display: 'flex', alignItems: 'center', borderBottom: i < filteredGapRows.length - 1 ? '1px solid #F4F4F5' : 'none', minHeight: 56, background: '#fff', transition: 'background 120ms' }}>
                           <div style={{ padding: '10px 16px', flexGrow: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>{kw.keyword}</span>
                           </div>
                           <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, textAlign: 'right', fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                              {compactNum(kw.impressions)}
                           </div>
                           <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, textAlign: 'right', fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                              {kw.position > 0 ? kw.position.toFixed(1) : '—'}
                           </div>
                           <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 120, display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                 type="button"
                                 disabled={creatingKw === kw.keyword}
                                 onClick={() => handleCreateArticleForKeyword(kw.keyword)}
                                 style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #783AFB', background: creatingKw === kw.keyword ? 'rgba(120,58,251,0.08)' : 'transparent', color: '#783AFB', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: creatingKw === kw.keyword ? 'default' : 'pointer' }}
                              >
                                 {creatingKw === kw.keyword ? '…' : '+ Create'}
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}


               {/* ── Optimize tab ── */}
               {tab === 'optimize' && (
                  <div style={{ minWidth: '100%', display: 'table', width: '100%' }}>

                     {/* Header */}
                     <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5', borderRadius: '8px 8px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
                        {/* Checkbox */}
                        <div style={{ padding: '10px 16px', borderRight: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', flexShrink: 0, height: '100%' }}>
                           <Checkbox checked={allChecked} indeterminate={someChecked && !allChecked} onChange={toggleAll} />
                        </div>
                        {/* Page / Main keyword */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', flexGrow: 1, minWidth: 256 }}>
                           <button type="button" onClick={() => handleSort('content_score')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}>
                              <span style={{ fontSize: 13, color: '#52525C' }}>Page</span>
                              <SortUpDown active={false} dir={null} />
                           </button>
                           <span style={{ color: '#D4D4D8', lineHeight: '1rem' }}>/</span>
                           <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}>
                              <span style={{ fontSize: 13, color: '#52525C' }}>Main keyword</span>
                              <SortUpDown active={false} dir={null} />
                           </button>
                        </div>
                        <SortableHeader label="Content Score" sortKey="content_score" activeKey={sortKey} dir={sortDir} width={154} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Position" sortKey="position" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Clicks" sortKey="clicks" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                        <SortableHeader label="Impr." sortKey="impressions" activeKey={sortKey} dir={sortDir} width={108} onSort={(k) => handleSort(k as SortKey)} />
                     </div>

                     {/* Rows */}
                     {loading ? (
                        <Skeleton />
                     ) : filtered.length === 0 ? (
                        <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                           No pages need optimization. Great job!
                        </div>
                     ) : filtered.map((row, i) => {
                        const isSelected = selectedIds.has(row.id);
                        return (
                           <div
                              key={row.id}
                              className="rec-row"
                              style={{
                                 display: 'flex',
                                 alignItems: 'stretch',
                                 borderBottom: i < filtered.length - 1 ? '1px solid #F4F4F5' : 'none',
                                 minHeight: 72,
                                 background: isSelected ? 'rgba(120,58,251,0.04)' : '#fff',
                                 transition: 'background 120ms ease',
                                 position: 'relative',
                              }}
                           >
                              {/* Checkbox cell */}
                              <div style={{ padding: '0 16px', borderRight: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 1 }}>
                                 <Checkbox checked={isSelected} onChange={() => toggleRow(row.id)} />
                              </div>

                              {/* Page info + hover actions */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexGrow: 1, minWidth: 256, gap: 12, cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                 {/* Left: title + keyword + url */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#09090B', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {row.title}
                                    </span>
                                    {/* Keyword — clickable to change */}
                                    <button
                                       type="button"
                                       className="kw-btn"
                                       title="Change main keyword"
                                       onClick={(e) => { e.stopPropagation(); setKwModalRow(row); }}
                                       style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: 4, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', fontSize: 12, color: '#52525C', maxWidth: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    >
                                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textDecorationStyle: 'dotted', textUnderlineOffset: 3, transition: 'text-decoration-color 150ms' }} className="kw-btn-text">
                                          {row.keyword || 'Set keyword'}
                                       </span>
                                       <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" style={{ flexShrink: 0, opacity: 1, transition: 'opacity 150ms', color: '#9F9FA9' }} className="kw-btn-icon">
                                          <g><path d="m5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25z" /></g>
                                       </svg>
                                    </button>
                                    {showUrls && row.url && (
                                       <span style={{ fontSize: 11, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {row.url}
                                       </span>
                                    )}
                                 </div>

                                 {/* Right: hover actions */}
                                 <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: 0, transition: 'opacity 150ms ease' }}>
                                    {row.url && (
                                       <a href={row.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', color: '#3F3F47', textDecoration: 'none' }}>
                                          <ExternalLinkIcon />
                                       </a>
                                    )}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setPanelRow(row); }} style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#3F3F47', cursor: 'pointer', padding: 0 }}>
                                       <PanelIcon />
                                    </button>
                                    <button type="button" disabled={optimizingId === row.id} onClick={(e) => handleOptimize(row, e)} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 6, border: 'none', background: '#F4F4F5', color: '#18181B', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: optimizingId === row.id ? 'default' : 'pointer', opacity: optimizingId === row.id ? 0.6 : 1 }}>
                                       {optimizingId === row.id ? 'Optimizing…' : 'Optimize'}
                                    </button>
                                 </div>
                              </div>

                              {/* Content Score */}
                              <div style={{ borderLeft: '1px solid #F4F4F5', width: 154, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px' }}>
                                 {row.content_score > 0 ? (
                                    <div style={{ cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                       <Gauge score={row.content_score} size="sm" />
                                    </div>
                                 ) : analyzingIds.has(row.id) ? (
                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Analyzing…</span>
                                 ) : (
                                    <button
                                       type="button"
                                       onClick={(e) => handleAnalyze(row, e)}
                                       className="analyze-btn"
                                       style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 6, border: '1px solid #783AFB', background: 'transparent', color: '#783AFB', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer', opacity: 0, transition: 'opacity 150ms' }}
                                    >
                                       Analyze
                                    </button>
                                 )}
                              </div>

                              {/* Position */}
                              <div style={{ borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {row.position > 0 && <DeltaDown />}
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>
                                       {row.position > 0 ? row.position.toFixed(1) : '—'}
                                    </span>
                                 </div>
                              </div>

                              {/* Clicks */}
                              <div style={{ borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {row.clicks > 0 && <DeltaDown />}
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>
                                       {row.clicks > 0 ? compactNum(row.clicks) : '0'}
                                    </span>
                                 </div>
                              </div>

                              {/* Impressions */}
                              <div style={{ borderLeft: '1px solid #F4F4F5', width: 108, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setPanelRow(row)}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {row.impressions > 0 && <DeltaDown />}
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>
                                       {row.impressions > 0 ? compactNum(row.impressions) : '—'}
                                    </span>
                                 </div>
                              </div>

                           </div>
                        );
                     })}
                  </div>
               )}

            </div>
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
            .rec-row:hover { background: #F8F8F9 !important; }
            .rec-row:hover .row-actions { opacity: 1 !important; }
            .rec-row:hover .kw-btn-text { text-decoration-color: #D4D4D8 !important; }
            .rec-row:hover .kw-btn-icon { opacity: 1 !important; }
            .rec-row:hover .analyze-btn { opacity: 1 !important; }
            .kw-row:hover { background: rgba(120,58,251,0.03) !important; }
            @keyframes growOut { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
            @keyframes barSlideUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
            @keyframes spin { to { transform: rotate(360deg); } }
         ` }} />
      </AppShell>
   );
};

export default RecommendationsPage;
