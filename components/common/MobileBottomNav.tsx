/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';
import { useWorkspaces } from '../../services/workspaces';
import { deriveActiveId, resolveActiveDomain, workspaceHref } from '../../lib/activeWorkspace';

type MobileBottomNavProps = {
   domains?: DomainType[];
   showAddModal: () => void;
   showSettings?: () => void;
};

/* ── Bar icons (match the Surfer bottom nav) ──────────────────────────── */

const IcoDashboard = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11 3.6C11 3.03995 11 2.75992 10.891 2.54601C10.7951 2.35785 10.6422 2.20487 10.454 2.10899C10.2401 2 9.96005 2 9.4 2H6.16146C5.63433 1.99998 5.17954 1.99997 4.80497 2.03057C4.40963 2.06287 4.01641 2.13419 3.63803 2.32698C3.07354 2.6146 2.6146 3.07354 2.32698 3.63803C2.13419 4.01641 2.06287 4.40963 2.03057 4.80497C1.99997 5.17954 1.99998 5.63429 2 6.16142V9.4C2 9.96005 2 10.2401 2.10899 10.454C2.20487 10.6422 2.35785 10.7951 2.54601 10.891C2.75992 11 3.03995 11 3.6 11H9.4C9.96005 11 10.2401 11 10.454 10.891C10.6422 10.7951 10.7951 10.6422 10.891 10.454C11 10.2401 11 9.96005 11 9.4V3.6Z" />
      <path d="M3.6 13C3.03995 13 2.75992 13 2.54601 13.109C2.35785 13.2049 2.20487 13.3578 2.10899 13.546C2 13.7599 2 14.0399 2 14.6V17.8385C1.99998 18.3657 1.99997 18.8205 2.03057 19.195C2.06287 19.5904 2.13419 19.9836 2.32698 20.362C2.6146 20.9265 3.07354 21.3854 3.63803 21.673C4.01641 21.8658 4.40963 21.9371 4.80497 21.9694C5.17954 22 5.6343 22 6.16144 22H9.4C9.96005 22 10.2401 22 10.454 21.891C10.6422 21.7951 10.7951 21.6422 10.891 21.454C11 21.2401 11 20.9601 11 20.4V14.6C11 14.0399 11 13.7599 10.891 13.546C10.7951 13.3578 10.6422 13.2049 10.454 13.109C10.2401 13 9.96005 13 9.4 13H3.6Z" />
      <path d="M13 20.4C13 20.9601 13 21.2401 13.109 21.454C13.2049 21.6422 13.3578 21.7951 13.546 21.891C13.7599 22 14.0399 22 14.6 22H17.8386C18.3657 22 18.8205 22 19.195 21.9694C19.5904 21.9371 19.9836 21.8658 20.362 21.673C20.9265 21.3854 21.3854 20.9265 21.673 20.362C21.8658 19.9836 21.9371 19.5904 21.9694 19.195C22 18.8205 22 18.3657 22 17.8386V14.6C22 14.0399 22 13.7599 21.891 13.546C21.7951 13.3578 21.6422 13.2049 21.454 13.109C21.2401 13 20.9601 13 20.4 13H14.6C14.0399 13 13.7599 13 13.546 13.109C13.3578 13.2049 13.2049 13.3578 13.109 13.546C13 13.7599 13 14.0399 13 14.6V20.4Z" />
      <path d="M22 9.4C22 9.96005 22 10.2401 21.891 10.454C21.7951 10.6422 21.6422 10.7951 21.454 10.891C21.2401 11 20.9601 11 20.4 11H14.6C14.0399 11 13.7599 11 13.546 10.891C13.3578 10.7951 13.2049 10.6422 13.109 10.454C13 10.2401 13 9.96005 13 9.4V3.6C13 3.03995 13 2.75992 13.109 2.54601C13.2049 2.35785 13.3578 2.20487 13.546 2.10899C13.7599 2 14.0399 2 14.6 2H17.8385C18.3657 1.99998 18.8205 1.99997 19.195 2.03057C19.5904 2.06287 19.9836 2.13419 20.362 2.32698C20.9265 2.6146 21.3854 3.07354 21.673 3.63803C21.8658 4.01641 21.9371 4.40963 21.9694 4.80497C22 5.17954 22 5.6343 22 6.16144V9.4Z" />
   </svg>
);

const IcoRecommendations = () => (
   <svg viewBox="0 0 20 20" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
   </svg>
);

const IcoActivity = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" />
   </svg>
);

