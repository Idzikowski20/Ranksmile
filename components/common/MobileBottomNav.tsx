/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';

type MobileBottomNavProps = {
   domains?: DomainType[];
   showAddModal: () => void;
   showSettings?: () => void;
};

const MobileBottomNav = ({ domains = [], showAddModal, showSettings }: MobileBottomNavProps) => {
   const router = useRouter();
   const [sheetOpen, setSheetOpen] = useState(false);

   const isActive = (path: string) => router.asPath === path;
   const isActivePrefix = (prefix: string) => router.asPath.startsWith(prefix);
   const isActiveDomain = (slug: string) => router.asPath.includes('/domain/') && router.asPath.includes(`/${slug}`);

   const primaryItems = [
      {
         href: '/dashboard',
         label: 'Dashboard',
         icon: 'domains' as const,
         active: isActive('/dashboard'),
      },
      {
         href: '/content-editor',
         label: 'Content',
         icon: 'search' as const,
         active: isActivePrefix('/articles') || isActivePrefix('/content-editor'),
      },
      {
         href: '/sites',
         label: 'Sites',
         icon: 'research' as const,
         active: isActive('/sites'),
      },
   ];

   const domainsActive = router.asPath.includes('/domain/');

   return (
      <>
         {/* Fixed bottom bar */}
         <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile navigation">
            {primaryItems.map(({ href, label, icon, active }) => (
               <Link href={href} passHref key={href}>
                  <a
                     className={`mobile-nav-item${active ? ' mobile-nav-item--active' : ''}`}
                     onClick={() => setSheetOpen(false)}
                  >
                     <Icon type={icon} size={22} color={active ? '#ffffff' : 'rgba(255,255,255,0.45)'} />
                     <span className="mobile-nav-label">{label}</span>
                  </a>
               </Link>
            ))}

            {/* Sites tab — opens sheet on mobile if more than 1 domain, else goes to dashboard */}
            <button
               type="button"
               className={`mobile-nav-item${domainsActive ? ' mobile-nav-item--active' : ''}`}
               onClick={() => setSheetOpen(true)}
               aria-expanded={sheetOpen}
               aria-haspopup="dialog"
            >
               <Icon type="menu" size={22} color={domainsActive ? '#ffffff' : 'rgba(255,255,255,0.45)'} />
               <span className="mobile-nav-label">More</span>
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
            <div className="mobile-sheet-handle" />

            {/* Sites / Domains */}
            {domains.length > 0 && (
               <div className="mobile-sheet-section">
                  <p className="mobile-sheet-section-label">Sites</p>
                  <ul className="mobile-sheet-list">
                     {domains.map((d) => {
                        const domActive = isActiveDomain(d.slug);
                        return (
                           <li key={d.domain}>
                              <Link href={`/domain/${d.slug}`} passHref>
                                 <a
                                    className={`mobile-sheet-item${domActive ? ' mobile-sheet-item--active' : ''}`}
                                    onClick={() => setSheetOpen(false)}
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
                     onClick={() => { showAddModal(); setSheetOpen(false); }}
                  >
                     <span className="mobile-sheet-item-icon">+</span>
                     <span className="mobile-sheet-item-label">Add Domain</span>
                  </button>
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
                        onClick={() => { router.push('/settings'); setSheetOpen(false); }}
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
      </>
   );
};

export default MobileBottomNav;
