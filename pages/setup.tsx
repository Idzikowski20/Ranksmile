import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from 'react-query';
import { parseWorkspaceId } from '../lib/activeWorkspace';
import { SETUP_LOCATIONS, type SetupLocation } from '../lib/setupLocations';
import BlogPathsField from '../components/domains/BlogPathsField';
import DomainFavicon from '../components/common/DomainFavicon';
import { Button, Input, Textarea } from '../components/core';
import {
  SetupShell,
  SetupWizardCard,
  SetupStepProgress,
  SetupHeader,
  SetupField,
  ChevronDown,
  Spinner,
  CheckCircle,
  OrDivider,
  SetupError,
  SetupSearchableMenu,
} from '../components/setup/setupUi';

const FONT = 'var(--font-family-primary)';

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

/** Hostname key for matching GSC entries to configured domains (www-insensitive). */
function domainHostKey(host: string): string {
   const h = host.trim().toLowerCase();
   return h.startsWith('www.') ? h.slice(4) : h;
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

const SiteFavicon = ({ domain }: { domain: string }) => (
   <DomainFavicon domain={domain} size={18} style={{ borderRadius: 4, flexShrink: 0 }} />
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

// ─── Page ─────────────────────────────────────────────────────────────────────
const SetupPage: NextPage = () => {
   const router = useRouter();
   const queryClient = useQueryClient();

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

   // Keep server-side scoping on the setup workspace while the wizard runs.
   useEffect(() => {
      if (!wsId || typeof document === 'undefined') return;
      document.cookie = `active_workspace=${wsId}; Path=/; Max-Age=31536000; SameSite=Lax`;
   }, [wsId]);

   // ── Wizard state ───────────────────────────────────────────────────────
   const [step, setStep] = useState<1 | 2>(1);
   const [domain, setDomain] = useState<string | null>(null);

   // Step 1
   const [gscSites, setGscSites] = useState<{ siteUrl: string }[]>([]);
   const [configuredDomains, setConfiguredDomains] = useState<Array<{ domain: string; workspace_id?: number | null }>>([]);
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
   // blog paths (detected after a domain is chosen, editable before configure)
   const [blogPaths, setBlogPaths] = useState<string[]>([]);
   const [blogDetecting, setBlogDetecting] = useState(false);

   // Step 2
   const [brandName, setBrandName] = useState('');
   const [brandKnowledge, setBrandKnowledge] = useState('');
   const [loadingBrand, setLoadingBrand] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [step2Error, setStep2Error] = useState('');

   const siteMenuAnchorRef = useRef<HTMLDivElement>(null);
   const locMenuAnchorRef = useRef<HTMLDivElement>(null);
   const brandNameRef = useRef<HTMLInputElement>(null);
   const brandKnowledgeRef = useRef<HTMLTextAreaElement>(null);

   // Auto-grow the brand-details textarea to fit its content, so the page scrolls
   // instead of the textarea (no nested scrollbar).
   useEffect(() => {
      const el = brandKnowledgeRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
   }, [brandKnowledge, loadingBrand]);

   // ── Fetch GSC sites + already-configured domains on mount ───────────────
   useEffect(() => {
      Promise.all([
         fetch('/api/gsc/sites').then((r) => r.json()).catch(() => ({ sites: [] })),
         fetch('/api/domains').then((r) => r.json()).catch(() => ({ domains: [] })),
      ])
         .then(([gscData, domainsData]) => {
            setGscSites(Array.isArray(gscData?.sites) ? gscData.sites : []);
            const rows = Array.isArray(domainsData?.domains) ? domainsData.domains : [];
            setConfiguredDomains(rows.map((d: { domain?: string; workspace_id?: number | null }) => ({
               domain: String(d.domain ?? ''),
               workspace_id: d.workspace_id ?? null,
            })));
         })
         .catch(() => {
            setGscSites([]);
            setConfiguredDomains([]);
         })
         .finally(() => setGscLoaded(true));
   }, []);

   // Domains already attached to a different workspace — hide from the picker.
   const takenHostKeys = useMemo(() => {
      const keys = new Set<string>();
      for (const row of configuredDomains) {
         if (!row.domain) continue;
         if (row.workspace_id != null && row.workspace_id !== wsId) {
            keys.add(domainHostKey(normalizeDomain(row.domain)));
         }
      }
      return keys;
   }, [configuredDomains, wsId]);

   const isDomainTaken = (raw: string) => takenHostKeys.has(domainHostKey(normalizeDomain(raw)));

   const availableGscSites = useMemo(() => {
      const seen = new Set<string>();
      const out: { siteUrl: string }[] = [];
      for (const site of gscSites) {
         const key = domainHostKey(normalizeDomain(site.siteUrl));
         if (takenHostKeys.has(key) || seen.has(key)) continue;
         seen.add(key);
         out.push(site);
      }
      return out;
   }, [gscSites, takenHostKeys]);

   const connectGsc = () => {
      if (typeof window !== 'undefined') {
         window.location.href = `/api/gsc/connect?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
   };

   // ── Close the open dropdown on outside click (handled by SetupDropdownMenu portal) ──
   // ── Detect where the blog lives (sitemap clustering) once a domain is chosen. ──
   const detectBlogPaths = async (domainName: string) => {
      setBlogDetecting(true);
      try {
         const r = await fetch('/api/domains/detect-blog-paths', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domainName }),
         });
         const data = r.ok ? await r.json() : { blogPaths: [] };
         setBlogPaths(Array.isArray(data.blogPaths) ? data.blogPaths : []);
      } catch {
         setBlogPaths([]);
      } finally {
         setBlogDetecting(false);
      }
   };

   // ── Choose a domain — records the selection but does NOT submit; the
   //    location/language step + Continue does (so the language is picked first). ──
   const chooseDomain = (displayValue: string) => {
      const d = normalizeDomain(displayValue);
      if (!d) return;
      if (isDomainTaken(displayValue)) {
         setStep1Error('This domain is already configured in another workspace.');
         return;
      }
      setSelectedSite(displayValue);
      setDomain(d);
      setUrlMode(false);
      setComboOpen(false);
      setStep1Error('');
      setBlogPaths([]);
      void detectBlogPaths(d);
   };
   const handleSiteSelect = (siteUrl: string) => chooseDomain(siteUrl);
   const handleUrlSubmit = () => { if (urlInput.trim()) chooseDomain(urlInput.trim()); };

   // ── Configure the chosen domain (with the chosen language) + go to step 2 ──
   const submitChosen = async () => {
      if (!domain || !location || configuring || !wsId) return;
      if (isDomainTaken(domain)) {
         setStep1Error('This domain is already configured in another workspace.');
         return;
      }
      setStep1Error('');
      setConfiguring(true);
      try {
         const res = await fetch('/api/domains/configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               domain,
               workspaceId: wsId,
               gscSiteUrl: selectedSite || (urlMode ? urlInput.trim() : ''),
               language: location.code,
               country: location.country,
               languageName: location.language,
               cc: location.cc,
            }),
         });
         if (res.ok) {
            const cfg = await res.json().catch(() => ({}));
            const configuredSlug = cfg?.domainSlug as string | undefined;
            if (blogPaths.length > 0 && configuredSlug) {
               await fetch('/api/domains/blog-paths', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ slug: configuredSlug, blogPaths }),
               }).catch(() => { /* non-fatal — paths can be edited later in domain settings */ });
            }
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
            await queryClient.invalidateQueries('workspaces');
            if (typeof document !== 'undefined') {
               document.cookie = `active_workspace=${wsId}; Path=/; Max-Age=31536000; SameSite=Lax`;
            }
            window.location.href = `/workspace/${wsId}/dashboard`;
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
      const stepTitle = gscLoaded && availableGscSites.length > 0 ? 'Create a new workspace' : 'Set up your workspace';
      return (
         <SetupShell title="Create a new workspace · Ranksmile" layout="narrow">
            <SetupWizardCard layout="narrow">
               <SetupStepProgress step={1} />
               <SetupHeader
                  title={stepTitle}
                  description="Workspace is used for a brand you own or manage. You can add workspaces for more brands later."
               />

               <form style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={(e) => e.preventDefault()}>
                  <div>
                     {/* eslint-disable-next-line no-nested-ternary */}
                     {domain ? (
                        <SetupField label="Select Search Console site">
                           <div ref={siteMenuAnchorRef}>
                              <button
                                 type="button"
                                 aria-expanded={comboOpen}
                                 className="sentry-setup-trigger"
                                 onClick={() => {
                                    if (availableGscSites.length > 0) setComboOpen((o) => !o);
                                    else { setDomain(null); setSelectedSite(''); setLocation(null); setStep1Error(''); }
                                 }}
                              >
                                 <SiteFavicon domain={domain} />
                                 <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</span>
                                 <ChevronDown open={comboOpen} />
                              </button>
                           </div>
                        </SetupField>
                     ) : !urlMode ? (
                        // eslint-disable-next-line no-nested-ternary
                        !gscLoaded ? (
                           <div className="sentry-setup-trigger" style={{ cursor: 'default' }}>
                              <Spinner />
                              <span className="sentry-setup-trigger-placeholder">Loading sites…</span>
                           </div>
                        ) : availableGscSites.length > 0 ? (
                           <SetupField label="Select Search Console site">
                              <div ref={siteMenuAnchorRef}>
                                 <button
                                    type="button"
                                    role="combobox"
                                    aria-expanded={comboOpen}
                                    aria-haspopup="listbox"
                                    className="sentry-setup-trigger"
                                    onClick={() => setComboOpen((o) => !o)}
                                    disabled={configuring}
                                 >
                                    <GoogleIcon />
                                    <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {selectedSite ? normalizeDomain(selectedSite) : <span className="sentry-setup-trigger-placeholder">Select site</span>}
                                    </span>
                                    <ChevronDown open={comboOpen} />
                                 </button>
                              </div>
                           </SetupField>
                        ) : gscSites.length > 0 ? (
                           <div className="sentry-setup-gsc-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#52525C', fontFamily: FONT }}>
                                 All Search Console sites linked to your account are already configured as workspaces.
                              </p>
                              <Button type="button" variant="secondary" size="md" onClick={() => { setUrlMode(true); setStep1Error(''); }} style={{ width: '100%' }}>
                                 Enter a different website URL
                              </Button>
                           </div>
                        ) : (
                           <div className="sentry-setup-gsc-card">
                              <Button type="button" variant="primary" size="md" icon={<GoogleIcon />} onClick={connectGsc} style={{ width: '100%' }}>
                                 Connect Search Console
                              </Button>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                 {['Automatic keyword selection', 'Access real traffic and performance data', 'Content ideas based on deep topical analysis'].map((t) => (
                                    <div key={t} className="sentry-setup-benefit">
                                       <CheckCircle />
                                       <span>{t}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )
                     ) : (
                        <SetupField label="Enter your website URL">
                           <Input
                              type="text"
                              placeholder="https://yourbrand.com"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
                              disabled={configuring}
                           />
                        </SetupField>
                     )}

                     <SetupSearchableMenu
                        open={comboOpen && availableGscSites.length > 0}
                        anchorRef={siteMenuAnchorRef}
                        onClose={() => setComboOpen(false)}
                        filter={siteFilter}
                        onFilterChange={setSiteFilter}
                        placeholder="Search sites"
                        items={availableGscSites}
                        filterItem={(site, q) => normalizeDomain(site.siteUrl).toLowerCase().includes(q)}
                        getKey={(site) => site.siteUrl}
                        renderItem={(site) => {
                           const dom = normalizeDomain(site.siteUrl);
                           return (
                              <button
                                 type="button"
                                 className="sentry-setup-menu-item"
                                 onClick={() => handleSiteSelect(site.siteUrl)}
                              >
                                 <SiteFavicon domain={dom} />
                                 <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dom}</span>
                              </button>
                           );
                        }}
                        footer={(
                           <button type="button" className="sentry-setup-menu-footer" onClick={connectGsc}>
                              <GoogleIcon />
                              <span>Add another Search Console account</span>
                           </button>
                        )}
                     />
                  </div>

                  {step1Error && <SetupError message={step1Error} />}

                  {/* eslint-disable-next-line no-nested-ternary */}
                  {domain ? (
                     <>
                        <div>
                           <SetupField label="Select location and language">
                              <div ref={locMenuAnchorRef}>
                                 <button
                                    type="button"
                                    aria-expanded={locOpen}
                                    className="sentry-setup-trigger"
                                    onClick={() => setLocOpen((o) => !o)}
                                 >
                                    <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {location ? (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                             <Flag cc={location.cc} />
                                             <span>{location.country} - {location.language}</span>
                                          </span>
                                       ) : (
                                          <span className="sentry-setup-trigger-placeholder">Select location</span>
                                       )}
                                    </span>
                                    <ChevronDown open={locOpen} />
                                 </button>
                              </div>
                           </SetupField>
                           <SetupSearchableMenu
                              open={locOpen}
                              anchorRef={locMenuAnchorRef}
                              onClose={() => setLocOpen(false)}
                              filter={locFilter}
                              onFilterChange={setLocFilter}
                              placeholder="Search locations"
                              items={SETUP_LOCATIONS}
                              listMaxHeight={240}
                              filterItem={(l, q) => `${l.country} ${l.language}`.toLowerCase().includes(q)}
                              getKey={(l) => `${l.country}-${l.language}-${l.code}`}
                              renderItem={(l) => (
                                 <button
                                    type="button"
                                    className="sentry-setup-menu-item"
                                    onClick={() => { setLocation(l); setLocOpen(false); setLocFilter(''); }}
                                 >
                                    <Flag cc={l.cc} />
                                    <span>{l.country} - {l.language}</span>
                                 </button>
                              )}
                           />
                        </div>

                        <SetupField
                           label="Where does your blog live?"
                           optional
                           hint="Leave empty to scan your whole site. Set a path to focus the audit on a section."
                        >
                           {blogDetecting ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6a6772', fontFamily: FONT }}>
                                 <Spinner /> Detecting your blog…
                              </span>
                           ) : (
                              <BlogPathsField value={blogPaths} onChange={setBlogPaths} />
                           )}
                        </SetupField>

                        <Button
                           type="button"
                           variant="primary"
                           size="md"
                           disabled={!location}
                           busy={configuring}
                           onClick={submitChosen}
                           style={{ width: '100%' }}
                        >
                           Continue
                        </Button>
                     </>
                  ) : urlMode ? (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Button type="button" variant="primary" size="md" disabled={!urlInput.trim()} onClick={handleUrlSubmit} style={{ width: '100%' }}>
                           Continue
                        </Button>
                        <Button type="button" variant="link" size="md" onClick={() => { setUrlMode(false); setStep1Error(''); }} style={{ alignSelf: 'center' }}>
                           Use Search Console instead
                        </Button>
                     </div>
                  ) : gscLoaded && availableGscSites.length > 0 ? (
                     <>
                        <OrDivider />
                        <Button type="button" variant="secondary" size="md" onClick={() => { setUrlMode(true); setStep1Error(''); }} style={{ width: '100%' }}>
                           Start with URL
                        </Button>
                     </>
                  ) : null}
               </form>
            </SetupWizardCard>
         </SetupShell>
      );
   }

   // ─────────────────────────────────────────────────────────────────────
   // STEP 2 — Set up Brand Knowledge
   // ─────────────────────────────────────────────────────────────────────
   return (
      <SetupShell title="Set up Brand Knowledge · Ranksmile" layout="wide">
         <SetupWizardCard layout="wide">
            <SetupStepProgress step={2} />
            <SetupHeader
               title="Set up Brand Knowledge"
               description="Add your brand details, audience, voice, competitors, internal docs and more, so we can provide better recommendations and create content relevant to your business."
            />

            <form
               id="setup-brand-kit-form"
               style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
               onSubmit={(e) => { e.preventDefault(); void handleFinish(); }}
            >
               <div className="sentry-setup-brand-block">
                  <div>
                     <p className="sentry-setup-brand-block-title">Brand name</p>
                     <p className="sentry-setup-brand-block-desc">What is your brand called?</p>
                  </div>
                  {loadingBrand ? (
                     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6a6772', fontFamily: FONT }}>
                        <Spinner /> Fetching your brand name…
                     </span>
                  ) : (
                     <Input
                        ref={brandNameRef}
                        id="brand-name-input"
                        type="text"
                        name="name"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Your brand name"
                     />
                  )}
               </div>

               <div className="sentry-setup-brand-block">
                  <div>
                     <p className="sentry-setup-brand-block-title">Brand details</p>
                     <p className="sentry-setup-brand-block-desc">
                        Tell us more about your business, so we have enough context to prepare personalized recommendations and generate relevant content.
                     </p>
                  </div>
                  {loadingBrand ? (
                     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6a6772', fontFamily: FONT }}>
                        <Spinner /> Digging into your business model…
                     </span>
                  ) : (
                     <Textarea
                        ref={brandKnowledgeRef}
                        value={brandKnowledge}
                        onChange={(e) => setBrandKnowledge(e.target.value)}
                        placeholder="Describe your business, target audience, key products/services, competitors, tone of voice…"
                        rows={8}
                        resize="none"
                     />
                  )}
               </div>

               {step2Error && <SetupError message={step2Error} />}

               <div className="sentry-setup-actions">
                  <Button type="button" variant="link" size="md" disabled={submitting} onClick={() => router.push('/')}>
                     Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={submitting} busy={submitting || loadingBrand}>
                     Get started
                  </Button>
               </div>
            </form>
         </SetupWizardCard>
      </SetupShell>
   );
};

export default SetupPage;