const IcoContent = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8.00007L2 22.0001M18 15.0001H9M6.6 19.0001H13.3373C13.5818 19.0001 13.7041 19.0001 13.8192 18.9724C13.9213 18.9479 14.0188 18.9075 14.1083 18.8527C14.2092 18.7909 14.2957 18.7044 14.4686 18.5314L19.5 13.5001C19.739 13.2611 19.8584 13.1416 19.9546 13.0358C22.0348 10.7474 22.0348 7.25275 19.9546 4.9643C19.8584 4.85851 19.739 4.73903 19.5 4.50007C19.261 4.26111 19.1416 4.14163 19.0358 4.04547C16.7473 1.96531 13.2527 1.96531 10.9642 4.04547C10.8584 4.14163 10.739 4.26111 10.5 4.50007L5.46863 9.53144C5.29568 9.70439 5.2092 9.79087 5.14736 9.89179C5.09253 9.98126 5.05213 10.0788 5.02763 10.1808C5 10.2959 5 10.4182 5 10.6628V17.4001C5 17.9601 5 18.2401 5.10899 18.4541C5.20487 18.6422 5.35785 18.7952 5.54601 18.8911C5.75992 19.0001 6.03995 19.0001 6.6 19.0001Z" />
   </svg>
);

const IcoMore = () => (
   <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
   </svg>
);

const MobileSheetLink = ({ href, label, active, onNavigate }: { href: string; label: string; active?: boolean; onNavigate: () => void }) => (
   <li>
      <Link href={href} passHref>
         <a className={`mobile-sheet-item${active ? ' mobile-sheet-item--active' : ''}`} onClick={onNavigate}>
            <span className="mobile-sheet-item-label">{label}</span>
         </a>
      </Link>
   </li>
);

