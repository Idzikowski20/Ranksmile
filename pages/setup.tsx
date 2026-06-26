import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { parseWorkspaceId } from '../lib/activeWorkspace';

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
   const [selectedSite, setSelectedSite] = useState('');
   const [comboOpen, setComboOpen] = useState(false);
   const [urlMode, setUrlMode] = useState(false);
   const [urlInput, setUrlInput] = useState('');
   const [configuring, setConfiguring] = useState(false);
   const [step1Error, setStep1Error] = useState('');

   // Step 2
   const [brandName, setBrandName] = useState('');
   const [brandKnowledge, setBrandKnowledge] = useState('');
   const [loadingBrand, setLoadingBrand] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [step2Error, setStep2Error] = useState('');

   const comboRef = useRef<HTMLDivElement>(null);
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
         });
   }, []);

   // ── Close combo on outside click ───────────────────────────────────────
   useEffect(() => {
      if (!comboOpen) return;
      const handler = (e: MouseEvent) => {
         if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
            setComboOpen(false);
         }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
   }, [comboOpen]);

   // ── Submit domain (step 1 → step 2) ───────────────────────────────────
   const submitDomain = async (d: string) => {
      if (!d) return;
      setStep1Error('');
      setConfiguring(true);
      try {
         const res = await fetch('/api/domains/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: d }),
         });
         if (res.ok) {
            setDomain(d);
            setStep(2);
            // Prefill brand knowledge
            setLoadingBrand(true);
            fetch('/api/brand-knowledge', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ url: d }),
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

   // ── Handle GSC site selection ──────────────────────────────────────────
   const handleSiteSelect = (siteUrl: string) => {
      setSelectedSite(siteUrl);
      setComboOpen(false);
      const d = normalizeDomain(siteUrl);
      void submitDomain(d);
   };

   // ── Handle URL submit ──────────────────────────────────────────────────
   const handleUrlSubmit = () => {
      const d = normalizeDomain(urlInput);
      if (!d) return;
      void submitDomain(d);
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
         <>
            <Head>
               <title>Create a new workspace · SerpBear</title>
               <meta name="robots" content="noindex" />
            </Head>
            <div className="p-sm relative flex flex-col overflow-hidden" style={{ minHeight: '100vh' }}>
               <div
                  data-scroll-element="true"
                  className="relative flex-1 overflow-auto rounded-xl [color-scheme:light] px-base sm:px-lg bg-white-base"
               >
                  <div className="pb-md mx-auto flex w-full flex-col items-center justify-center self-center gap-lg" style={{ maxWidth: 400, paddingTop: '3rem' }}>
                     <div className="gap-2xl flex w-full flex-col justify-center">
                        <StepDots step={1} />
                        <div className="gap-md flex w-full flex-col justify-center">
                           <h2 className="m-0 text-lg font-semibold">Create a new workspace</h2>
                           <span style={{ color: '#71717a' }}>
                              Workspace is used for a brand you own or manage. You can add workspaces for more brands later.
                           </span>
                        </div>
                     </div>

                     <form className="gap-lg flex w-full flex-col" onSubmit={(e) => e.preventDefault()}>
                        <div className="gap-md flex w-full flex-col">
                           <div className="flex w-full flex-col" ref={comboRef}>
                              {!urlMode ? (
                                 <>
                                    <div className="text-md pb-xs font-medium text-gray-100">
                                       Select Search Console site
                                    </div>
                                    {/* Combobox button */}
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
                                             <span className="flex-1 truncate text-gray-base">{selectedSite}</span>
                                          ) : (
                                             <span className="text-gray-60 flex-1 truncate">Select site</span>
                                          )}
                                       </span>
                                       <div className="ml-auto flex items-center">
                                          <ChevronDown open={comboOpen} />
                                       </div>
                                    </button>

                                    {/* Dropdown */}
                                    {comboOpen && (
                                       <div
                                          className="border-gray-20 bg-white-base mt-xs rounded-lg border"
                                          style={{
                                             boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                             position: 'absolute',
                                             zIndex: 50,
                                             width: '100%',
                                             maxWidth: 400,
                                             maxHeight: 240,
                                             overflowY: 'auto',
                                          }}
                                       >
                                          {gscSites.length === 0 ? (
                                             <button
                                                type="button"
                                                className="flex w-full items-center px-md py-sm text-left text-md hover:bg-gray-10"
                                                onClick={() => {
                                                   window.location.href =
                                                      '/api/gsc/connect?redirect=' +
                                                      encodeURIComponent(
                                                         window.location.pathname + window.location.search,
                                                      );
                                                }}
                                             >
                                                <GoogleIcon />
                                                <span className="ml-sm">Connect Search Console</span>
                                             </button>
                                          ) : (
                                             gscSites.map((site) => (
                                                <button
                                                   key={site.siteUrl}
                                                   type="button"
                                                   className="flex w-full items-center px-md py-sm text-left text-md hover:bg-gray-10"
                                                   onClick={() => handleSiteSelect(site.siteUrl)}
                                                >
                                                   {site.siteUrl}
                                                </button>
                                             ))
                                          )}
                                       </div>
                                    )}
                                 </>
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

                        {/* "or" divider */}
                        {!urlMode && (
                           <div className="text-gray-60 flex w-full items-center justify-center">
                              <div className="flex w-full items-center">
                                 <div role="separator" className="bg-gray-20 min-h-[1px] min-w-[1px] self-stretch w-full" />
                              </div>
                              <div className="px-base inline-block">or</div>
                              <div className="flex w-full items-center">
                                 <div role="separator" className="bg-gray-20 min-h-[1px] min-w-[1px] self-stretch w-full" />
                              </div>
                           </div>
                        )}

                        {/* Action button */}
                        {urlMode ? (
                           <div className="gap-sm flex flex-col">
                              <button
                                 type="button"
                                 className={btnPrimary}
                                 disabled={configuring || !urlInput.trim()}
                                 onClick={handleUrlSubmit}
                              >
                                 {configuring ? 'Configuring…' : 'Continue'}
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
                           <button
                              type="button"
                              disabled={configuring}
                              className={btnSecondary + ' w-full justify-center'}
                              onClick={() => { setUrlMode(true); setStep1Error(''); }}
                           >
                              {configuring ? 'Configuring…' : 'Start with URL'}
                           </button>
                        )}
                     </form>
                  </div>
               </div>
            </div>
         </>
      );
   }

   // ─────────────────────────────────────────────────────────────────────
   // STEP 2 — Set up Brand Knowledge
   // ─────────────────────────────────────────────────────────────────────
   return (
      <>
         <Head>
            <title>Set up Brand Knowledge · SerpBear</title>
            <meta name="robots" content="noindex" />
         </Head>
         <div className="p-sm relative flex flex-col overflow-hidden" style={{ minHeight: '100vh' }}>
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
                        <div className="flex w-full flex-col">
                           <div className="relative flex grow items-center">
                              <input
                                 ref={brandNameRef}
                                 id="brand-name-input"
                                 type="text"
                                 name="name"
                                 value={brandName}
                                 onChange={(e) => setBrandName(e.target.value)}
                                 disabled={loadingBrand}
                                 placeholder={loadingBrand ? 'Analyzing your site…' : 'Your brand name'}
                                 className="border-gray-40 text-md h-[40px] w-full rounded-lg border px-md outline-none focus:border-gray-60 disabled:bg-gray-10 disabled:cursor-not-allowed"
                                 style={{ fontFamily: 'var(--font-family-primary)' }}
                              />
                           </div>
                        </div>
                     </div>

                     {/* Brand details card */}
                     <div className="p-lg gap-lg border-gray-20 flex flex-col rounded-xl border">
                        <div className="gap-sm flex flex-col">
                           <span className="text-base font-semibold" style={{ color: '#000' }}>Brand details</span>
                           <span style={{ color: '#71717a' }}>
                              Tell us more about your business, so we have enough context to prepare personalized recommendations and generate relevant content.
                           </span>
                        </div>
                        <div className="gap-sm flex w-full flex-col">
                           <div className="border-gray-20 flex w-full flex-col overflow-hidden rounded-lg border">
                              <textarea
                                 value={brandKnowledge}
                                 onChange={(e) => setBrandKnowledge(e.target.value)}
                                 disabled={loadingBrand}
                                 placeholder={loadingBrand ? 'Analyzing your site…' : 'Describe your business, target audience, key products/services, competitors, tone of voice…'}
                                 className="w-full outline-none resize-y bg-white-base text-md"
                                 style={{
                                    minHeight: 220,
                                    padding: '0.75rem 1rem',
                                    fontFamily: 'var(--font-family-primary)',
                                    border: 'none',
                                 }}
                              />
                           </div>
                        </div>
                     </div>

                     {/* Step 2 error */}
                     {step2Error && (
                        <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{step2Error}</span>
                     )}
                  </form>
               </div>

               {/* Sticky footer */}
               <div
                  className="py-md sm:py-lg bg-white-base sticky bottom-0 border-gray-20 -mx-base border-t"
                  style={{ backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)' }}
               >
                  <div className="mx-auto my-0 flex w-full justify-center sm:justify-end max-w-screen-sm" style={{ gap: '0.75rem' }}>
                     <button
                        type="button"
                        aria-disabled="false"
                        className={btnLink}
                        onClick={() => router.push('/')}
                     >
                        Cancel
                     </button>
                     <button
                        type="submit"
                        aria-disabled={submitting || loadingBrand}
                        form="setup-brand-kit-form"
                        disabled={submitting || loadingBrand}
                        className={btnPrimary}
                        style={{ maxWidth: 200 }}
                     >
                        {submitting ? 'Setting up…' : 'Get started'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </>
   );
};

export default SetupPage;
