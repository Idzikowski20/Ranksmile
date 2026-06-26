import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { SETUP_LOCATIONS, type SetupLocation } from '../lib/setupLocations';
import GlobalTopbar from '../components/common/GlobalTopbar';

// ─── Shared button classes (Surfer canonical, from invite/[token].tsx) ────────
const btnBase =
   'gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none';

const btnPrimary = `${btnBase} px-lg py-sm rounded-lg text-base bg-gray-base text-white-base w-full hover:bg-purple-base active:bg-purple-100`;
const btnSecondary = `${btnBase} px-lg py-sm rounded-lg text-base bg-gray-10 text-gray-base hover:bg-gray-20 active:bg-gray-40`;
const btnLink = `${btnBase} text-md rounded-none bg-transparent p-0 text-gray-100 hover:text-gray-120 active:text-gray-160`;

// ─── Domain normaliser ────────────────────────────────────────────────────────
function normalizeDomain(raw: string): string {
   let s = raw.trim();
   // handle sc-domain: prefix (Google Search Console property type)
   if (s.startsWith('sc-domain:')) s = s.slice('sc-domain:'.length);
   // strip scheme
   s = s.replace(/^https?:\/\//, '');
   // strip trailing slash
   s = s.replace(/\/+$/, '');
   return s;
}

// ─── Google logo SVG (verbatim from markup) ───────────────────────────────────
const GoogleIcon = () => (
   <svg
      width="1.2em"
      height="1.2em"
      id="icon-google"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block align-sub text-inherit size-base shrink-0"
   >
      <g clipPath="url(#clip0)">
         <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
         <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
         <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
         <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
      </g>
      <defs>
         <clipPath id="clip0">
            <rect width="15.6825" height="16" fill="white" />
         </clipPath>
      </defs>
   </svg>
);

// ─── Chevron down SVG (verbatim from markup) ──────────────────────────────────
const ChevronDown = ({ open }: { open: boolean }) => (
   <span
      className="text-gray-base ml-auto inline-flex shrink-0 cursor-pointer transition-transform duration-200 ease-out"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
   >
      <svg viewBox="0 0 20 20" width="1.2em" height="1.2em" className="inline-block shrink-0 align-sub text-inherit" style={{ width: 20, height: 20 }}>
         <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
      </svg>
   </span>
);

// ─── Site favicon (background-image avoids the <img> lint rule) ────────────────
const SiteFavicon = ({ domain }: { domain: string }) => (
   <span
      aria-hidden="true"
      style={{
         width: 18, height: 18, borderRadius: 4, flexShrink: 0,
         backgroundColor: '#f4f4f5',
         backgroundImage: `url(https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32)`,
         backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }}
   />
);

// ─── Country flag (flag-icons CDN; emoji flags don't render on Windows) ────────
const Flag = ({ cc }: { cc: string }) => (
   <span
      aria-hidden="true"
      style={{
         display: 'inline-block', width: 20, height: 15, flexShrink: 0, borderRadius: 2,
         backgroundColor: '#f4f4f5',
         backgroundImage: `url(https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/${cc}.svg)`,
         backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }}
   />
);

// ─── Spinner (loading states) ──────────────────────────────────────────────────
const Spinner = ({ size = 16, color = '#9F9FA9' }: { size?: number; color?: string }) => (
   <span
      aria-hidden="true"
      style={{
         display: 'inline-block', width: size, height: size, flexShrink: 0,
         border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: 9999,
         animation: 'spin 0.7s linear infinite',
      }}
   />
);

// ─── Filled check (GSC benefit bullets) ───────────────────────────────────────
const CheckCircle = () => (
   <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 9999, background: '#18181b', flexShrink: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
         <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   </span>
);

// ─── Step progress dots ───────────────────────────────────────────────────────
// Step 1: dot1 = orange/wide, dot2 = gray/narrow
// Step 2: dot1 = gray/narrow, dot2 = orange/wide
function StepDots({ step }: { step: 1 | 2 }) {
   return (
      <div className="gap-2xs flex items-center">
         <div
            className="h-xs rounded-full"
            style={{
               backgroundColor: step === 1 ? '#F97316' : '#e4e4e7',
               width: step === 1 ? '1rem' : '0.375rem',
            }}
         />
         <div
            className="h-xs rounded-full"
            style={{
               backgroundColor: step === 2 ? '#F97316' : '#e4e4e7',
               width: step === 2 ? '1rem' : '0.375rem',
            }}
         />
      </div>
   );
}

// ─── App brand mark for the topbar (no workspace switcher on the creator) ──────
const SetupLogo = () => (
   <a href="/" aria-label="Home" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, background: '#783AFB', flexShrink: 0 }}>
         <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
         </svg>
      </span>
   </a>
);