const MobileBottomNav = ({ domains = [], showAddModal }: MobileBottomNavProps) => {
   const router = useRouter();
   const [sheetOpen, setSheetOpen] = useState(false);
   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   const { data: wsData } = useWorkspaces();
   const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
   const activeWorkspace = (wsData?.workspaces || []).find((w) => w.id === activeId) ?? null;
   const activeSlug = useMemo(() => {
      const resolved = resolveActiveDomain(domains, activeId, activeWorkspace?.domain);
      return resolved?.slug ?? domains[0]?.slug ?? null;
   }, [activeId, activeWorkspace, domains]);

   const closeSheet = () => setSheetOpen(false);
   const path = mounted ? router.asPath.split('?')[0].split('#')[0].replace(/\/$/, '') : '';
   const isMatch = (suffix: string) => mounted && path.includes(suffix);

   const sitePath = (sub: string) => (activeSlug
      ? workspaceHref(activeId, sub ? `/sites/${activeSlug}/${sub}` : `/sites/${activeSlug}`)
      : workspaceHref(activeId, '/dashboard'));

   const primaryItems = [
      { href: workspaceHref(activeId, '/dashboard'), label: 'Dashboard', icon: <IcoDashboard />, active: isMatch('/dashboard') },
      { href: sitePath('recommendations'), label: 'Recommendations', icon: <IcoRecommendations />, active: isMatch('/recommendations') },
      { href: sitePath('activity-log'), label: 'Activity Log', icon: <IcoActivity />, active: isMatch('/activity-log') },
      { href: workspaceHref(activeId, '/articles'), label: 'Content Editor', icon: <IcoContent />, active: isMatch('/articles') },
   ];

   const toolsLinks = activeSlug ? [
      { label: 'Audit Tool', href: workspaceHref(activeId, `/sites/${activeSlug}/audit-tool`), match: '/audit-tool' },
      { label: 'Keyword Research', href: workspaceHref(activeId, `/sites/${activeSlug}/keyword-research`), match: '/keyword-research' },
      { label: 'Topic Research', href: workspaceHref(activeId, `/sites/${activeSlug}/topic-research`), match: '/topic-research' },
      { label: 'AI Humanizer', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-humanizer`), match: '/ai-humanizer' },
   ] : [];

   const seoLinks = activeSlug ? [
      { label: 'Overview', href: workspaceHref(activeId, `/sites/${activeSlug}/seo-overview`), match: '/seo-overview' },
      { label: 'Performance', href: workspaceHref(activeId, `/sites/${activeSlug}/performance`), match: '/performance' },
      { label: 'Recommendations', href: workspaceHref(activeId, `/sites/${activeSlug}/recommendations`), match: '/recommendations' },
      { label: 'Content Audit', href: workspaceHref(activeId, `/sites/${activeSlug}/content-audit`), match: '/content-audit' },
      { label: 'Topical Map', href: workspaceHref(activeId, `/sites/${activeSlug}/topical-map`), match: '/topical-map' },
      { label: 'Activity Log', href: workspaceHref(activeId, `/sites/${activeSlug}/activity-log`), match: '/activity-log' },
   ] : [];

   const aiVisLinks = activeSlug ? [
      { label: 'Overview', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/overview`), match: '/ai-visibility/overview' },
      { label: 'Sources', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/sources`), match: '/ai-visibility/sources' },
      { label: 'Competitors', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/competitors`), match: '/ai-visibility/competitors' },
      { label: 'Prompts', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/prompts`), match: '/ai-visibility/prompts' },
      { label: 'Fanout Queries', href: workspaceHref(activeId, `/sites/${activeSlug}/ai-visibility/fanout-queries`), match: '/ai-visibility/fanout-queries' },
   ] : [];

   return (
      <>
         {/* Fixed bottom bar */}
         <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile navigation">
            {primaryItems.map(({ href, label, icon, active }) => (
               // key by label (unique) — href can collide on '/sites' when no domain exists yet
               <Link href={href} passHref key={label}>
                  <a
                     className={`mobile-nav-item${active ? ' mobile-nav-item--active' : ''}`}
                     aria-label={label}
                     onClick={() => setSheetOpen(false)}
                  >
                     <span className="mobile-nav-item-inner">
                        {icon}
                        <span className="mobile-nav-label">{label}</span>
                     </span>
                  </a>
               </Link>
            ))}

            <button
               type="button"
               className={`mobile-nav-item${sheetOpen ? ' mobile-nav-item--active' : ''}`}
               onClick={() => setSheetOpen(true)}
               aria-label="More"
               aria-expanded={sheetOpen}
               aria-haspopup="dialog"
            >
               <span className="mobile-nav-item-inner">
                  <IcoMore />
                  <span className="mobile-nav-label">More</span>
               </span>
            </button>
         </nav>

         {/* Bottom sheet overlay */}
         {sheetOpen && (
            <div
               className="mobile-sheet-overlay lg:hidden"
               role="presentation"
               onClick={() => setSheetOpen(false)}
            />
         )}

         {/* Bottom sheet */}
         <div
            className={`mobile-sheet lg:hidden${sheetOpen ? ' mobile-sheet--open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
         >
            <div className="mobile-sheet-scroll">

            {/* Sites / Domains */}
            {domains.length > 0 && (
               <div className="mobile-sheet-section">
                  <p className="mobile-sheet-section-label">Sites</p>
                  <ul className="mobile-sheet-list">
                     {domains.map((d) => {
                        const href = workspaceHref(activeId, `/sites/${d.slug}`);
                        const domActive = mounted && path.includes(`/sites/${d.slug}`);
                        return (
                           <li key={d.domain}>
                              <Link href={href} passHref>
                                 <a
                                    className={`mobile-sheet-item${domActive ? ' mobile-sheet-item--active' : ''}`}
                                    onClick={closeSheet}
                                 >
                                    <img
                                       src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                                       alt=""
                                       style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }}
                                    />
                                    <span className="mobile-sheet-item-label">{d.domain}</span>
                                 </a>
                              </Link>
                           </li>
                        );
                     })}
                  </ul>
                  <button
                     type="button"
                     className="mobile-sheet-item"
                     onClick={() => { showAddModal(); closeSheet(); }}
                  >
                     <span className="mobile-sheet-item-icon">+</span>
                     <span className="mobile-sheet-item-label">Add Domain</span>
                  </button>
               </div>
            )}

            {seoLinks.length > 0 && (
               <div className="mobile-sheet-section">
                  <p className="mobile-sheet-section-label">SEO</p>
                  <ul className="mobile-sheet-list">
                     {seoLinks.map((ln) => (
                        <MobileSheetLink
                           key={ln.href}
                           href={ln.href}
                           label={ln.label}
                           active={isMatch(ln.match)}
                           onNavigate={closeSheet}
                        />
                     ))}
                  </ul>
               </div>
            )}

            {aiVisLinks.length > 0 && (
               <div className="mobile-sheet-section">
                  <p className="mobile-sheet-section-label">AI Visibility</p>
                  <ul className="mobile-sheet-list">
                     {aiVisLinks.map((ln) => (
                        <MobileSheetLink
                           key={ln.href}
                           href={ln.href}
                           label={ln.label}
                           active={isMatch(ln.match)}
                           onNavigate={closeSheet}
                        />
                     ))}
                  </ul>
               </div>
            )}

            {toolsLinks.length > 0 && (
               <div className="mobile-sheet-section">
                  <p className="mobile-sheet-section-label">Tools</p>
                  <ul className="mobile-sheet-list">
                     {toolsLinks.map((ln) => (
                        <MobileSheetLink
                           key={ln.href}
                           href={ln.href}
                           label={ln.label}
                           active={isMatch(ln.match)}
                           onNavigate={closeSheet}
                        />
                     ))}
                  </ul>
               </div>
            )}

            {/* App links */}
            <div className="mobile-sheet-section">
               <p className="mobile-sheet-section-label">App</p>
               <ul className="mobile-sheet-list">
                  <li>
                     <button
                        type="button"
                        className="mobile-sheet-item"
                        onClick={() => { router.push(workspaceHref(activeId, '/settings/general')); closeSheet(); }}
                     >
                        <Icon type="settings-alt" size={18} color="rgba(255,255,255,0.55)" />
                        <span className="mobile-sheet-item-label">Settings</span>
                     </button>
                  </li>
                  <li>
                     <a
                        href="https://docs.serpbear.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="mobile-sheet-item"
                        onClick={() => setSheetOpen(false)}
                     >
                        <Icon type="question" size={18} color="rgba(255,255,255,0.55)" />
                        <span className="mobile-sheet-item-label">Help</span>
                     </a>
                  </li>
               </ul>
            </div>
            </div>

            <button
               type="button"
               className="mobile-sheet-close"
               onClick={() => setSheetOpen(false)}
               aria-label="Close menu"
            >
               <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
               </svg>
            </button>
         </div>
      </>
   );
};

export default MobileBottomNav;
