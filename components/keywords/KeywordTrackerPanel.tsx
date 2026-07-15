import React, { useMemo, useState } from 'react';
import { NextRouter } from 'next/router';
import { CSSTransition } from 'react-transition-group';
import toast from 'react-hot-toast';
import { useFetchKeywords, useDeleteKeywords, useFavKeywords, useAddKeywords } from '../../services/keywords';
import { useFetchSCKeywords } from '../../services/searchConsole';
import AddKeywords from './AddKeywords';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function safeJsonParse<T>(v: unknown, fallback: T): T {
   if (Array.isArray(v)) return v as T;
   if (typeof v !== 'string') return fallback;
   try { const p = JSON.parse(v); return Array.isArray(p) ? p as T : fallback; } catch { return fallback; }
}

function normalizeDevice(device?: string) {
   const d = String(device || '').toLowerCase();
   return d.includes('mobile') ? 'mobile' : 'desktop';
}

function normalizeCountry(country?: string) {
   return String(country || 'US').toUpperCase();
}

interface TrackedRow {
   id: number;
   keyword: string;
   position: number | null;
   volume: number | null;
   country: string;
   device: string;
   tags: string[];
   sticky: boolean;
   updating: boolean;
   lastUpdated: string | null;
}

function normalizeTrackedKeyword(raw: KeywordType): TrackedRow {
   return {
      id: raw.ID,
      keyword: raw.keyword ?? '',
      position: raw.position ?? null,
      volume: raw.volume ?? null,
      country: raw.country || 'US',
      device: raw.device || 'desktop',
      tags: safeJsonParse<string[]>(raw.tags, []),
      sticky: raw.sticky ?? false,
      updating: raw.updating ?? false,
      lastUpdated: raw.lastUpdated ?? raw.added ?? null,
   };
}

interface SCRow {
   keyword: string;
   impressions: number;
   clicks: number;
   ctr: number;
   position: number;
   device: string;
   country: string;
   uid: string;
}

function aggregateSCKeywords(items: SearchAnalyticsItem[]): SCRow[] {
   const map = new Map<string, { keyword: string; impressions: number; clicks: number; posWeight: number; device: string; country: string; uid: string }>();
   for (const item of items) {
      const key = (item.keyword || '').trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
         existing.impressions += item.impressions || 0;
         existing.clicks += item.clicks || 0;
         existing.posWeight += (item.position || 0) * (item.impressions || 0);
      } else {
         map.set(key, {
            keyword: item.keyword,
            impressions: item.impressions || 0,
            clicks: item.clicks || 0,
            posWeight: (item.position || 0) * (item.impressions || 0),
            device: item.device || 'desktop',
            country: item.country || 'US',
            uid: item.uid,
         });
      }
   }
   return [...map.values()].map(v => ({
      ...v,
      position: v.impressions > 0 ? Math.round(v.posWeight / v.impressions) : 0,
      ctr: v.impressions > 0 ? Math.round((v.clicks / v.impressions) * 10000) / 10000 : 0,
   }));
}

/* ── Design tokens (inline) ───────────────────────────────────────────────── */

const CARD: React.CSSProperties = { border: '1px solid #F4F4F5', borderRadius: 12, background: '#FFFFFF' };
const TH: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#52525C', fontFamily: 'var(--font-family-primary)', textAlign: 'left', padding: '10px 12px', background: '#F8F9FF', borderBottom: '1px solid #F4F4F5', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { fontSize: 13, color: '#18181B', fontFamily: 'var(--font-family-primary)', padding: '10px 12px', borderBottom: '1px solid #F4F4F5' };
const PILL_ACTIVE: React.CSSProperties = { padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)', border: 'none', cursor: 'pointer', background: '#2F2F34', color: '#FFFFFF', transition: 'all 150ms' };
const PILL_INACTIVE: React.CSSProperties = { padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family-primary)', border: 'none', cursor: 'pointer', background: '#F4F4F5', color: '#52525C', transition: 'all 150ms' };

