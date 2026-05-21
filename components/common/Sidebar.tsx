/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';

type SidebarProps = {
   domains?: DomainType[],
   showAddModal: Function,
   showSettings?: Function,
}

const Sidebar = ({ domains = [], showAddModal, showSettings = () => {} }: SidebarProps) => {
   const router = useRouter();

   const logoutUser = () => {
      window.location.href = '/api/auth/logout';
   };

   const isActiveDomain = (slug: string) => {
      return router.asPath.includes('/domain/') && router.asPath.includes(`/${slug}`);
   };

   const isActive = (path: string) => router.asPath === path;
   const isActivePrefix = (prefix: string) => router.asPath.startsWith(prefix);

   return (
      <div
         className="sidebar w-[220px] sticky top-0 h-screen hidden lg:flex flex-col flex-shrink-0"
         style={{
            background: 'var(--color-surface-strong)',
            borderRight: '1px solid var(--color-border-strong)',
         }}
         data-testid="sidebar"
      >
         {/* Logo */}
         <div className="px-[14px] pt-[21px] pb-[14px]">
            <Link href="/domains" passHref>
               <a
                  className="flex items-center gap-2 no-underline"
                  style={{
                     color: 'var(--color-text-primary)',
                     fontWeight: 600,
                     fontSize: 'var(--font-size-sm)',
                     letterSpacing: '-0.01em',
                  }}
               >
                  <Icon type="logo" size={20} color="var(--color-surface-raised)" />
                  SerpBear
               </a>
            </Link>
         </div>

         {/* Top navigation */}
         <nav className="flex flex-col flex-1 overflow-hidden px-[7px]">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
               {[
                  { href: '/dashboard', label: 'Dashboard', icon: 'domains', active: isActive('/dashboard') },
                  { href: '/domains', label: 'Domains', icon: 'domains', active: isActive('/domains') },
                  { href: '/research', label: 'Research', icon: 'research', active: isActive('/research') },
                  { href: '/articles', label: 'Artykuły SEO', icon: 'search', active: isActivePrefix('/articles') },
                  { href: domains.length > 0 ? `/domain/audit/${domains[0].slug}` : '/articles', label: 'Content Audit', icon: 'check', active: isActivePrefix('/domain/audit') },
               ].map(({ href, label, icon, active }) => (
                  <li key={href}>
                     <Link href={href} passHref>
                        <a
                           style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-5)',
                              padding: 'var(--space-5) var(--space-6)',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: active ? 500 : 400,
                              color: active ? 'var(--color-text-primary)' : 'rgba(255,255,255,0.45)',
                              background: active ? 'rgba(120,58,251,0.15)' : 'transparent',
                              textDecoration: 'none',
                              transition: `background var(--motion-fast), color var(--motion-fast)`,
                           }}
                           onMouseEnter={(e) => {
                              if (!active) {
                                 (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                                 (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)';
                              }
                           }}
                           onMouseLeave={(e) => {
                              if (!active) {
                                 (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                                 (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)';
                              }
                           }}
                        >
                           <span
                              style={{
                                 width: 18, height: 18,
                                 borderRadius: 'var(--radius-xs)',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 fontSize: 14, fontWeight: 700,
                                 color: active ? 'var(--color-surface-raised)' : 'rgba(255,255,255,0.5)',
                                 background: active ? 'rgba(120,58,251,0.15)' : 'rgba(255,255,255,0.07)',
                                 border: '1px solid var(--color-border-strong)',
                                 flexShrink: 0, lineHeight: 1,
                              }}
                           >
                              <Icon
                                 type={icon}
                                 size={12}
                                 color={active ? 'var(--color-surface-raised)' : 'rgba(255,255,255,0.5)'}
                              />
                           </span>
                           {label}
                        </a>
                     </Link>
                  </li>
               ))}
            </ul>

            {/* Domain list */}
            {domains.length > 0 && (
               <div className="mt-[21px] flex flex-col overflow-hidden min-h-0 flex-1">
                  <p
                     style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.25)',
                        padding: '0 var(--space-6)',
                        marginBottom: 'var(--space-4)',
                     }}
                  >
                     Sites
                  </p>
                  <ul className="overflow-y-auto styled-scrollbar-dark" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                     {domains.map((d) => {
                        const domActive = isActiveDomain(d.slug);
                        return (
                           <li key={d.domain}>
                              <Link href={`/domain/${d.slug}`} passHref>
                                 <a
                                    style={{
                                       display: 'flex',
                                       alignItems: 'center',
                                       gap: 'var(--space-5)',
                                       padding: 'var(--space-4) var(--space-6)',
                                       borderRadius: 'var(--radius-xs)',
                                       fontSize: 'var(--font-size-sm)',
                                       fontWeight: domActive ? 500 : 400,
                                       color: domActive ? 'var(--color-text-primary)' : 'rgba(255,255,255,0.45)',
                                       background: domActive ? 'rgba(120,58,251,0.15)' : 'transparent',
                                       textDecoration: 'none',
                                       transition: `background var(--motion-fast), color var(--motion-fast)`,
                                    }}
                                    onMouseEnter={(e) => {
                                       if (!domActive) {
                                          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                                          (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)';
                                       }
                                    }}
                                    onMouseLeave={(e) => {
                                       if (!domActive) {
                                          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                                          (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)';
                                       }
                                    }}
                                 >
                                    <img
                                       src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                                       alt=""
                                       style={{ width: 14, height: 14, borderRadius: 'var(--radius-xs)', flexShrink: 0 }}
                                    />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {d.domain}
                                    </span>
                                 </a>
                              </Link>
                           </li>
                        );
                     })}
                  </ul>
               </div>
            )}

            {/* Add Domain */}
            <div style={{ padding: 'var(--space-5) var(--space-4)', marginTop: 'var(--space-4)' }}>
               <button
                  data-testid="add_domain"
                  onClick={() => showAddModal(true)}
                  style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: 'var(--space-5)',
                     padding: 'var(--space-5) var(--space-6)',
                     borderRadius: 'var(--radius-xs)',
                     fontSize: 'var(--font-size-sm)',
                     fontWeight: 400,
                     color: 'rgba(255,255,255,0.45)',
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     width: '100%',
                     textAlign: 'left',
                     transition: `background var(--motion-fast), color var(--motion-fast)`,
                  }}
                  onMouseEnter={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
                  }}
                  onMouseLeave={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
                  }}
               >
                  <span
                     style={{
                        width: 18,
                        height: 18,
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.5)',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid var(--color-border-strong)',
                        flexShrink: 0,
                        lineHeight: 1,
                     }}
                  >
                     +
                  </span>
                  Add Domain
               </button>
            </div>
         </nav>

         {/* Bottom navigation */}
         <div
            style={{
               padding: 'var(--space-5) var(--space-4)',
               borderTop: '1px solid var(--color-border-strong)',
               display: 'flex',
               flexDirection: 'column',
               gap: '2px',
            }}
         >
            {[
               { label: 'Settings', icon: 'settings-alt', onClick: () => router.push('/settings') },
               { label: 'Logout', icon: 'logout', onClick: logoutUser },
            ].map(({ label, icon, onClick }) => (
               <button
                  key={label}
                  onClick={onClick}
                  style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: 'var(--space-5)',
                     padding: 'var(--space-5) var(--space-6)',
                     borderRadius: 'var(--radius-xs)',
                     fontSize: 'var(--font-size-sm)',
                     fontWeight: 400,
                     color: 'rgba(255,255,255,0.4)',
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     width: '100%',
                     textAlign: 'left',
                     transition: `background var(--motion-fast), color var(--motion-fast)`,
                  }}
                  onMouseEnter={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
                  }}
                  onMouseLeave={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
                  }}
               >
                  <span
                     style={{
                        width: 18, height: 18,
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700,
                        color: 'rgba(255,255,255,0.5)',
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid var(--color-border-strong)',
                        flexShrink: 0, lineHeight: 1,
                     }}
                  >
                     <Icon type={icon} size={12} color="rgba(255,255,255,0.5)" />
                  </span>
                  {label}
               </button>
            ))}
            <a
               href="https://docs.serpbear.com/"
               target="_blank"
               rel="noreferrer"
               style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-5)',
                  padding: 'var(--space-5) var(--space-6)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.4)',
                  background: 'transparent',
                  textDecoration: 'none',
                  transition: `background var(--motion-fast), color var(--motion-fast)`,
               }}
               onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)';
               }}
               onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)';
               }}
            >
               <span
                  style={{
                     width: 18, height: 18,
                     borderRadius: 'var(--radius-xs)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontSize: 14, fontWeight: 700,
                     color: 'rgba(255,255,255,0.5)',
                     background: 'rgba(255,255,255,0.07)',
                     border: '1px solid var(--color-border-strong)',
                     flexShrink: 0, lineHeight: 1,
                  }}
               >
                  <Icon type="question" size={12} color="rgba(255,255,255,0.5)" />
               </span>
               Help
            </a>
         </div>
      </div>
   );
};

export default Sidebar;
