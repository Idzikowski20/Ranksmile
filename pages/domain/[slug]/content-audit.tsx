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

const ScoreRing = ({ score }: { score: number }) => {
   const r = 14;
   const circ = 2 * Math.PI * r;
   const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
   const fill = (score / 100) * circ;
   return (
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
         <circle cx="18" cy="18" r={r} fill="none" stroke="#F4F4F5" strokeWidth="3" />
         <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
         <text x="18" y="18" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill={color} fontFamily="var(--font-family-primary)">
            {score}
         </text>
      </svg>
   );
};

const StatusBadge = ({ status }: { status: string }) => {
   const map: Record<string, { bg: string; color: string; label: string }> = {
      published: { bg: '#F0FDF4', color: '#15803D', label: 'Published' },
      draft: { bg: '#F9FAFB', color: '#6B7280', label: 'Draft' },
      review: { bg: '#FFFBEB', color: '#B45309', label: 'Review' },
   };
   const s = map[status] || map.draft;
   return (
      <span style={{
         padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
         background: s.bg, color: s.color, fontFamily: 'var(--font-family-primary)',
      }}>
         {s.label}
      </span>
   );
};

type SortKey = 'content_score' | 'position' | 'clicks' | 'impressions' | 'title';

const ContentAuditPage: NextPage = () => {
   const router = useRouter();
   const { slug } = router.query as { slug: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d) => d.slug === slug);

   const [search, setSearch] = useState('');
   const [showUrls, setShowUrls] = useState(false);
   const [sortKey, setSortKey] = useState<SortKey>('content_score');
   const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
   const [selected, setSelected] = useState<Set<string | number>>(new Set());

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
      const articles: any[] = articlesData?.articles || [];
      const scKeywords: any[] = scData?.data?.thirtyDays || [];
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
            status: a.status,
            created_at: a.created_at,
         };
      });
   }, [articlesData, scData]);

   const filtered = useMemo(() => {
      let out = rows;
      if (search.trim()) {
         const q = search.toLowerCase();
         out = out.filter((r) => r.title.toLowerCase().includes(q) || r.keyword.toLowerCase().includes(q));
      }
      out = [...out].sort((a, b) => {
         const va = (a as any)[sortKey] ?? 0;
         const vb = (b as any)[sortKey] ?? 0;
         if (typeof va === 'string') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
         return sortDir === 'desc' ? vb - va : va - vb;
      });
      return out;
   }, [rows, search, sortKey, sortDir]);

   const handleSort = (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      else { setSortKey(key); setSortDir('desc'); }
   };

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

   const TH = ({ label, k, w = 108 }: { label: string; k: SortKey; w?: number }) => (
      <div
         style={{ padding: '10px 12px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: w, cursor: 'pointer', gap: 4 }}
         onClick={() => handleSort(k)}
      >
         <span style={{ fontSize: 12, color: sortKey === k ? '#09090B' : '#71717B', fontWeight: sortKey === k ? 600 : 400, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
            {label}
         </span>
         <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" style={{ color: sortKey === k ? '#09090B' : '#D4D4D8', flexShrink: 0 }}>
            <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" />
         </svg>
      </div>
   );

   const actions = (
      <>
         <button
            type="button"
            onClick={exportCSV}
            style={{
               display: 'inline-flex', alignItems: 'center', gap: 6,
               padding: '6px 14px', borderRadius: 6, border: '1px solid #E4E4E7',
               background: '#fff', fontSize: 13, fontWeight: 600, color: '#52525C',
               cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
            }}
         >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
         </button>
         <Link href={`/articles?domainId=${activeDomain?.ID}`} passHref>
            <a
               style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: '#09090B', fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: 'pointer', textDecoration: 'none', fontFamily: 'var(--font-family-primary)',
               }}
            >
               + Add Page
            </a>
         </Link>
      </>
   );

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>Content Audit — {domain} — SerpBear</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Content Audit" actions={actions}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
               <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  <input type="checkbox" checked={showUrls} onChange={(e) => setShowUrls(e.target.checked)} style={{ accentColor: '#783AFB' }} />
                  Show URLs
               </label>
               <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9F9FA9' }}>
                     <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                     </svg>
                  </div>
                  <input
                     type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)}
                     style={{ width: 200, height: 32, paddingLeft: 28, paddingRight: 10, border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, color: '#09090B', background: '#fff', outline: 'none', fontFamily: 'var(--font-family-primary)' }}
                  />
               </div>
            </div>

            {/* Table */}
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 10, overflow: 'hidden' }}>
               {/* Header */}
               <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5' }}>
                  {/* Checkbox */}
                  <div style={{ padding: '10px 12px', borderRight: '1px solid #F4F4F5' }}>
                     <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ accentColor: '#783AFB' }} />
                  </div>
                  <div style={{ padding: '10px 12px', flexGrow: 1, minWidth: 256, display: 'flex', gap: 8 }}>
                     <span style={{ fontSize: 12, color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Page</span>
                     <span style={{ color: '#D4D4D8', fontSize: 12 }}>/</span>
                     <span style={{ fontSize: 12, color: '#71717B', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>Main keyword</span>
                  </div>
                  <TH label="Content Score" k="content_score" w={130} />
                  <TH label="Position" k="position" />
                  <TH label="Traffic" k="clicks" />
                  <TH label="Impr." k="impressions" />
               </div>

               {isLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Loading…</div>
               ) : filtered.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                     No articles found. <Link href="/content-editor" passHref><a style={{ color: '#783AFB' }}>Create your first article →</a></Link>
                  </div>
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
                           <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} style={{ accentColor: '#783AFB' }} />
                        </div>
                        <div style={{ padding: '12px', flexGrow: 1, minWidth: 256, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Link href={`/articles/${row.id}`} passHref>
                                 <a style={{ fontSize: 13, fontWeight: 500, color: '#09090B', textDecoration: 'none', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.title}
                                 </a>
                              </Link>
                              <StatusBadge status={row.status} />
                           </div>
                           {row.keyword && <span style={{ fontSize: 12, color: '#71717B', fontFamily: 'var(--font-family-primary)' }}>{row.keyword}</span>}
                           {showUrls && row.url && <span style={{ fontSize: 11, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.url}</span>}
                        </div>
                        <div style={{ padding: '12px', borderLeft: '1px solid #F4F4F5', width: 130, display: 'flex', justifyContent: 'flex-end' }}>
                           <ScoreRing score={row.content_score} />
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

            <style dangerouslySetInnerHTML={{ __html: `.audit-row:hover { background: #F8F8F9 !important; }` }} />
         </DomainSubLayout>
      </AppShell>
   );
};

export default ContentAuditPage;
