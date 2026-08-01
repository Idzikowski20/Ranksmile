import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button, CompactSelect } from '../core';
import { useAddRankKeywords, useRankConfigs } from '../../services/rankTracking';
import countries from '../../utils/countries';

type IdeaKeyword = {
   uid: string;
   keyword: string;
   competition: string;
   country: string;
   domain: string;
   competitionIndex: number;
   monthlySearchVolumes: Record<string, string>;
   avgMonthlySearches: number;
   added: number;
   updated: number;
   position: number;
};

type Props = {
   domain: DomainType | null;
   slug: string;
   isAdwordsConnected: boolean;
};

// ── Skeleton rows (pattern from Recommendations) ────────────────────────
const SKELETON_COUNT = 6;
const SkeletonRows = () => (
   <>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
         <div
            key={`skel-${i}`}
            style={{
               display: 'flex', alignItems: 'center',
               borderBottom: i < SKELETON_COUNT - 1 ? '1px solid #F4F4F5' : 'none',
               minHeight: 56, background: '#fff',
               animation: 'skeletonPulse 1.5s ease-in-out infinite',
               animationDelay: `${i * 0.08}s`,
            }}
         >
            <div style={{ padding: '12px 16px', flexGrow: 1, minWidth: 200 }}>
               <div style={{ width: '55%', height: 14, borderRadius: 6, background: '#F0F0F4' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 48, height: 14, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 100, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 36, height: 14, borderRadius: 6, background: '#F0F0F4' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
               <div style={{ width: 40, height: 14, borderRadius: 6, background: '#F5F5F9' }} />
            </div>
            <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 40, flexShrink: 0 }} />
         </div>
      ))}
   </>
);

// ── Competition badge ────────────────────────────────────────────────────
const competitionColor = (c: string): { bg: string; color: string; label: string } => {
   if (c === 'LOW') return { bg: 'rgba(26,178,94,0.08)', color: '#16a34a', label: 'Low' };
   if (c === 'MEDIUM') return { bg: 'rgba(234,179,8,0.1)', color: '#b45309', label: 'Medium' };
   if (c === 'HIGH') return { bg: 'rgba(239,68,68,0.08)', color: '#dc2626', label: 'High' };
   return { bg: '#F4F4F5', color: '#9F9FA9', label: c || 'Unknown' };
};

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

