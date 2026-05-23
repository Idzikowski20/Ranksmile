import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';

// ─── Location list ────────────────────────────────────────────────────────────
const ALL_LOCATIONS = [
   { id: 'pl', label: 'Poland - Polish', flag: 'pl', languageCode: 'pl' },
   { id: 'pl-en', label: 'Poland - English', flag: 'pl', languageCode: 'en' },
   { id: 'de', label: 'Germany - German', flag: 'de', languageCode: 'de' },
   { id: 'de-en', label: 'Germany - English', flag: 'de', languageCode: 'en' },
   { id: 'gb', label: 'United Kingdom - English', flag: 'gb', languageCode: 'en' },
   { id: 'us', label: 'United States - English', flag: 'us', languageCode: 'en' },
   { id: 'fr', label: 'France - French', flag: 'fr', languageCode: 'fr' },
   { id: 'es', label: 'Spain - Spanish', flag: 'es', languageCode: 'es' },
   { id: 'it', label: 'Italy - Italian', flag: 'it', languageCode: 'it' },
   { id: 'nl', label: 'Netherlands - Dutch', flag: 'nl', languageCode: 'nl' },
   { id: 'cz', label: 'Czech Republic - Czech', flag: 'cz', languageCode: 'cs' },
   { id: 'hu', label: 'Hungary - Hungarian', flag: 'hu', languageCode: 'hu' },
   { id: 'ro', label: 'Romania - Romanian', flag: 'ro', languageCode: 'ro' },
   { id: 'pt', label: 'Portugal - Portuguese', flag: 'pt', languageCode: 'pt' },
   { id: 'se', label: 'Sweden - Swedish', flag: 'se', languageCode: 'sv' },
];
const DEFAULT_VISIBLE = 5;