/* ── Tiny inline SVGs ─────────────────────────────────────────────────────── */

const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) => (
   <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M3 4.5L6 1.5L9 4.5" stroke={active && dir === 'asc' ? '#18181B' : '#9F9FA9'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7.5L6 10.5L9 7.5" stroke={active && dir === 'desc' ? '#18181B' : '#9F9FA9'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/* ── Sub-components ───────────────────────────────────────────────────────── */

const SkeletonRow = () => (
   <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
         <td key={i} style={TD}>
            <div style={{ height: 14, borderRadius: 4, background: '#F4F4F5', width: i === 1 ? '60%' : '40%', animation: 'pulse 1.5s infinite' }} />
         </td>
      ))}
   </tr>
);

/* ── Props ────────────────────────────────────────────────────────────────── */

type KeywordTrackerPanelProps = {
   domain: DomainType | null;
   isConsoleConnected: boolean;
   router: NextRouter;
   scraperName: string;
   allowsCity: boolean;
};

/* ── Main component ───────────────────────────────────────────────────────── */

const KeywordTrackerPanel = ({ domain, isConsoleConnected, router, scraperName, allowsCity }: KeywordTrackerPanelProps) => {
   const domainName = domain?.domain || '';

   /* ── Data ─────────────────────────────────────────────────────────────── */
   const { keywordsData, keywordsLoading } = useFetchKeywords(router, domainName);
   const rawTracked: KeywordType[] = keywordsData?.keywords || [];
   const trackedKeywords: TrackedRow[] = useMemo(() => rawTracked.map(normalizeTrackedKeyword), [rawTracked]);

   const { data: scData, isLoading: scLoading } = useFetchSCKeywords(router, !!domain);
   const rawSCItems: Record<string, SearchAnalyticsItem[]> = useMemo(() => (scData?.data ? scData.data : {}), [scData]);

   const deleteMutation = useDeleteKeywords(() => {});
   const favMutation = useFavKeywords(() => {});
   const addKeywordsMutation = useAddKeywords(() => {
      toast.success('Keywords added to tracker');
   });

   /* ── UI state ─────────────────────────────────────────────────────────── */
   const [activeTab, setActiveTab] = useState<'tracked' | 'discover'>('tracked');
   const [selectedTracked, setSelectedTracked] = useState<Set<number>>(new Set());
   const [selectedSC, setSelectedSC] = useState<Set<string>>(new Set());
   const [scDateRange, setSCDateRange] = useState<string>('thirtyDays');
   const [search, setSearch] = useState('');
   const [countryFilter, setCountryFilter] = useState('all');
   const [deviceFilter, setDeviceFilter] = useState('all');
   const [sortKey, setSortKey] = useState('position');
   const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
   const [showAddKeywords, setShowAddKeywords] = useState(false);

   /* ── Derived: Tracked ─────────────────────────────────────────────────── */
   const availableCountries = useMemo(() => {
      const set = new Set(trackedKeywords.map(k => k.country).filter(Boolean));
      return [...set].sort();
   }, [trackedKeywords]);

   const filteredTracked = useMemo(() => {
      let list = [...trackedKeywords];
      if (search) {
         const q = search.toLowerCase();
         list = list.filter(k => k.keyword.toLowerCase().includes(q));
      }
      if (countryFilter !== 'all') list = list.filter(k => k.country === countryFilter);
      if (deviceFilter !== 'all') list = list.filter(k => k.device === deviceFilter);
      return list;
   }, [trackedKeywords, search, countryFilter, deviceFilter]);

   const sortedTracked = useMemo(() => {
      const list = [...filteredTracked];
      list.sort((a, b) => {
         let cmp = 0;
         switch (sortKey) {
            case 'position': cmp = (a.position ?? 999) - (b.position ?? 999); break;
            case 'volume': cmp = (b.volume ?? 0) - (a.volume ?? 0); break;
            case 'date': cmp = (b.lastUpdated || '').localeCompare(a.lastUpdated || ''); break;
            case 'keyword': cmp = a.keyword.localeCompare(b.keyword); break;
            default: break;
         }
         return sortDir === 'desc' ? -cmp : cmp;
      });
      return list;
   }, [filteredTracked, sortKey, sortDir]);

   /* ── Derived: SC ──────────────────────────────────────────────────────── */
   const scItemsForRange: SearchAnalyticsItem[] = useMemo(() => rawSCItems[scDateRange] || [], [rawSCItems, scDateRange]);
   const aggregatedSC = useMemo(() => aggregateSCKeywords(scItemsForRange), [scItemsForRange]);

   const trackedSet = useMemo(
      () => new Set(trackedKeywords.map(k => k.keyword.trim().toLowerCase())),
      [trackedKeywords],
   );

   const scSummary = useMemo(() => {
      const total = aggregatedSC.length;
      const totalImpressions = aggregatedSC.reduce((s, i) => s + i.impressions, 0);
      const totalClicks = aggregatedSC.reduce((s, i) => s + i.clicks, 0);
      const avgPos = totalImpressions > 0
         ? aggregatedSC.reduce((s, i) => s + i.position * i.impressions, 0) / totalImpressions
         : 0;
      const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      return { total, totalImpressions, totalClicks, avgPos: Math.round(avgPos * 10) / 10, overallCtr: Math.round(overallCtr * 10000) / 10000 };
   }, [aggregatedSC]);

   /* ── Handlers ─────────────────────────────────────────────────────────── */
   const toggleSort = (key: string) => {
      if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortKey(key); setSortDir('asc'); }
   };

   const toggleTrackedSelect = (id: number) => {
      setSelectedTracked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
   };

   const toggleSCSelect = (uid: string) => {
      setSelectedSC(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
   };

   const selectAllTracked = () => {
      if (selectedTracked.size === sortedTracked.length) { setSelectedTracked(new Set()); } else { setSelectedTracked(new Set(sortedTracked.map(k => k.id))); }
   };

   const selectAllSC = () => {
      if (selectedSC.size === aggregatedSC.length) { setSelectedSC(new Set()); } else { setSelectedSC(new Set(aggregatedSC.map(k => k.uid))); }
   };

   const handleBatchDelete = () => { deleteMutation.mutate([...selectedTracked]); setSelectedTracked(new Set()); };
   const handleBatchFav = (sticky: boolean) => {
      for (const id of selectedTracked) favMutation.mutate({ keywordID: id, sticky });
      setSelectedTracked(new Set());
   };

   const handleTrackOne = (sc: SCRow) => {
      addKeywordsMutation.mutate([{
         keyword: sc.keyword,
         device: normalizeDevice(sc.device),
         country: normalizeCountry(sc.country),
         domain: domainName,
         tags: '',
      }]);
   };

   const handleBatchTrack = () => {
      const payloads = aggregatedSC
         .filter(sc => selectedSC.has(sc.uid) && !trackedSet.has(sc.keyword.trim().toLowerCase()))
         .map(sc => ({
            keyword: sc.keyword,
            device: normalizeDevice(sc.device),
            country: normalizeCountry(sc.country),
            domain: domainName,
            tags: '',
         }));
      const skipped = selectedSC.size - payloads.length;
      if (payloads.length > 0) addKeywordsMutation.mutate(payloads);
      if (skipped > 0) toast(`Skipped ${skipped} already tracked`);
      setSelectedSC(new Set());
   };

   const hasBatchTracked = selectedTracked.size > 0;
   const hasBatchSC = selectedSC.size > 0;

   /* ── Volume formatter ─────────────────────────────────────────────────── */
   const fmtVol = (v: number | null) => (v != null ? v.toLocaleString() : '—');

   /* ── Render ───────────────────────────────────────────────────────────── */
   return (
      <div>
         {/* ─── Header: tabs + Add button ─── */}
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
               <button type="button" style={activeTab === 'tracked' ? PILL_ACTIVE : PILL_INACTIVE} onClick={() => setActiveTab('tracked')}>
                  Tracked Keywords
               </button>
               <button type="button" style={activeTab === 'discover' ? PILL_ACTIVE : PILL_INACTIVE} onClick={() => setActiveTab('discover')}>
                  Search Console
               </button>
            </div>
            <button
               type="button"
               onClick={() => setShowAddKeywords(true)}
               style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#2F2F34', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-family-primary)', transition: 'background 150ms',
               }}
            >
               + Add Keyword
            </button>
         </div>

         {/* ─── Toolbar: search + filters + sort ─── */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
               type="text"
               placeholder="Search keywords..."
               value={search}
               onChange={e => setSearch(e.target.value)}
               style={{
                  width: 220, height: 34, padding: '0 12px', border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 13,
                  color: '#09090B', background: '#fff', outline: 'none', fontFamily: 'var(--font-family-primary)',
               }}
               onFocus={e => { e.currentTarget.style.borderColor = '#F5C4A0'; e.currentTarget.style.boxShadow = '0px 0px 0px 3px rgba(242,153,100,0.1)'; }}
               onBlur={e => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <select
               value={countryFilter}
               onChange={e => setCountryFilter(e.target.value)}
               style={{ height: 34, padding: '0 8px', border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 13, color: '#18181B', background: '#fff', fontFamily: 'var(--font-family-primary)', outline: 'none', cursor: 'pointer' }}
            >
               <option value="all">All Countries</option>
               {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
               value={deviceFilter}
               onChange={e => setDeviceFilter(e.target.value)}
               style={{ height: 34, padding: '0 8px', border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 13, color: '#18181B', background: '#fff', fontFamily: 'var(--font-family-primary)', outline: 'none', cursor: 'pointer' }}
            >
               <option value="all">All Devices</option>
               <option value="desktop">Desktop</option>
               <option value="mobile">Mobile</option>
            </select>
            {activeTab === 'discover' && (
               <select
                  value={scDateRange}
                  onChange={e => setSCDateRange(e.target.value)}
                  style={{ height: 34, padding: '0 8px', border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 13, color: '#18181B', background: '#fff', fontFamily: 'var(--font-family-primary)', outline: 'none', cursor: 'pointer' }}
               >
                  <option value="threeDays">Last 3 Days</option>
                  <option value="sevenDays">Last 7 Days</option>
                  <option value="thirtyDays">Last 30 Days</option>
               </select>
            )}
         </div>

         {/* ─── Batch action bars ──────────────────────────────────────── */}
         {hasBatchTracked && activeTab === 'tracked' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', marginBottom: 12, background: '#F8F9FF', border: '1px solid #E4E4E7', borderRadius: 10 }}>
               <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{selectedTracked.size} selected</span>
               <button type="button" onClick={handleBatchDelete} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #FFE0E0', background: '#FFF5F5', color: '#D32F2F', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Delete</button>
               <button type="button" onClick={() => handleBatchFav(true)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Favorite</button>
               <button type="button" onClick={() => handleBatchFav(false)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Unfavorite</button>
            </div>
         )}
         {hasBatchSC && activeTab === 'discover' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', marginBottom: 12, background: '#F8F9FF', border: '1px solid #E4E4E7', borderRadius: 10 }}>
               <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{selectedSC.size} selected</span>
               <button type="button" onClick={handleBatchTrack} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#2F2F34', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Track Selected</button>
            </div>
         )}

         {/* ─── Tab: Tracked Keywords ──────────────────────────────────── */}
         {activeTab === 'tracked' && (
            <div style={{ ...CARD, overflow: 'hidden' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                     <tr>
                        <th style={{ ...TH, width: 32 }}><input type="checkbox" checked={sortedTracked.length > 0 && selectedTracked.size === sortedTracked.length} onChange={selectAllTracked} style={{ cursor: 'pointer' }} /></th>
                        <th style={TH} onClick={() => toggleSort('keyword')}><span style={{ cursor: 'pointer', userSelect: 'none' }}>Keyword <SortIcon active={sortKey === 'keyword'} dir={sortKey === 'keyword' ? sortDir : null} /></span></th>
                        <th style={TH} onClick={() => toggleSort('position')}><span style={{ cursor: 'pointer', userSelect: 'none' }}>Position <SortIcon active={sortKey === 'position'} dir={sortKey === 'position' ? sortDir : null} /></span></th>
                        <th style={TH} onClick={() => toggleSort('volume')}><span style={{ cursor: 'pointer', userSelect: 'none' }}>Volume <SortIcon active={sortKey === 'volume'} dir={sortKey === 'volume' ? sortDir : null} /></span></th>
                        <th style={TH}>Country / Device</th>
                        <th style={TH}>Tags</th>
                        <th style={{ ...TH, width: 80 }}>Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {keywordsLoading ? (
                        [1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)
                     ) : sortedTracked.length === 0 ? (
                        <tr>
                           <td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '48px 12px', color: '#52525C' }}>
                              {search || countryFilter !== 'all' || deviceFilter !== 'all'
                                 ? 'No keywords match your filters.'
                                 : 'No keywords tracked yet. Add keywords or discover from Search Console.'}
                           </td>
                        </tr>
                     ) : (
                        sortedTracked.map(kw => (
                           <tr key={kw.id} style={{ background: selectedTracked.has(kw.id) ? '#FAFAFF' : 'transparent' }} className="kt-row">
                              <td style={{ ...TD, width: 32 }}><input type="checkbox" checked={selectedTracked.has(kw.id)} onChange={() => toggleTrackedSelect(kw.id)} style={{ cursor: 'pointer' }} /></td>
                              <td style={{ ...TD, fontWeight: 600 }}>
                                 {kw.sticky && <span style={{ color: '#F29964', marginRight: 4 }} title="Favorite">&#9733;</span>}
                                 {kw.keyword}
                              </td>
                              <td style={{ ...TD, fontWeight: 500 }}>
                                 {kw.position != null ? (
                                    <span style={{ color: kw.position <= 3 ? '#1AB25E' : kw.position <= 10 ? '#D97706' : '#52525C' }}>{kw.position}</span>
                                 ) : '—'}
                              </td>
                              <td style={TD}>{fmtVol(kw.volume)}</td>
                              <td style={TD}><span style={{ color: '#52525C' }}>{kw.country}</span> / <span style={{ color: '#9F9FA9' }}>{kw.device}</span></td>
                              <td style={TD}>
                                 <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {kw.tags.slice(0, 3).map((t, i) => (
                                       <span key={i} style={{ padding: '2px 8px', borderRadius: 9999, background: '#F4F4F5', fontSize: 11, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>{t}</span>
                                    ))}
                                 </div>
                              </td>
                              <td style={{ ...TD, width: 80 }}>
                                 <div className="kt-actions" style={{ display: 'flex', gap: 6, opacity: 0, transition: 'opacity 150ms' }}>
                                    <button type="button" onClick={() => favMutation.mutate({ keywordID: kw.id, sticky: !kw.sticky })} title={kw.sticky ? 'Unfavorite' : 'Favorite'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: kw.sticky ? '#F29964' : '#9F9FA9' }}>
                                       <svg width="14" height="14" viewBox="0 0 24 24" fill={kw.sticky ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                       </svg>
                                    </button>
                                    <button type="button" onClick={() => deleteMutation.mutate([kw.id])} title="Delete" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: '#9F9FA9' }}>
                                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                                       </svg>
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
               <style>{`.kt-row:hover .kt-actions { opacity: 1 !important; }`}</style>
            </div>
         )}

         {/* ─── Tab: Search Console Discover ───────────────────────────── */}
         {activeTab === 'discover' && (
            !isConsoleConnected ? (
               <div style={{ ...CARD, padding: '48px 24px', textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>Search Console Not Connected</h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                     Integrate Google Search Console to discover keywords your domain ranks for.{' '}
                     <a href="/settings" style={{ color: '#F29964', fontWeight: 600 }}>Go to Settings</a>
                  </p>
               </div>
            ) : (
               <div>
                  <div style={{ ...CARD, overflow: 'hidden' }}>
                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                           <tr>
                              <th style={{ ...TH, width: 32 }}><input type="checkbox" checked={aggregatedSC.length > 0 && selectedSC.size === aggregatedSC.length} onChange={selectAllSC} style={{ cursor: 'pointer' }} /></th>
                              <th style={TH}>Keyword</th>
                              <th style={TH}>Impressions</th>
                              <th style={TH}>Clicks</th>
                              <th style={TH}>CTR</th>
                              <th style={TH}>Avg Position</th>
                              <th style={{ ...TH, width: 80 }}>Track</th>
                           </tr>
                        </thead>
                        <tbody>
                           {scLoading ? (
                              [1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)
                           ) : aggregatedSC.length === 0 ? (
                              <tr>
                                 <td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '48px 12px', color: '#52525C' }}>No Search Console data for this domain yet.</td>
                              </tr>
                           ) : (
                              aggregatedSC.map(sc => {
                                 const isTracked = trackedSet.has(sc.keyword.trim().toLowerCase());
                                 return (
                                    <tr key={sc.uid} style={{ background: selectedSC.has(sc.uid) ? '#FAFAFF' : 'transparent' }} className="kt-row">
                                       <td style={{ ...TD, width: 32 }}><input type="checkbox" checked={selectedSC.has(sc.uid)} onChange={() => toggleSCSelect(sc.uid)} style={{ cursor: 'pointer' }} /></td>
                                       <td style={{ ...TD, fontWeight: 600 }}>{sc.keyword}</td>
                                       <td style={TD}>{sc.impressions.toLocaleString()}</td>
                                       <td style={TD}>{sc.clicks.toLocaleString()}</td>
                                       <td style={TD}>{(sc.ctr * 100).toFixed(2)}%</td>
                                       <td style={{ ...TD, fontWeight: 500 }}>
                                          <span style={{ color: sc.position <= 3 ? '#1AB25E' : sc.position <= 10 ? '#D97706' : '#52525C' }}>{sc.position}</span>
                                       </td>
                                       <td style={{ ...TD, width: 80 }}>
                                          {isTracked ? (
                                             <span style={{ fontSize: 12, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Tracked</span>
                                          ) : (
                                             <button
                                                type="button"
                                                onClick={() => handleTrackOne(sc)}
                                                className="kt-actions"
                                                style={{ opacity: 0, padding: '4px 10px', borderRadius: 6, border: '1px solid #D4D4D8', background: '#fff', color: '#52525C', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer', transition: 'all 150ms' }}
                                             >
                                                + Track
                                             </button>
                                          )}
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                        {/* Summary footer */}
                        {aggregatedSC.length > 0 && !scLoading && (
                           <tfoot>
                              <tr style={{ background: '#FAFAFA' }}>
                                 <td style={{ ...TD, fontWeight: 600 }} colSpan={2}>{scSummary.total} keywords</td>
                                 <td style={{ ...TD, fontWeight: 600 }}>{scSummary.totalImpressions.toLocaleString()}</td>
                                 <td style={{ ...TD, fontWeight: 600 }}>{scSummary.totalClicks.toLocaleString()}</td>
                                 <td style={{ ...TD, fontWeight: 600 }}>{(scSummary.overallCtr * 100).toFixed(2)}%</td>
                                 <td style={{ ...TD, fontWeight: 600 }}>{scSummary.avgPos}</td>
                                 <td style={TD} />
                              </tr>
                           </tfoot>
                        )}
                     </table>
                  </div>
               </div>
            )
         )}

         {/* ─── Add Keywords modal ─────────────────────────────────────── */}
         <CSSTransition in={showAddKeywords} timeout={300} classNames="modal_anim" unmountOnExit mountOnEnter>
            <AddKeywords
               keywords={trackedKeywords as unknown as KeywordType[]}
               scraperName={scraperName}
               allowsCity={allowsCity}
               closeModal={() => setShowAddKeywords(false)}
               domain={domainName}
            />
         </CSSTransition>
      </div>
   );
};

export default KeywordTrackerPanel;