// ── Mini sparkline for 12-month volume trend ─────────────────────────────
const MiniSparkline = ({ volumes }: { volumes: Record<string, string> }) => {
   const vals = Object.entries(volumes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => parseInt(v, 10) || 0);
   if (vals.length < 2) return null;
   const max = Math.max(...vals, 1);
   const min = Math.min(...vals);
   const range = max - min || 1;
   const h = 20;
   const w = 60;
   const points = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * (h - 3) - 2}`);
   return (
      <svg width={w} height={h} style={{ flexShrink: 0 }}>
         <polyline
            points={points.join(' ')}
            fill="none"
            stroke={vals[0] <= vals[vals.length - 1] ? '#1AB25E' : '#FF6F77'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </svg>
   );
};

// ── Sort icons ────────────────────────────────────────────────────────────
const SortUpDown = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) => (
   <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, color: active ? '#09090B' : '#9F9FA9' }}>
      {active && dir === 'asc'
         ? <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" />
         : active && dir === 'desc'
            ? <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
            : <path fillRule="evenodd" d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06zm-4.31 9.81l3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06" clipRule="evenodd" />
      }
   </svg>
);

// ── Country ISO codes (matches countries.ts keys) ─────────────────────────
const POPULAR_LOCATIONS = [
   { code: 'US', label: '🇺🇸 United States' },
   { code: 'GB', label: '🇬🇧 United Kingdom' },
   { code: 'PL', label: '🇵🇱 Poland' },
   { code: 'DE', label: '🇩🇪 Germany' },
   { code: 'FR', label: '🇫🇷 France' },
   { code: 'CA', label: '🇨🇦 Canada' },
   { code: 'AU', label: '🇦🇺 Australia' },
];

// ── Main component ────────────────────────────────────────────────────────
const KeywordResearchPanel = ({ domain, slug, isAdwordsConnected }: Props) => {
   const [search, setSearch] = useState('');
   const [keywords, setKeywords] = useState<IdeaKeyword[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [searched, setSearched] = useState(false); // to show initial vs empty state
   const [locationCode, setLocationCode] = useState('US');
   const [sortKey, setSortKey] = useState<'volume' | 'competition'>('volume');
   const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
   const [trackingIds, setTrackingIds] = useState<Set<string>>(new Set());

   const configsQ = useRankConfigs(slug || undefined);
   const configId = configsQ.data?.configs?.[0]?.id;
   const { mutate: addKeywords } = useAddRankKeywords(slug || undefined, configId);

   const handleSearch = async () => {
      const q = search.trim();
      if (!q || loading) return;

      setLoading(true);
      setError(null);
      setSearched(true);

      try {
         const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               domain: slug,
               country: locationCode,
               language: '1000',
               keywords: [q],
               seedType: 'custom',
            }),
         });
         const data = await res.json();
         if (!res.ok || data.error) {
            setError(data.error || 'Failed to fetch keyword ideas');
            setKeywords([]);
         } else {
            setKeywords(data.keywords || []);
         }
      } catch {
         setError('Network error. Please try again.');
         setKeywords([]);
      }
      setLoading(false);
   };

   const handleTrack = (kw: IdeaKeyword) => {
      if (!slug || !configId || trackingIds.has(kw.uid)) return;
      setTrackingIds((prev) => new Set(prev).add(kw.uid));
      addKeywords([kw.keyword]);
   };

   // Sort results
   const sorted = useMemo(() => {
      const arr = [...keywords];
      arr.sort((a, b) => {
         const va = sortKey === 'volume' ? a.avgMonthlySearches : a.competitionIndex;
         const vb = sortKey === 'volume' ? b.avgMonthlySearches : b.competitionIndex;
         return sortDir === 'desc' ? vb - va : va - vb;
      });
      return arr;
   }, [keywords, sortKey, sortDir]);

   const handleSort = (key: 'volume' | 'competition') => {
      if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      else { setSortKey(key); setSortDir('desc'); }
   };

   // TH component
   const TH = ({ label, k, width }: { label: string; k: 'volume' | 'competition'; width: number }) => (
      <div
         role="button"
         tabIndex={0}
         onClick={() => handleSort(k)}
         onKeyDown={(e) => e.key === 'Enter' && handleSort(k)}
         style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width, flexShrink: 0, cursor: 'pointer', userSelect: 'none', gap: 4 }}
      >
         <span style={{ fontSize: 13, fontWeight: sortKey === k ? 600 : 400, color: sortKey === k ? '#09090B' : '#52525C', fontFamily: 'var(--font-family-primary)' }}>
            {label}
         </span>
         <SortUpDown active={sortKey === k} dir={sortKey === k ? sortDir : null} />
      </div>
   );

   // ── Not connected state ─────────────────────────────────────────────────
   if (!isAdwordsConnected) {
      return (
         <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: 16, color: '#9F9FA9' }}>
               <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
               </svg>
               <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Keyword Research Unavailable</h3>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)', lineHeight: '20px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
               Google Ads has not been integrated yet. Please follow{' '}
               <a href="https://ranksmile.pl/miscellaneous/integrate-google-ads" target="_blank" rel="noreferrer" style={{ color: '#F29964', fontWeight: 600 }}>
                  These Steps
               </a>{' '}
               to integrate Google Ads and unlock keyword research.
            </p>
         </div>
      );
   }

   return (
      <div>
         {/* ── Search bar ────────────────────────────────────────────────── */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ position: 'relative', flex: 1 }}>
               <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9F9FA9', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5">
                     <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                  </svg>
               </div>
               <input
                  type="text"
                  placeholder="Search for keyword ideas... (e.g. seo tools)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  style={{
                     width: '100%', height: 42, paddingLeft: 38, paddingRight: 12,
                     border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 14,
                     color: '#09090B', background: '#fff', outline: 'none',
                     fontFamily: 'var(--font-family-primary)',
                     boxShadow: '0px 1px 2px rgba(26,29,40,0.06)',
                     transition: 'border-color 200ms, box-shadow 200ms',
                  }}
                  onFocus={(e) => {
                     e.currentTarget.style.borderColor = '#F5C4A0';
                     e.currentTarget.style.boxShadow = '0px 1px 2px rgba(26,29,40,0.06), 0px 0px 0px 3px rgba(242,153,100,0.1)';
                  }}
                  onBlur={(e) => {
                     e.currentTarget.style.borderColor = '#D4D4D8';
                     e.currentTarget.style.boxShadow = '0px 1px 2px rgba(26,29,40,0.06)';
                  }}
               />
            </div>

            <CompactSelect
               size="sm"
               value={locationCode}
               onChange={(opt) => setLocationCode(opt.value)}
               options={POPULAR_LOCATIONS.map((loc) => ({ value: loc.code, label: loc.label }))}
            />

            <Button
               type="button"
               variant="primary"
               size="sm"
               onClick={handleSearch}
               disabled={loading || !search.trim()}
               busy={loading}
            >
               {loading ? 'Searching…' : 'Search'}
            </Button>
         </div>

         {/* ── Error banner ──────────────────────────────────────────────── */}
         {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: '#FFF2F2', border: '1px solid #FFD4D4', borderRadius: 8 }}>
               <span style={{ fontSize: 13, color: '#dc2626', fontFamily: 'var(--font-family-primary)', flex: 1 }}>{error}</span>
               <Button type="button" variant="transparent" size="xs" aria-label="Dismiss error" onClick={() => setError(null)} icon={(
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
               )} />
            </div>
         )}

         {/* ── Results table ─────────────────────────────────────────────── */}
         {loading || searched ? (
            <div style={{ border: '1px solid #F4F4F5', borderRadius: 8, overflowX: 'auto' }}>
               {/* Header */}
               <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #F4F4F5', borderRadius: '8px 8px 0 0' }}>
                  <div style={{ padding: '10px 16px', flexGrow: 1, minWidth: 200, fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>Keyword</div>
                  <TH label="Volume" k="volume" width={110} />
                  <TH label="Competition" k="competition" width={100} />
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)', textAlign: 'right' }}>12m Trend</div>
                  <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 40, flexShrink: 0 }} />
               </div>

               {loading ? (
                  <SkeletonRows />
               ) : sorted.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                     <p style={{ margin: 0, fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                        No keyword ideas found for &quot;{search}&quot;. Try a different search term.
                     </p>
                  </div>
               ) : sorted.map((kw, i) => {
                  const comp = competitionColor(kw.competition);
                  return (
                     <div
                        key={kw.uid}
                        className="kwr-row"
                        style={{
                           display: 'flex', alignItems: 'center',
                           borderBottom: i < sorted.length - 1 ? '1px solid #F4F4F5' : 'none',
                           minHeight: 56, background: '#fff',
                           transition: 'background 120ms',
                        }}
                     >
                        {/* Keyword */}
                        <div style={{ padding: '10px 16px', flexGrow: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
                           <span style={{ fontSize: 13, fontWeight: 600, color: '#09090B', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {kw.keyword}
                           </span>
                        </div>

                        {/* Monthly Volume */}
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, textAlign: 'right' }}>
                           <span style={{ fontSize: 13, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>
                              {kw.avgMonthlySearches > 0 ? compactNum(kw.avgMonthlySearches) : '—'}
                           </span>
                        </div>

                        {/* Competition */}
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 100, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                           <span style={{
                              padding: '2px 8px', borderRadius: 9999,
                              background: comp.bg, color: comp.color,
                              fontSize: 11, fontWeight: 700,
                              fontFamily: 'var(--font-family-primary)',
                              whiteSpace: 'nowrap',
                           }}>
                              {comp.label}
                           </span>
                        </div>

                        {/* 12m Trend */}
                        <div style={{ padding: '10px 16px', borderLeft: '1px solid #F4F4F5', width: 110, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                           <MiniSparkline volumes={kw.monthlySearchVolumes} />
                        </div>

                        {/* Track button — visible on row hover */}
                        <div style={{ padding: '0 16px', borderLeft: '1px solid #F4F4F5', width: 40, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                           <Button
                              type="button"
                              className="kwr-track-btn"
                              variant="link"
                              size="xs"
                              disabled={trackingIds.has(kw.uid)}
                              onClick={() => handleTrack(kw)}
                              title={trackingIds.has(kw.uid) ? 'Tracked' : 'Track keyword'}
                              style={{ opacity: 0, transition: 'opacity 150ms' }}
                           >
                              {trackingIds.has(kw.uid) ? 'Tracked' : '+ Track'}
                           </Button>
                        </div>
                     </div>
                  );
               })}
            </div>
         ) : (
            /* ── Initial empty state ── */
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
               <div style={{ marginBottom: 16, color: '#9F9FA9' }}>
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ margin: '0 auto 16px', display: 'block' }}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                  </svg>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Discover keyword opportunities</h3>
               </div>
               <p style={{ margin: '0 0 24px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)', lineHeight: '20px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                  Enter a seed keyword above to discover related keywords with search volume, competition data, and monthly trends — powered by Google Ads Keyword Planner.
               </p>
               {/* Quick suggestions */}
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {['seo tools', 'keyword research', 'backlink checker', 'content marketing'].map((seed) => (
                     <Button key={seed} type="button" variant="secondary" size="sm" onClick={() => setSearch(seed)} style={{ borderRadius: 9999 }}>
                        {seed}
                     </Button>
                  ))}
               </div>
            </div>
         )}

         {/* ── Row hover styles ── */}
         <style dangerouslySetInnerHTML={{ __html: `
            .kwr-row:hover { background: #f3f4f0 !important; }
            .kwr-row:hover .kwr-track-btn { opacity: 1 !important; }
         ` }} />
      </div>
   );
};

export default KeywordResearchPanel;
