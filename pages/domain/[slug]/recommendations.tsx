import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';

function slugToDomain(slug: string) {
   return slug.replaceAll('-', '.').replaceAll('_', '-');
}

// Score ring component
const ScoreRing = ({ score }: { score: number }) => {
   const r = 14;
   const circ = 2 * Math.PI * r;
   const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
   const fill = (score / 100) * circ;
   return (
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
         <circle cx="18" cy="18" r={r} fill="none" stroke="#F4F4F5" strokeWidth="3" />
         <circle
            cx="18" cy="18" r={r}
            fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${fill} ${circ - fill}`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
         />
         <text x="18" y="18" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill={color} fontFamily="var(--font-family-primary)">
            {score}
         </text>
      </svg>
   );
};

const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) => (
   <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, color: active ? '#09090B' : '#9F9FA9' }}>
      {dir === 'asc'
         ? <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" />
         : <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
      }
   </svg>
);

type SortKey = 'content_score' | 'position' | 'clicks' | 'impressions' | 'score';
type SortDir = 'asc' | 'desc';

const RecommendationsPage: NextPage = () => {
   const router = useRouter();
   const { slug } = router.query as { slug: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d) => d.slug === slug);

   const [tab, setTab] = useState<'optimize' | 'ideas'>('optimize');
   const [search, setSearch] = useState('');
   const [showUrls, setShowUrls] = useState(false);
   const [sortKey, setSortKey] = useState<SortKey>('score');
   const [sortDir, setSortDir] = useState<SortDir>('desc');

   // Fetch articles for this domain
   const { data: articlesData } = useQuery(
      ['articles', activeDomain?.ID],
      async () => {
         const res = await fetch(`/api/articles?domainId=${activeDomain!.ID}`);
         return res.json();
      },
      { enabled: !!activeDomain?.ID },
   );

   // Fetch SC data for position/traffic
   const { data: scData } = useQuery(
      ['sc-data', slug],
      async () => {
         const res = await fetch(`/api/searchconsole?domain=${slug}`);
         return res.json();
      },
      { enabled: !!slug, staleTime: 5 * 60 * 1000 },
   );

   // Build page list: articles with content score < 70 = Optimize
   const rows = useMemo(() => {
      const articles: any[] = articlesData?.articles || [];
      const scKeywords: any[] = scData?.data?.thirtyDays || [];

      // Build a map of keyword → SC data
      const scMap = new Map<string, { clicks: number; impressions: number; position: number }>();
      scKeywords.forEach((kw: any) => {
         if (kw.keyword) {
            const existing = scMap.get(kw.keyword.toLowerCase());
            if (!existing || kw.clicks > existing.clicks) {
               scMap.set(kw.keyword.toLowerCase(), { clicks: kw.clicks, impressions: kw.impressions, position: kw.position });
            }
         }
      });

      return articles.map((a: any) => {
         const sc = a.target_keyword ? scMap.get(a.target_keyword.toLowerCase()) : undefined;
         return {
            id: a.id,
            title: a.title,
            url: a.publish_url || a.meta_url || '',
            keyword: a.target_keyword || '',
            content_score: a.content_score || 0,
            position: sc?.position ?? 0,
            clicks: sc?.clicks ?? 0,
            impressions: sc?.impressions ?? 0,
            score: a.content_score || 0,
            status: a.status,
         };
      });
   }, [articlesData, scData]);

   const optimizeRows = rows.filter((r) => r.content_score < 70);
   const ideasRows: any[] = []; // future: keyword gap analysis

   const activeRows = tab === 'optimize' ? optimizeRows : ideasRows;

   const filtered = useMemo(() => {
      let out = activeRows;
      if (search.trim()) {
         const q = search.toLowerCase();
         out = out.filter((r) => r.title.toLowerCase().includes(q) || r.keyword.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
      }
      out = [...out].sort((a, b) => {
         const va = a[sortKey] ?? 0;
         const vb = b[sortKey] ?? 0;
         return sortDir === 'desc' ? vb - va : va - vb;
      });
      return out;
   }, [activeRows, search, sortKey, sortDir]);

   const handleSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      else { setSortKey(key); setSortDir('desc'); }
   };

   const TH = ({ label, k, w = 108 }: { label: string; k: SortKey; w?: number }) => (
      <div
         style={{ padding: '10px 12px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: w, cursor: 'pointer', gap: 4 }}
         onClick={() => handleSort(k)}
      >
         <span style={{ fontSize: 12, color: sortKey === k ? '#09090B' : '#71717B', fontWeight: sortKey === k ? 600 : 400, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
            {label}
         </span>
         <SortIcon active={sortKey === k} dir={sortKey === k ? sortDir : null} />
      </div>
   );

   const f = (family: string) => ({ fontFamily: family });

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>Recommendations — {domain} — SerpBear</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Recommendations">
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
               {/* Tabs */}
               <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #E4E4E7', overflow: 'hidden' }}>
                  {(['optimize', 'ideas'] as const).map((t) => (
                     <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        style={{
                           padding: '6px 14px',
                           border: 'none',
                           background: tab === t ? '#09090B' : 'transparent',
                           color: tab === t ? '#fff' : '#52525C',
                           fontSize: 13,
                           fontWeight: 600,
                           cursor: 'pointer',
                           fontFamily: 'var(--font-family-primary)',
                           display: 'flex',
                           alignItems: 'center',
                           gap: 6,
                        }}
                     >
                        {t === 'optimize' ? 'Optimize' : 'Content Ideas'}
                        <span
                           style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: tab === t ? 'rgba(255,255,255,0.7)' : '#9F9FA9',
                           }}
                        >
                           {t === 'optimize' ? optimizeRows.length : ideasRows.length}
                        </span>
                     </button>
                  ))}
               </div>

               {/* Right controls */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                     <input
                        type="checkbox"
                        checked={showUrls}
                        onChange={(e) => setShowUrls(e.target.checked)}
                        style={{ accentColor: '#783AFB' }}
                     />
                     Show URLs
                  </label>
                  <div style={{ position: 'relative' }}>
                     <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9F9FA9' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                        </svg>
                     </div>
                     <input
                        type="text"
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                           width: 200,
                           height: 32,
                           paddingLeft: 28,
                           paddingRight: 10,
                           border: '1px solid #E4E4E7',
                           borderRadius: 6,
                           fontSize: 13,
                           color: '#09090B',
                           background: '#fff',
                           outline: 'none',
                           fontFamily: 'var(--font-family-primary)',
                        }}
                     />
                  </div>
               </div>
            </div>

            {/* Table */}
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 10, overflow: 'hidden' }}>
               {/* Header */}
               <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5', fontSize: 12 }}>
                  <div style={{ padding: '10px 12px', flexGrow: 1, minWidth: 256, display: 'flex', gap: 8 }}>
                     <span style={{ color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Page</span>
                     <span style={{ color: '#D4D4D8' }}>/</span>
                     <span style={{ color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Main keyword</span>
                  </div>
                  <TH label="Content Score" k="content_score" w={130} />
                  <TH label="Position" k="position" />
                  <TH label="Traffic" k="clicks" />
                  <TH label="Impr." k="impressions" />
                  <TH label="Score" k="score" />
               </div>

               {/* Rows */}
               {filtered.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                     {tab === 'optimize' ? 'No pages need optimization. Great job!' : 'No content ideas available yet.'}
                  </div>
               ) : (
                  filtered.map((row, i) => (
                     <div
                        key={row.id}
                        style={{
                           display: 'flex',
                           alignItems: 'center',
                           borderBottom: i < filtered.length - 1 ? '1px solid #F4F4F5' : 'none',
                           minHeight: 64,
                           transition: 'background 0.1s',
                        }}
                        className="rec-row"
                     >
                        {/* Page + keyword */}
                        <div style={{ padding: '12px', flexGrow: 1, minWidth: 256, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                           <Link href={`/articles/${row.id}`} passHref>
                              <a
                                 style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: '#09090B',
                                    textDecoration: 'none',
                                    fontFamily: 'var(--font-family-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                 }}
                              >
                                 {row.title}
                              </a>
                           </Link>
                           {row.keyword && (
                              <span style={{ fontSize: 12, color: '#71717B', fontFamily: 'var(--font-family-primary)' }}>{row.keyword}</span>
                           )}
                           {showUrls && row.url && (
                              <span style={{ fontSize: 11, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                 {row.url}
                              </span>
                           )}
                        </div>
                        {/* Content Score */}
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', width: 130, display: 'flex', justifyContent: 'flex-end' }}>
                           <ScoreRing score={row.content_score} />
                        </div>
                        {/* Position */}
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.position > 0 ? row.position.toFixed(1) : '—'}
                        </div>
                        {/* Traffic */}
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.clicks > 0 ? row.clicks : '—'}
                        </div>
                        {/* Impressions */}
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                           {row.impressions > 0 ? row.impressions : '—'}
                        </div>
                        {/* Score */}
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', minWidth: 108, display: 'flex', justifyContent: 'flex-end' }}>
                           <ScoreRing score={row.score} />
                        </div>
                     </div>
                  ))
               )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `.rec-row:hover { background: #F8F8F9 !important; }` }} />
         </DomainSubLayout>
      </AppShell>
   );
};

export default RecommendationsPage;