function parseGSCSiteUrl(siteUrl: string): string {
   if (siteUrl.startsWith('sc-domain:')) return siteUrl.replace('sc-domain:', '');
   try { return new URL(siteUrl).hostname; } catch { return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, ''); }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const ChevronIcon = ({ open, size = 18 }: { open: boolean; size?: number }) => (
   <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor"
      style={{ color: '#9F9FA9', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);

type SortKey = 'url' | 'clicks' | 'impressions';
type SortDir = 'asc' | 'desc';

// Sort indicator icon
const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
   <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor"
      style={{ flexShrink: 0, color: active ? '#09090B' : '#D4D4D8', marginLeft: 3 }}>
      {dir === 'asc'
         ? <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
         : <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" />
      }
   </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
const ConfigureSite: NextPage = () => {
   const router = useRouter();
   const { siteUrl } = router.query;

   const rawSiteUrl = Array.isArray(siteUrl) ? siteUrl[0] : (siteUrl || '');
   const domain = rawSiteUrl ? parseGSCSiteUrl(rawSiteUrl) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];

   // ── State ──────────────────────────────────────────────────────────────────
   const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
   const [locationOpen, setLocationOpen] = useState(true);
   const [showMoreLocations, setShowMoreLocations] = useState(false);
   const [pagesOpen, setPagesOpen] = useState(false);
   const [modalOpen, setModalOpen] = useState(false);
   const [selectedPages, setSelectedPages] = useState<string[]>([]);
   const [confirmedPages, setConfirmedPages] = useState<string[]>([]);
   const [modalSearch, setModalSearch] = useState('');
   const [sortKey, setSortKey] = useState<SortKey>('clicks');
   const [sortDir, setSortDir] = useState<SortDir>('desc');
   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState('');

   // ── GSC pages fetch ────────────────────────────────────────────────────────
   const { data: gscData, isLoading: gscLoading } = useQuery(
      ['gsc-pages', rawSiteUrl],
      async () => {
         const res = await fetch(`/api/gsc/pages?siteUrl=${encodeURIComponent(rawSiteUrl)}`);
         return res.json();
      },
      { enabled: !!rawSiteUrl && modalOpen, staleTime: 5 * 60 * 1000 },
   );

   const allGscPages: { url: string; clicks: number; impressions: number }[] = gscData?.pages || [];

   const filteredGscPages = useMemo(() => {
      let rows = allGscPages;
      if (modalSearch.trim()) {
         const q = modalSearch.toLowerCase();
         rows = rows.filter((p) => p.url.toLowerCase().includes(q));
      }
      return [...rows].sort((a, b) => {
         if (sortKey === 'url') {
            return sortDir === 'asc' ? a.url.localeCompare(b.url) : b.url.localeCompare(a.url);
         }
         const va = a[sortKey];
         const vb = b[sortKey];
         return sortDir === 'asc' ? va - vb : vb - va;
      });
   }, [allGscPages, modalSearch, sortKey, sortDir]);

   const handleSort = (key: SortKey) => {
      if (sortKey === key) {
         setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
         setSortKey(key);
         setSortDir(key === 'url' ? 'asc' : 'desc');
      }
   };

   // ── Handlers ───────────────────────────────────────────────────────────────
   const handleSelectLocation = (id: string) => {
      setSelectedLocation(id);
      setLocationOpen(false);
      setPagesOpen(true);
   };

   const handleModalTogglePage = (url: string) => {
      setSelectedPages((prev) =>
         prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
      );
   };

   const handleModalSelectAll = () => {
      const allUrls = filteredGscPages.map((p) => p.url);
      const allSelected = allUrls.every((u) => selectedPages.includes(u));
      if (allSelected) {
         setSelectedPages((prev) => prev.filter((u) => !allUrls.includes(u)));
      } else {
         setSelectedPages((prev) => Array.from(new Set([...prev, ...allUrls])));
      }
   };

   const handleAddSelected = () => {
      setConfirmedPages(selectedPages);
      setModalOpen(false);
      setModalSearch('');
   };

   const handleOpenModal = () => {
      // Pre-fill modal selection with already confirmed pages
      setSelectedPages(confirmedPages);
      setModalOpen(true);
      setModalSearch('');
   };

   const handleCloseModal = () => {
      // Revert selection to confirmed
      setSelectedPages(confirmedPages);
      setModalOpen(false);
      setModalSearch('');
   };

   const selectedLoc = ALL_LOCATIONS.find((l) => l.id === selectedLocation);

   const handleSubmit = async () => {
      if (!selectedLocation || submitting) return;
      setSubmitting(true);
      setError('');
      const languageCode = selectedLoc?.languageCode || 'pl';
      try {
         const res = await fetch('/api/domains/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, language: languageCode, pages: confirmedPages }),
         });
         if (!res.ok) {
            const data = await res.json();
            setError(data.error || 'Failed to configure site');
            setSubmitting(false);
            return;
         }
         const data = await res.json();

         // Trigger deep analysis for all configured pages in background
         fetch('/api/articles/analyze-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domainId: data.domainId }),
         }).catch(() => {});

         router.push(`/sites/${data.domainSlug}/performance`);
      } catch (e: any) {
         setError(e?.message || 'Network error');
         setSubmitting(false);
      }
   };

   const visibleLocations = showMoreLocations ? ALL_LOCATIONS : ALL_LOCATIONS.slice(0, DEFAULT_VISIBLE);
   const allFilteredSelected = filteredGscPages.length > 0 && filteredGscPages.every((p) => selectedPages.includes(p.url));

   useEffect(() => {
      if (modalOpen) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
   }, [modalOpen]);

   return (
      <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>Configure {domain} — SerpBear</title>
         </Head>

         <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: '0 16px 48px' }} className="styled-scrollbar">
            <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 24 }}>

               {/* ─── Back + Heading ─── */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <Link href="/sites" passHref>
                     <a style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#F4F4F5', color: '#52525C', textDecoration: 'none', flexShrink: 0 }}>
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                           <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10" clipRule="evenodd" />
                        </svg>
                     </a>
                  </Link>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
                     Configure
                     {domain && (
                        <>
                           <img alt="" style={{ width: 20, height: 20, borderRadius: 4 }} src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} />
                           <span>{domain}</span>
                        </>
                     )}
                  </div>
               </div>

               {/* ── Accordion 1: Select location ── */}
               <div style={{ borderRadius: 12, border: `1px solid ${locationOpen ? 'transparent' : '#E4E4E7'}`, background: locationOpen ? '#F8F8F9' : '#fff', overflow: 'hidden' }}>
                  <div
                     style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', cursor: selectedLocation ? 'pointer' : 'default', gap: 12 }}
                     onClick={() => { if (selectedLocation) setLocationOpen((v) => !v); }}
                  >
                     <span style={{ flexGrow: 1, fontSize: 16, fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>
                        Select location
                     </span>
                     {selectedLocation && !locationOpen && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <img alt={selectedLoc?.flag} style={{ width: 24, height: 18, borderRadius: 2, objectFit: 'cover' }} src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${selectedLoc?.flag}.svg`} />
                           <span style={{ fontSize: 13, fontWeight: 500, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>{selectedLoc?.label}</span>
                        </div>
                     )}
                     {selectedLocation && <ChevronIcon open={locationOpen} />}
                  </div>

                  {locationOpen && (
                     <div style={{ padding: '0 24px 24px' }}>
                        <p style={{ fontSize: 14, lineHeight: '20px', color: '#52525C', margin: 0, fontFamily: 'var(--font-family-primary)' }}>
                           What is the main location you are targeting with this site? We will use it to provide guidelines for new content and audit your existing content against it.
                        </p>
                        <div style={{ height: 1, background: '#E4E4E7', margin: '16px 0' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                           {visibleLocations.map((loc) => (
                              <div
                                 key={loc.id}
                                 style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', boxShadow: selectedLocation === loc.id ? 'inset 0 0 0 2px #783AFB' : 'inset 0 0 0 1px #E4E4E7', transition: 'box-shadow 0.15s' }}
                                 onClick={() => handleSelectLocation(loc.id)}
                              >
                                 <img alt={`${loc.flag} flag`} style={{ width: 28, height: 21, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} src={`https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${loc.flag}.svg`} />
                                 <span style={{ fontSize: 14, fontWeight: 500, color: '#2F2F34', fontFamily: 'var(--font-family-primary)', flexGrow: 1 }}>{loc.label}</span>
                                 <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedLocation === loc.id ? '#783AFB' : '#D4D4D8'}`, background: selectedLocation === loc.id ? '#783AFB' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {selectedLocation === loc.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                 </div>
                              </div>
                           ))}
                        </div>
                        <button
                           type="button"
                           style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: '12px 0 0', fontSize: 14, fontWeight: 600, color: '#52525C', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                           onClick={() => setShowMoreLocations((v) => !v)}
                        >
                           {showMoreLocations ? 'Show less' : 'Show more'}
                           <ChevronIcon open={showMoreLocations} />
                        </button>
                     </div>
                  )}
               </div>

               {/* ── Accordion 2: Pages ── */}
               <div style={{ borderRadius: 12, border: `1px solid ${pagesOpen ? 'transparent' : '#E4E4E7'}`, background: pagesOpen ? '#F8F8F9' : '#fff', overflow: 'hidden', opacity: !selectedLocation ? 0.5 : 1, pointerEvents: !selectedLocation ? 'none' : 'auto' }}>
                  <div
                     style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', cursor: selectedLocation ? 'pointer' : 'default', gap: 12 }}
                     onClick={() => { if (selectedLocation) setPagesOpen((v) => !v); }}
                  >
                     <span style={{ flexGrow: 1, fontSize: 16, fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}>Pages</span>
                     {confirmedPages.length > 0 && !pagesOpen && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                           <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#3B82F6" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" />
                           </svg>
                           <span style={{ fontSize: 13, fontWeight: 500, color: '#3B82F6', fontFamily: 'var(--font-family-primary)' }}>
                              {confirmedPages.length} pages selected manually
                           </span>
                        </div>
                     )}
                     {selectedLocation && <ChevronIcon open={pagesOpen} />}
                  </div>

                  {pagesOpen && selectedLocation && (
                     <div style={{ padding: '0 24px 24px' }}>
                        <p style={{ fontSize: 14, lineHeight: '20px', color: '#52525C', margin: 0, fontFamily: 'var(--font-family-primary)' }}>
                           Add the most important pages from this site. These will be used for content auditing and topical mapping.
                        </p>
                        <div style={{ height: 1, background: '#E4E4E7', margin: '16px 0' }} />

                        {confirmedPages.length > 0 && (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                              {confirmedPages.map((url) => (
                                 <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #E4E4E7' }}>
                                    <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="#3B82F6" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                       <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" />
                                    </svg>
                                    <span style={{ flex: 1, fontSize: 13, color: '#2F2F34', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                                    <button
                                       type="button"
                                       onClick={() => setConfirmedPages((prev) => prev.filter((u) => u !== url))}
                                       style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#9F9FA9', display: 'flex', alignItems: 'center' }}
                                    >
                                       <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" /></svg>
                                    </button>
                                 </div>
                              ))}
                           </div>
                        )}

                        <button
                           type="button"
                           onClick={handleOpenModal}
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: '1px solid #E4E4E7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#2F2F34', fontFamily: 'var(--font-family-primary)' }}
                        >
                           <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9" />
                           </svg>
                           {confirmedPages.length > 0 ? `${confirmedPages.length} pages selected — edit` : 'Select pages manually'}
                        </button>
                     </div>
                  )}
               </div>

               {/* ─── Error ─── */}
               {error && (
                  <p style={{ fontSize: 14, color: '#EF4444', margin: 0, fontFamily: 'var(--font-family-primary)' }}>{error}</p>
               )}

               {/* ─── Cancel / Finish — shown only after pages confirmed ─── */}
               {confirmedPages.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                     <Link href="/sites" passHref>
                        <a style={{
                           display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                           height: 40, padding: '0 20px',
                           border: '1px solid #E4E4E7', borderRadius: 8,
                           fontSize: 14, fontWeight: 600, color: '#2F2F34',
                           textDecoration: 'none', fontFamily: 'var(--font-family-primary)',
                           background: '#fff',
                        }}>
                           Cancel
                        </a>
                     </Link>
                     <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                           height: 40, padding: '0 24px',
                           border: 'none', borderRadius: 8,
                           background: submitting ? '#E4E4E7' : '#09090B',
                           color: submitting ? '#9F9FA9' : '#fff',
                           fontSize: 14, fontWeight: 600,
                           cursor: submitting ? 'not-allowed' : 'pointer',
                           fontFamily: 'var(--font-family-primary)',
                           transition: 'background 0.15s',
                        }}
                     >
                        {submitting ? 'Configuring…' : 'Finish'}
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* ─── Pages Modal (slide-in drawer) ─────────────────────────────────────── */}
         {modalOpen && (
            <>
               {/* Overlay */}
               <div onClick={handleCloseModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }} />

               {/* Panel */}
               <div style={{
                  position: 'fixed', top: 8, right: 8, bottom: 8,
                  width: 800, maxWidth: 'calc(100vw - 16px)',
                  background: '#fff', borderRadius: 12,
                  zIndex: 51, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  animation: 'slideInRight 0.22s ease',
               }}>

                  {/* Panel Header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #F4F4F5', gap: 12, flexShrink: 0 }}>
                     <span style={{ fontSize: 16, fontWeight: 700, color: '#09090B', fontFamily: 'var(--font-family-primary)', flexGrow: 1 }}>Select pages</span>
                     {allGscPages.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                              {selectedPages.length} / {allGscPages.length} available
                           </span>
                           <div style={{ width: 80, height: 4, borderRadius: 4, background: '#F4F4F5', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#EAB308', borderRadius: 4, width: `${allGscPages.length > 0 ? (selectedPages.length / allGscPages.length) * 100 : 0}%`, transition: 'width 0.2s' }} />
                           </div>
                        </div>
                     )}
                     <button type="button" onClick={handleCloseModal} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9F9FA9', display: 'flex', padding: 4, borderRadius: 6 }}>
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
                           <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" />
                        </svg>
                     </button>
                  </div>

                  {/* Sub-header */}
                  <div style={{ padding: '12px 24px', borderBottom: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                     <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)', flexGrow: 1 }}>
                        {gscLoading ? 'Loading pages…' : `Found ${allGscPages.length} pages`}
                     </span>
                     <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9F9FA9' }}>
                           <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
                           </svg>
                        </div>
                        <input
                           type="text"
                           placeholder="Search pages"
                           value={modalSearch}
                           onChange={(e) => setModalSearch(e.target.value)}
                           style={{ width: 220, height: 32, paddingLeft: 30, paddingRight: 10, border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, color: '#09090B', background: '#fff', outline: 'none', fontFamily: 'var(--font-family-primary)' }}
                        />
                     </div>
                  </div>

                  {/* Table header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px', borderBottom: '1px solid #F4F4F5', background: '#FAFAFA', flexShrink: 0 }}>
                     <div style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <input
                           type="checkbox"
                           checked={allFilteredSelected && filteredGscPages.length > 0}
                           onChange={handleModalSelectAll}
                           style={{ accentColor: '#783AFB', cursor: 'pointer', width: 15, height: 15 }}
                        />
                     </div>
                     {/* URL column header — sortable */}
                     <div
                        style={{ flex: 1, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('url')}
                     >
                        <span style={{ fontSize: 12, fontWeight: 600, color: sortKey === 'url' ? '#09090B' : '#71717B', fontFamily: 'var(--font-family-primary)' }}>Page URL</span>
                        <SortIcon active={sortKey === 'url'} dir={sortKey === 'url' ? sortDir : 'desc'} />
                     </div>
                     {/* Traffic column header — sortable */}
                     <div
                        style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('clicks')}
                     >
                        <span style={{ fontSize: 12, fontWeight: 600, color: sortKey === 'clicks' ? '#09090B' : '#71717B', fontFamily: 'var(--font-family-primary)' }}>Traffic</span>
                        <SortIcon active={sortKey === 'clicks'} dir={sortKey === 'clicks' ? sortDir : 'desc'} />
                     </div>
                     {/* Impressions column header — sortable */}
                     <div
                        style={{ width: 110, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('impressions')}
                     >
                        <span style={{ fontSize: 12, fontWeight: 600, color: sortKey === 'impressions' ? '#09090B' : '#71717B', fontFamily: 'var(--font-family-primary)' }}>Impressions</span>
                        <SortIcon active={sortKey === 'impressions'} dir={sortKey === 'impressions' ? sortDir : 'desc'} />
                     </div>
                  </div>

                  {/* Table body */}
                  <div style={{ flex: 1, overflowY: 'auto' }} className="styled-scrollbar">
                     {gscLoading ? (
                        <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                           Loading pages from Search Console…
                        </div>
                     ) : filteredGscPages.length === 0 ? (
                        <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>
                           {allGscPages.length === 0 ? 'No pages found in Search Console for this site.' : 'No pages match your search.'}
                        </div>
                     ) : (
                        filteredGscPages.map((page, i) => {
                           const checked = selectedPages.includes(page.url);
                           return (
                              <div
                                 key={page.url}
                                 onClick={() => handleModalTogglePage(page.url)}
                                 style={{
                                    display: 'flex', alignItems: 'center',
                                    padding: '10px 24px',
                                    borderBottom: i < filteredGscPages.length - 1 ? '1px solid #F4F4F5' : 'none',
                                    cursor: 'pointer',
                                    background: checked ? '#F5F0FF' : '#fff',
                                    transition: 'background 0.1s',
                                 }}
                              >
                                 <div style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                    <input
                                       type="checkbox"
                                       checked={checked}
                                       onChange={() => handleModalTogglePage(page.url)}
                                       onClick={(e) => e.stopPropagation()}
                                       style={{ accentColor: '#783AFB', cursor: 'pointer', width: 15, height: 15 }}
                                    />
                                 </div>
                                 <div style={{ flex: 1, fontSize: 13, color: '#09090B', fontFamily: 'var(--font-family-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>
                                    {page.url}
                                 </div>
                                 <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                                    {page.clicks > 0 ? page.clicks.toLocaleString() : '—'}
                                 </div>
                                 <div style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                                    {page.impressions > 0 ? page.impressions.toLocaleString() : '—'}
                                 </div>
                              </div>
                           );
                        })
                     )}
                  </div>

                  {/* Floating bottom bar */}
                  {selectedPages.length > 0 && (
                     <div style={{ padding: '12px 24px', background: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#fff', fontFamily: 'var(--font-family-primary)' }}>
                           {selectedPages.length} {selectedPages.length === 1 ? 'page' : 'pages'} selected
                        </span>
                        <button
                           type="button"
                           onClick={handleAddSelected}
                           style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#783AFB', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                        >
                           Add selected
                        </button>
                     </div>
                  )}
               </div>
            </>
         )}

         <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideInRight {
               from { transform: translateX(100%); }
               to { transform: translateX(0); }
            }
         ` }} />
      </DashboardLayout>
   );
};

export default ConfigureSite;