// Standalone creator chrome: dark GlobalTopbar (brand mark, no switcher / no sidebar)
// above the white wizard body.
const SetupShell = ({ title, children }: { title: string; children: ReactNode }) => (
   <>
      <Head>
         <title>{title}</title>
         <meta name="robots" content="noindex" />
      </Head>
      <div className="relative flex flex-col overflow-hidden" style={{ minHeight: '100dvh' }}>
         <GlobalTopbar breadcrumb={<SetupLogo />} />
         <div className="p-sm flex flex-1 flex-col overflow-hidden">
            {children}
         </div>
      </div>
   </>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const SetupPage: NextPage = () => {
   const router = useRouter();

   // ── Workspace ID resolution ────────────────────────────────────────────
   const [wsId, setWsId] = useState<number | null>(null);

   useEffect(() => {
      if (!router.isReady) return;

      // asPath carries the full browser URL e.g. /workspace/1234-slug/setup
      const fromPath = parseWorkspaceId(router.asPath);
      if (fromPath) {
         setWsId(fromPath);
         return;
      }
      // Fallback: GET /api/workspaces → activeId
      fetch('/api/workspaces')
         .then((r) => r.json())
         .then((data) => {
            const active = data?.activeId ?? null;
            if (active) {
               setWsId(Number(active));
            } else {
               router.replace('/');
            }
         })
         .catch(() => router.replace('/'));
   }, [router.isReady, router.asPath]);

   // ── Wizard state ───────────────────────────────────────────────────────
   const [step, setStep] = useState<1 | 2>(1);
   const [domain, setDomain] = useState<string | null>(null);

   // Step 1
   const [gscSites, setGscSites] = useState<{ siteUrl: string }[]>([]);
   const [gscLoaded, setGscLoaded] = useState(false);
   const [siteFilter, setSiteFilter] = useState('');
   const [selectedSite, setSelectedSite] = useState('');
   const [comboOpen, setComboOpen] = useState(false);
   const [urlMode, setUrlMode] = useState(false);
   const [urlInput, setUrlInput] = useState('');
   const [configuring, setConfiguring] = useState(false);
   const [step1Error, setStep1Error] = useState('');
   // location + language (shown after a domain is chosen)
   const [location, setLocation] = useState<SetupLocation | null>(null);
   const [locOpen, setLocOpen] = useState(false);
   const [locFilter, setLocFilter] = useState('');

   // Step 2
   const [brandName, setBrandName] = useState('');
   const [brandKnowledge, setBrandKnowledge] = useState('');
   const [loadingBrand, setLoadingBrand] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [step2Error, setStep2Error] = useState('');

   const comboRef = useRef<HTMLDivElement>(null);
   const locRef = useRef<HTMLDivElement>(null);
   const brandNameRef = useRef<HTMLInputElement>(null);

   // ── Fetch GSC sites on mount ───────────────────────────────────────────
   useEffect(() => {
      fetch('/api/gsc/sites')
         .then((r) => r.json())
         .then((data) => {
            setGscSites(Array.isArray(data?.sites) ? data.sites : []);
         })
         .catch(() => {
            setGscSites([]);
         })
         .finally(() => setGscLoaded(true));
   }, []);

   const connectGsc = () => {
      if (typeof window !== 'undefined') {
         window.location.href = `/api/gsc/connect?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
   };

   // ── Close the open dropdown on outside click ───────────────────────────
   useEffect(() => {
      if (!comboOpen && !locOpen) return undefined;
      const handler = (e: MouseEvent) => {
         const t = e.target as Node;
         if (comboOpen && comboRef.current && !comboRef.current.contains(t)) setComboOpen(false);
         if (locOpen && locRef.current && !locRef.current.contains(t)) setLocOpen(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
   }, [comboOpen, locOpen]);

   // ── Choose a domain — records the selection but does NOT submit; the
   //    location/language step + Continue does (so the language is picked first). ──
   const chooseDomain = (displayValue: string) => {
      const d = normalizeDomain(displayValue);
      if (!d) return;
      setSelectedSite(displayValue);
      setDomain(d);
      setUrlMode(false);
      setComboOpen(false);
      setStep1Error('');
   };
   const handleSiteSelect = (siteUrl: string) => chooseDomain(siteUrl);
   const handleUrlSubmit = () => { if (urlInput.trim()) chooseDomain(urlInput.trim()); };

   // ── Configure the chosen domain (with the chosen language) + go to step 2 ──
   const submitChosen = async () => {
      if (!domain || !location || configuring) return;
      setStep1Error('');
      setConfiguring(true);
      try {
         const res = await fetch('/api/domains/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, language: location.code }),
         });
         if (res.ok) {
            setStep(2);
            setLoadingBrand(true);
            fetch('/api/brand-knowledge', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ url: domain }),
            })
               .then((r) => r.json())
               .then((data) => {
                  if (data?.brandName) setBrandName(data.brandName);
                  if (data?.brandKnowledge) setBrandKnowledge(data.brandKnowledge);
               })
               .catch(() => { /* leave fields empty */ })
               .finally(() => setLoadingBrand(false));
         } else {
            const err = await res.json().catch(() => ({}));
            setStep1Error(err?.error || 'Failed to configure domain. Please try again.');
         }
      } catch {
         setStep1Error('Network error. Please try again.');
      } finally {
         setConfiguring(false);
      }
   };

   // ── Finish (step 2 submit) ─────────────────────────────────────────────
   const handleFinish = async () => {
      if (!brandName.trim()) {
         brandNameRef.current?.focus();
         return;
      }
      if (!wsId) return;
      setStep2Error('');
      setSubmitting(true);
      try {
         const res = await fetch(`/api/workspaces/${wsId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandName, brandKnowledge }),
         });
         if (res.ok) {
            router.replace(`/workspace/${wsId}/dashboard`);
         } else {
            const err = await res.json().catch(() => ({}));
            setStep2Error(err?.error || 'Failed to finish setup. Please try again.');
         }
      } catch {
         setStep2Error('Network error. Please try again.');
      } finally {
         setSubmitting(false);
      }
   };

   // ── Guard: wsId not yet resolved ───────────────────────────────────────
   if (!wsId && router.isReady) return null;

   // ─────────────────────────────────────────────────────────────────────
   // STEP 1 — Create a new workspace
   // ─────────────────────────────────────────────────────────────────────
   if (step === 1) {
      return (
         <SetupShell title="Create a new workspace · SerpBear">
            <div
               data-scroll-element="true"
               className="relative flex-1 overflow-auto rounded-xl [color-scheme:light] px-base sm:px-lg bg-white-base"
            >
                  <div className="pb-md mx-auto flex w-full flex-col items-center justify-center self-center gap-lg" style={{ maxWidth: 400, paddingTop: '3rem' }}>
                     <div className="gap-2xl flex w-full flex-col justify-center">
                        <StepDots step={1} />
                        <div className="gap-md flex w-full flex-col justify-center">
                           <h2 className="m-0 text-lg font-semibold">
                              {gscLoaded && gscSites.length > 0 ? 'Create a new workspace' : 'Set up your workspace'}
                           </h2>
                           <span style={{ color: '#71717a' }}>
                              Workspace is used for a brand you own or manage. You can add workspaces for more brands later.
                           </span>
                        </div>
                     </div>

                     <form className="gap-lg flex w-full flex-col" onSubmit={(e) => e.preventDefault()}>
                        <div className="gap-md flex w-full flex-col">
                           <div className="flex w-full flex-col" ref={comboRef}>
                              {/* eslint-disable-next-line no-nested-ternary */}
                              {domain ? (
                                 <>
                                    <div className="text-md pb-xs font-medium text-gray-100">Select Search Console site</div>
                                    <button
                                       type="button"
                                       onClick={() => { setDomain(null); setSelectedSite(''); setLocation(null); setStep1Error(''); }}
                                       className="border-gray-40 bg-white-base gap-sm px-md text-md flex h-[40px] w-full cursor-pointer items-center rounded-lg border border-solid text-left font-sans hover:border-gray-60"
                                       style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                    >
                                       <SiteFavicon domain={domain} />
                                       <span className="min-w-0 flex-1 truncate text-gray-base">{domain}</span>
                                       <div className="ml-auto flex items-center"><ChevronDown open={false} /></div>
                                    </button>
                                 </>
                              ) : !urlMode ? (
                                 // eslint-disable-next-line no-nested-ternary
                                 !gscLoaded ? (
                                    <div className="border-gray-40 bg-white-base flex h-[40px] w-full items-center rounded-lg border px-md" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                       <span className="text-gray-60 text-md">Loading…</span>
                                    </div>
                                 ) : gscSites.length > 0 ? (
                                    <>
                                       <div className="text-md pb-xs font-medium text-gray-100">Select Search Console site</div>
                                       <button
                                          type="button"
                                          role="combobox"
                                          aria-expanded={comboOpen}
                                          aria-haspopup="dialog"
                                          onClick={() => setComboOpen((o) => !o)}
                                          disabled={configuring}
                                          className="border-gray-40 bg-white-base gap-sm px-md text-md flex h-[40px] w-full cursor-pointer items-center rounded-lg border border-solid text-left font-sans leading-normal outline-2 outline-offset-[4px] outline-transparent transition-[outline-color,border-color] duration-200 hover:border-gray-60 focus-visible:border-gray-80 focus-visible:outline-purple-40 disabled:bg-gray-10 disabled:cursor-not-allowed disabled:opacity-60"
                                          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                       >
                                          <GoogleIcon />
                                          <span className="min-w-0 flex-1 truncate">
                                             {selectedSite ? (
                                                <span className="flex-1 truncate text-gray-base">{normalizeDomain(selectedSite)}</span>
                                             ) : (
                                                <span className="text-gray-60 flex-1 truncate">Select site</span>
                                             )}
                                          </span>
                                          <div className="ml-auto flex items-center">
                                             <ChevronDown open={comboOpen} />
                                          </div>
                                       </button>
                                       {comboOpen && (
                                          <div
                                             className="border-gray-20 bg-white-base mt-xs rounded-lg border"
                                             style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', position: 'absolute', zIndex: 50, width: '100%', maxWidth: 400, overflow: 'hidden' }}
                                          >
                                             <div className="p-xs">
                                                <input
                                                   type="text"
                                                   autoFocus
                                                   value={siteFilter}
                                                   onChange={(e) => setSiteFilter(e.target.value)}
                                                   placeholder="Search sites"
                                                   className="border-gray-40 bg-white-base text-md h-[36px] w-full rounded-lg border px-md outline-none focus:border-purple-40"
                                                   style={{ fontFamily: 'var(--font-family-primary)' }}
                                                />
                                             </div>
                                             <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                                {gscSites
                                                   .filter((site) => normalizeDomain(site.siteUrl).toLowerCase().includes(siteFilter.trim().toLowerCase()))
                                                   .map((site) => {
                                                      const dom = normalizeDomain(site.siteUrl);
                                                      return (
                                                         <button
                                                            key={site.siteUrl}
                                                            type="button"
                                                            className="gap-sm flex w-full items-center px-md py-sm text-left text-md hover:bg-gray-10"
                                                            onClick={() => handleSiteSelect(site.siteUrl)}
                                                         >
                                                            <SiteFavicon domain={dom} />
                                                            <span className="min-w-0 flex-1 truncate text-gray-base">{dom}</span>
                                                         </button>
                                                      );
                                                   })}
                                             </div>
                                             <button
                                                type="button"
                                                onClick={connectGsc}
                                                className="border-gray-20 gap-sm flex w-full items-center border-t px-md py-sm text-left text-md font-medium hover:bg-gray-10"
                                                style={{ color: '#18181b' }}
                                             >
                                                <GoogleIcon />
                                                <span>Add another Search Console account</span>
                                             </button>
                                          </div>
                                       )}
                                    </>
                                 ) : (
                                    // GSC not connected → benefits + connect CTA (no combobox)
                                    <div className="gap-base flex w-full flex-col rounded-xl p-base" style={{ background: '#f4f4f5' }}>
                                       <button
                                          type="button"
                                          onClick={connectGsc}
                                          className="gap-sm text-base flex h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border-none font-sans font-semibold"
                                          style={{ background: '#18181b', color: '#fff' }}
                                       >
                                          <GoogleIcon />
                                          <span>Connect Search Console</span>
                                       </button>
                                       <div className="gap-sm flex flex-col">
                                          {['Automatic keyword selection', 'Access real traffic and performance data', 'Content ideas based on deep topical analysis'].map((t) => (
                                             <div key={t} className="gap-sm text-md flex items-center" style={{ color: '#3f3f47' }}>
                                                <CheckCircle />
                                                <span>{t}</span>
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 )
                              ) : (
                                 <>
                                    <div className="text-md pb-xs font-medium text-gray-100">
                                       Enter your website URL
                                    </div>
                                    <input
                                       type="text"
                                       placeholder="https://yourbrand.com"
                                       value={urlInput}
                                       onChange={(e) => setUrlInput(e.target.value)}
                                       onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
                                       disabled={configuring}
                                       className="border-gray-40 bg-white-base text-md h-[40px] w-full rounded-lg border border-solid px-md outline-none focus:border-gray-60 focus:outline-purple-40 disabled:bg-gray-10 disabled:cursor-not-allowed"
                                       style={{ fontFamily: 'var(--font-family-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                    />
                                 </>
                              )}
                           </div>
                        </div>

                        {/* Error */}
                        {step1Error && (
                           <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{step1Error}</span>
                        )}

                        {/* eslint-disable-next-line no-nested-ternary */}
                        {domain ? (
                           <>
                              {/* Location & language */}
                              <div className="flex w-full flex-col" ref={locRef}>
                                 <div className="text-md pb-xs font-medium text-gray-100">Select location and language</div>
                                 <button
                                    type="button"
                                    aria-expanded={locOpen}
                                    onClick={() => setLocOpen((o) => !o)}
                                    className="border-gray-40 bg-white-base gap-sm px-md text-md flex h-[40px] w-full cursor-pointer items-center rounded-lg border border-solid text-left font-sans hover:border-gray-60"
                                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                 >
                                    <span className="min-w-0 flex-1 truncate">
                                       {location ? (
                                          <span className="gap-sm text-gray-base inline-flex items-center">
                                             <Flag cc={location.cc} />
                                             <span>{location.country} - {location.language}</span>
                                          </span>
                                       ) : (
                                          <span className="text-gray-60">Select location</span>
                                       )}
                                    </span>
                                    <div className="ml-auto flex items-center"><ChevronDown open={locOpen} /></div>
                                 </button>
                                 {locOpen && (
                                    <div
                                       className="border-gray-20 bg-white-base mt-xs rounded-lg border"
                                       style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', position: 'absolute', zIndex: 50, width: '100%', maxWidth: 400, overflow: 'hidden' }}
                                    >
                                       <div className="p-xs">
                                          <input
                                             type="text"
                                             autoFocus
                                             value={locFilter}
                                             onChange={(e) => setLocFilter(e.target.value)}
                                             placeholder="Search locations"
                                             className="border-gray-40 bg-white-base text-md h-[36px] w-full rounded-lg border px-md outline-none focus:border-purple-40"
                                             style={{ fontFamily: 'var(--font-family-primary)' }}
                                          />
                                       </div>
                                       <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                          {SETUP_LOCATIONS
                                             .filter((l) => `${l.country} ${l.language}`.toLowerCase().includes(locFilter.trim().toLowerCase()))
                                             .map((l) => (
                                                <button
                                                   key={`${l.country}-${l.language}-${l.code}`}
                                                   type="button"
                                                   className="gap-sm flex w-full items-center px-md py-sm text-left text-md hover:bg-gray-10"
                                                   onClick={() => { setLocation(l); setLocOpen(false); setLocFilter(''); }}
                                                >
                                                   <Flag cc={l.cc} />
                                                   <span className="text-gray-base">{l.country} - {l.language}</span>
                                                </button>
                                             ))}
                                       </div>
                                    </div>
                                 )}
                              </div>

                              <button
                                 type="button"
                                 className={btnPrimary}
                                 disabled={!location || configuring}
                                 onClick={submitChosen}
                              >
                                 {configuring ? 'Setting up…' : 'Continue'}
                              </button>
                           </>
                        ) : urlMode ? (
                           <div className="gap-sm flex flex-col">
                              <button
                                 type="button"
                                 className={btnPrimary}
                                 disabled={!urlInput.trim()}
                                 onClick={handleUrlSubmit}
                              >
                                 Continue
                              </button>
                              <button
                                 type="button"
                                 className={btnLink + ' self-center'}
                                 onClick={() => { setUrlMode(false); setStep1Error(''); }}
                              >
                                 Use Search Console instead
                              </button>
                           </div>
                        ) : (
                           <>
                              <div className="text-gray-60 flex w-full items-center justify-center">
                                 <div className="flex w-full items-center">
                                    <div role="separator" className="bg-gray-20 min-h-[1px] min-w-[1px] self-stretch w-full" />
                                 </div>
                                 <div className="px-base inline-block">or</div>
                                 <div className="flex w-full items-center">
                                    <div role="separator" className="bg-gray-20 min-h-[1px] min-w-[1px] self-stretch w-full" />
                                 </div>
                              </div>
                              <button
                                 type="button"
                                 className={btnSecondary + ' w-full justify-center'}
                                 onClick={() => { setUrlMode(true); setStep1Error(''); }}
                              >
                                 Start with URL
                              </button>
                           </>
                        )}
                     </form>
                  </div>
               </div>
         </SetupShell>
      );
   }

   // ─────────────────────────────────────────────────────────────────────
   // STEP 2 — Set up Brand Knowledge
   // ─────────────────────────────────────────────────────────────────────
   return (
      <SetupShell title="Set up Brand Knowledge · SerpBear">
         <div
            data-scroll-element="true"
            className="relative flex-1 overflow-auto rounded-xl [color-scheme:light] px-base sm:px-lg bg-white-base"
         >
               <div className="pb-md gap-2xl mx-auto flex w-full flex-col items-center justify-center self-center max-w-screen-sm" style={{ paddingTop: '3rem' }}>
                  <div className="gap-2xl flex w-full flex-col justify-center">
                     <StepDots step={2} />
                     <div className="gap-md flex w-full flex-col justify-center">
                        <h2 className="m-0 text-lg font-semibold">Set up Brand Knowledge</h2>
                        <span style={{ color: '#71717a' }}>
                           Add your brand details, audience, voice, competitors, internal docs and more, so we can provide better recommendations and create content relevant to your business.
                        </span>
                     </div>
                  </div>

                  <form
                     id="setup-brand-kit-form"
                     className="gap-lg flex w-full flex-col"
                     onSubmit={(e) => { e.preventDefault(); void handleFinish(); }}
                  >
                     {/* Brand name card */}
                     <div className="p-lg gap-lg border-gray-20 flex flex-col rounded-xl border">
                        <div className="gap-sm flex flex-col">
                           <span className="text-base font-semibold" style={{ color: '#000' }}>Brand name</span>
                           <span style={{ color: '#71717a' }}>What is your brand called?</span>
                        </div>
                        {loadingBrand ? (
                           <div className="gap-sm text-md flex items-center" style={{ color: '#71717a' }}>
                              <Spinner /> Fetching your brand name…
                           </div>
                        ) : (
                           <div className="flex w-full flex-col">
                              <div className="relative flex grow items-center">
                                 <input
                                    ref={brandNameRef}
                                    id="brand-name-input"
                                    type="text"
                                    name="name"
                                    value={brandName}
                                    onChange={(e) => setBrandName(e.target.value)}
                                    placeholder="Your brand name"
                                    className="border-gray-40 text-md h-[40px] w-full rounded-lg border px-md outline-none focus:border-gray-60"
                                    style={{ fontFamily: 'var(--font-family-primary)' }}
                                 />
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Brand details card */}
                     <div className="p-lg gap-lg border-gray-20 flex flex-col rounded-xl border">
                        <div className="gap-sm flex flex-col">
                           <span className="text-base font-semibold" style={{ color: '#000' }}>Brand details</span>
                           <span style={{ color: '#71717a' }}>
                              Tell us more about your business, so we have enough context to prepare personalized recommendations and generate relevant content.
                           </span>
                        </div>
                        {loadingBrand ? (
                           <div className="gap-sm text-md flex items-center" style={{ color: '#71717a' }}>
                              <Spinner /> Digging into your business model…
                           </div>
                        ) : (
                           <div className="gap-sm flex w-full flex-col">
                              <div className="border-gray-20 flex w-full flex-col overflow-hidden rounded-lg border">
                                 <textarea
                                    value={brandKnowledge}
                                    onChange={(e) => setBrandKnowledge(e.target.value)}
                                    placeholder="Describe your business, target audience, key products/services, competitors, tone of voice…"
                                    className="w-full outline-none resize-y bg-white-base text-md"
                                    style={{ minHeight: 220, padding: '0.75rem 1rem', fontFamily: 'var(--font-family-primary)', border: 'none' }}
                                 />
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Step 2 error */}
                     {step2Error && (
                        <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{step2Error}</span>
                     )}
                  </form>
               </div>

               {/* Floating footer — a white gradient masks content scrolling under it */}
               <div className="sticky bottom-0 -mx-base" style={{ pointerEvents: 'none' }}>
                  <div style={{ height: 36, background: 'linear-gradient(to top, #ffffff 45%, rgba(255,255,255,0))' }} />
                  <div className="px-base sm:px-lg pb-md sm:pb-lg bg-white-base" style={{ pointerEvents: 'auto' }}>
                     <div className="mx-auto flex w-full items-center max-w-screen-sm" style={{ gap: 16 }}>
                        <button
                           type="button"
                           className={btnLink}
                           onClick={() => router.push('/')}
                        >
                           Cancel
                        </button>
                        <button
                           type="submit"
                           form="setup-brand-kit-form"
                           disabled={submitting}
                           className={btnPrimary}
                        >
                           {(submitting || loadingBrand) ? (
                              <>
                                 <Spinner color="#ffffff" />
                                 <span>Get started</span>
                              </>
                           ) : (
                              'Get started'
                           )}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </SetupShell>
   );
};

export default SetupPage;
