import React, { useEffect, useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import SidebarLaunchpad from '../settings/SidebarLaunchpad';
import { deriveActiveId, workspaceHref } from '../../lib/activeWorkspace';
import { useWorkspaces } from '../../services/workspaces';

type SidebarProps = {
   domains?: DomainType[];
   showAddModal: Function;
   showSettings?: Function;
};

/* ── Inline SVGs (16×16 display, 24×24 viewBox) ───────────────────────── */

const IcoDashboard = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3 12H21M12 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoContentEditor = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M16 8.00007L2 22.0001M18 15.0001H9M6.6 19.0001H13.3373C13.5818 19.0001 13.7041 19.0001 13.8192 18.9724C13.9213 18.9479 14.0188 18.9075 14.1083 18.8527C14.2092 18.7909 14.2957 18.7044 14.4686 18.5314L19.5 13.5001C19.739 13.2611 19.8584 13.1416 19.9546 13.0358C22.0348 10.7474 22.0348 7.25275 19.9546 4.9643C19.8584 4.85851 19.739 4.73903 19.5 4.50007C19.261 4.26111 19.1416 4.14163 19.0358 4.04547C16.7473 1.96531 13.2527 1.96531 10.9642 4.04547C10.8584 4.14163 10.739 4.26111 10.5 4.50007L5.46863 9.53144C5.29568 9.70439 5.2092 9.79087 5.14736 9.89179C5.09253 9.98126 5.05213 10.0788 5.02763 10.1808C5 10.2959 5 10.4182 5 10.6628V17.4001C5 17.9601 5 18.2401 5.10899 18.4541C5.20487 18.6422 5.35785 18.7952 5.54601 18.8911C5.75992 19.0001 6.03995 19.0001 6.6 19.0001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoSites = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22M12 2C9.49872 4.73835 8.07725 8.29203 8 12C8.07725 15.708 9.49872 19.2616 12 22M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22M2.50002 9H21.5M2.5 15H21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoAudit = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M16 4C16.93 4 17.395 4 17.7765 4.10222C18.8117 4.37962 19.6204 5.18827 19.8978 6.22354C20 6.60504 20 7.07003 20 8V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V8C4 7.07003 4 6.60504 4.10222 6.22354C4.37962 5.18827 5.18827 4.37962 6.22354 4.10222C6.60504 4 7.07003 4 8 4M9 15L11 17L15.5 12.5M9.6 6H14.4C14.9601 6 15.2401 6 15.454 5.89101C15.6422 5.79513 15.7951 5.64215 15.891 5.45399C16 5.24008 16 4.96005 16 4.4V3.6C16 3.03995 16 2.75992 15.891 2.54601C15.7951 2.35785 15.6422 2.20487 15.454 2.10899C15.2401 2 14.9601 2 14.4 2H9.6C9.03995 2 8.75992 2 8.54601 2.10899C8.35785 2.20487 8.20487 2.35785 8.10899 2.54601C8 2.75992 8 3.03995 8 3.6V4.4C8 4.96005 8 5.24008 8.10899 5.45399C8.20487 5.64215 8.35785 5.79513 8.54601 5.89101C8.75992 6 9.03995 6 9.6 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoTopicResearch = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M11.223 2.43177C11.5066 2.27421 11.6484 2.19543 11.7985 2.16454C11.9315 2.13721 12.0685 2.13721 12.2015 2.16454C12.3516 2.19543 12.4934 2.27421 12.777 2.43177L20.177 6.54288C20.4766 6.70928 20.6263 6.79248 20.7354 6.91082C20.8318 7.01551 20.9049 7.13959 20.9495 7.27477C21 7.42756 21 7.59889 21 7.94153V16.0586C21 16.4013 21 16.5726 20.9495 16.7254C20.9049 16.8606 20.8318 16.9847 20.7354 17.0893C20.6263 17.2077 20.4766 17.2909 20.177 17.4573L12.777 21.5684C12.4934 21.726 12.3516 21.8047 12.2015 21.8356C12.0685 21.863 11.9315 21.863 11.7985 21.8356C11.6484 21.8047 11.5066 21.726 11.223 21.5684L3.82297 17.4573C3.52345 17.2909 3.37369 17.2077 3.26463 17.0893C3.16816 16.9847 3.09515 16.8606 3.05048 16.7254C3 16.5726 3 16.4013 3 16.0586V7.94153C3 7.59889 3 7.42756 3.05048 7.27477C3.09515 7.13959 3.16816 7.01551 3.26463 6.91082C3.37369 6.79248 3.52345 6.70928 3.82297 6.54288L11.223 2.43177Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoKeywordResearch = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M4 7C4 6.06812 4 5.60218 4.15224 5.23463C4.35523 4.74458 4.74458 4.35523 5.23463 4.15224C5.60218 4 6.06812 4 7 4H17C17.9319 4 18.3978 4 18.7654 4.15224C19.2554 4.35523 19.6448 4.74458 19.8478 5.23463C20 5.60218 20 6.06812 20 7M9 20H15M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoAIHumanizer = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M7.5 8V9.5M16.5 8V9.5M11 12.6001C11.8 12.6001 12.5 11.9001 12.5 11.1001V8M15.2002 15.2C13.4002 17 10.5002 17 8.7002 15.2M3 7.8L3 16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27977 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3L7.8 3C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/* ── NavItem ──────────────────────────────────────────────────────────────── */

type NavItemProps = {
   href: string;
   label: string;
   icon: React.ReactNode;
   active: boolean;
};

const NavItem = ({ href, label, icon, active }: NavItemProps) => (
   <Link href={href} passHref>
      <a
         aria-label={label}
         style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
            fontWeight: 500,
            textDecoration: 'none',
            width: '100%',
            color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
            transition: 'color 150ms ease',
         }}
         className="sidebar-nav-item"
         data-active={active}
      >
         {/* hover/active background layer */}
         <span
            aria-hidden="true"
            style={{
               position: 'absolute',
               inset: 0,
               zIndex: -1,
               borderRadius: '0.5rem',
               background: '#2F2F34',
               opacity: active ? 1 : 0,
               transition: 'opacity 150ms ease',
            }}
            className="sidebar-nav-bg"
         />
         {icon}
         <span style={{ flexGrow: 1 }}>{label}</span>
      </a>
   </Link>
);

/* ── Domain sub-nav icons ─────────────────────────────────────────────────── */

const IcoPerformance = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3 17L9 11L13 15L21 7M21 7H16M21 7V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoRecommendations = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path fill="currentColor" fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12" clipRule="evenodd" />
   </svg>
);
const IcoContentAudit = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M14 11H8M10 15H8M16 7H8M20 10.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H11.5M22 22L20.5 20.5M21.5 18C21.5 19.933 19.933 21.5 18 21.5C16.067 21.5 14.5 19.933 14.5 18C14.5 16.067 16.067 14.5 18 14.5C19.933 14.5 21.5 16.067 21.5 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoTopicalMap = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M11.223 2.43177C11.5066 2.27421 11.6484 2.19543 11.7985 2.16454C11.9315 2.13721 12.0685 2.13721 12.2015 2.16454C12.3516 2.19543 12.4934 2.27421 12.777 2.43177L20.177 6.54288C20.4766 6.70928 20.6263 6.79248 20.7354 6.91082C20.8318 7.01551 20.9049 7.13959 20.9495 7.27477C21 7.42756 21 7.59889 21 7.94153V16.0586C21 16.4013 21 16.5726 20.9495 16.7254C20.9049 16.8606 20.8318 16.9847 20.7354 17.0893C20.6263 17.2077 20.4766 17.2909 20.177 17.4573L12.777 21.5684C12.4934 21.726 12.3516 21.8047 12.2015 21.8356C12.0685 21.863 11.9315 21.863 11.7985 21.8356C11.6484 21.8047 11.5066 21.726 11.223 21.5684L3.82297 17.4573C3.52345 17.2909 3.37369 17.2077 3.26463 17.0893C3.16816 16.9847 3.09515 16.8606 3.05048 16.7254C3 16.5726 3 16.4013 3 16.0586V7.94153C3 7.59889 3 7.42756 3.05048 7.27477C3.09515 7.13959 3.16816 7.01551 3.26463 6.91082C3.37369 6.79248 3.52345 6.70928 3.82297 6.54288L11.223 2.43177Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoActivityLog = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M22.7 13.5L20.7005 11.5L18.7 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
/* ── AI Visibility sub-nav icons (14px to match SEO group) ────────────── */
const IcoOverview = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 12H21M12 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoSources = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22M12 2C9.49872 4.73835 8.07725 8.29203 8 12C8.07725 15.708 9.49872 19.2616 12 22M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22M2.50002 9H21.5M2.5 15H21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoCompetitors = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 21V7C8 6.07003 8 5.60504 8.10222 5.22354C8.37962 4.18827 9.18827 3.37962 10.2235 3.10222C10.605 3 11.07 3 12 3C12.93 3 13.395 3 13.7765 3.10222C14.8117 3.37962 15.6204 4.18827 15.8978 5.22354C16 5.60504 16 6.07003 16 7V21M5.2 21H18.8C19.9201 21 20.4802 21 20.908 20.782C21.2843 20.5903 21.5903 20.2843 21.782 19.908C22 19.4802 22 18.9201 22 17.8V10.2C22 9.07989 22 8.51984 21.782 8.09202C21.5903 7.71569 21.2843 7.40973 20.908 7.21799C20.4802 7 19.9201 7 18.8 7H5.2C4.07989 7 3.51984 7 3.09202 7.21799C2.71569 7.40973 2.40973 7.71569 2.21799 8.09202C2 8.51984 2 9.07989 2 10.2V17.8C2 18.9201 2 19.4802 2.21799 19.908C2.40973 20.2843 2.71569 20.5903 3.09202 20.782C3.51984 21 4.0799 21 5.2 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoPrompts = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 15L10 12L7 9M13 15H17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const IcoFanout = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M21 21L16.65 16.65M11 6C13.7614 6 16 8.23858 16 11M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/* ── Reusable sub-nav item + collapsible group ────────────────────────── */
const subNavStyle = (active: boolean): React.CSSProperties => ({
   display: 'flex',
   alignItems: 'center',
   gap: '0.5rem',
   padding: '5px 8px',
   borderRadius: '0.375rem',
   fontSize: '0.8125rem',
   fontWeight: active ? 600 : 400,
   textDecoration: 'none',
   color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
   background: active ? '#2F2F34' : 'transparent',
   transition: 'color 120ms, background 120ms',
});
const subNavHoverIn = (e: React.MouseEvent<HTMLElement>, active: boolean) => {
   if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }
};
const subNavHoverOut = (e: React.MouseEvent<HTMLElement>, active: boolean) => {
   if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }
};

// Flame icon: static shape, only the fill slowly shimmers through fire colors
// (red → orange → amber → red). Respects prefers-reduced-motion.
const IcoFlame = () => {
   const reduce = useReducedMotion();
   return (
      <svg viewBox="0 0 20 20" width="16" height="16" style={{ flexShrink: 0 }} aria-hidden="true">
         <motion.path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039q.418.53.943.954c.332.269.786-.049.773-.476L7 7c0-.919.206-1.789.575-2.567a6.03 6.03 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.97 6.97 0 0 0 13.5 4.938M14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.91-3.182c-.093-.429.44-.643.814-.413a4 4 0 0 0 1.601.564c.303.038.531-.24.51-.544a5.98 5.98 0 0 1 1.315-4.192a.45.45 0 0 1 .431-.16A4 4 0 0 1 14 12"
            fill="#FB5D5D"
            animate={reduce ? { fill: '#FB5D5D' } : { fill: ['#FB5D5D', '#FF8A3D', '#FFC24D', '#FF6A3D', '#FB5D5D'] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
         />
      </svg>
   );
};

type SubNavItemProps = { href: string; label: string; icon: React.ReactNode; active: boolean; badge?: string; count?: number; mock?: boolean };
const SubNavItem = ({ href, label, icon, active, badge, count, mock }: SubNavItemProps) => {
   const inner = (
      <>
         {icon}
         <span style={{ flexGrow: 1 }}>{label}</span>
         {count != null && count > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
               <IcoFlame />
               <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>{count}</span>
            </span>
         )}
         {badge && (
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#71717b', border: '1px solid #3F3F47', borderRadius: 4, padding: '0 4px', lineHeight: '16px' }}>{badge}</span>
         )}
      </>
   );
   if (mock) {
      return (
         <a href="#" onClick={(e) => e.preventDefault()} style={subNavStyle(active)} onMouseEnter={(e) => subNavHoverIn(e, active)} onMouseLeave={(e) => subNavHoverOut(e, active)}>{inner}</a>
      );
   }
   return (
      <Link href={href} passHref>
         <a style={subNavStyle(active)} onMouseEnter={(e) => subNavHoverIn(e, active)} onMouseLeave={(e) => subNavHoverOut(e, active)}>{inner}</a>
      </Link>
   );
};

const ChevronToggle = ({ open }: { open: boolean }) => (
   <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0, marginLeft: 'auto', transition: 'transform 250ms ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
   </svg>
);

/* Eye toggle — open eye when expanded, slashed eye when collapsed
   (the password show/hide pattern). */
const EyeToggle = ({ open }: { open: boolean }) => (
   open ? (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
         <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
         <circle cx="12" cy="12" r="3" />
      </svg>
   ) : (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
         <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
         <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
         <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
         <path d="m2 2 20 20" />
      </svg>
   )
);

const CollapsibleGroup = ({ label, open, onToggle, children, toggleIcon = 'chevron' }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode; toggleIcon?: 'eye' | 'chevron' }) => (
   <div>
      <button
         type="button"
         onClick={onToggle}
         style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%', paddingLeft: '0.375rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.8125rem', lineHeight: '1rem', fontWeight: 600, color: '#71717b', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '0.25rem' }}
      >
         {label}
         {toggleIcon === 'eye' ? <EyeToggle open={open} /> : <ChevronToggle open={open} />}
      </button>
      <div style={{ overflow: 'hidden', maxHeight: open ? '500px' : '0', transition: 'max-height 200ms ease-out' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>{children}</div>
      </div>
   </div>
);

const SEO_SUB_NAV = [
   { key: 'performance', label: 'Performance', icon: <IcoPerformance /> },
   { key: 'content-audit', label: 'Content Audit', icon: <IcoContentAudit /> },
   { key: 'topical-map', label: 'Topical Map', icon: <IcoTopicalMap /> },
];

const AI_VIS_NAV: { label: string; icon: React.ReactNode; badge?: string }[] = [
   { label: 'Overview', icon: <IcoOverview /> },
   { label: 'Sources', icon: <IcoSources /> },
   { label: 'Competitors', icon: <IcoCompetitors /> },
   { label: 'Prompts', icon: <IcoPrompts /> },
   { label: 'Fanout Queries', icon: <IcoFanout />, badge: 'Beta' },
];

const LS_KEY = 'serpbear_selected_domain';

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

const Sidebar = ({ domains = [], showAddModal, showSettings = () => {} }: SidebarProps) => {
   const router = useRouter();
   const [toolsOpen, setToolsOpen] = useState(true);
   const [seoOpen, setSeoOpen] = useState(true);
   const [aiVisOpen, setAiVisOpen] = useState(true);

   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);

   // Workspace data
   const { data: wsData } = useWorkspaces();
   const workspaces = wsData?.workspaces || [];

   // Active workspace id — SSR-safe: the URL is only read after mount (router.asPath
   // differs server vs client under the /workspace rewrite, which would mismatch hrefs).
   const activeId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
   const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;
   const activeName = activeWorkspace?.name ?? null; // the workspace's domain name (e.g. "idztech.pl")

   // Detect domain slug from current URL (e.g. /sites/[slug]/...)
   const urlSlugMatch = router.asPath.match(/^(?:\/workspace\/\d+)?\/(?:domain|sites)\/([^/?#]+)/);
   const urlSlug = urlSlugMatch ? urlSlugMatch[1] : null;

   // selectedDomainSlug — synced from URL/localStorage. MUST start null: reading
   // localStorage in the useState initializer makes the first client render differ from
   // the server (which has none) → it flows into activeSlug → a Link href mismatch.
   const [selectedDomainSlug, setSelectedDomainSlug] = useState<string | null>(null);
   useEffect(() => {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setSelectedDomainSlug((cur) => cur ?? stored);
   }, []);

   // When the URL points to a specific domain, sync it as selected + persist
   useEffect(() => {
      if (urlSlug && urlSlug !== selectedDomainSlug) {
         setSelectedDomainSlug(urlSlug);
         localStorage.setItem(LS_KEY, urlSlug);
      }
   }, [urlSlug]);

   // Fallback: if no selection yet but domains are loaded, pick the first one
   useEffect(() => {
      if (!selectedDomainSlug && domains.length > 0) {
         const first = domains[0].slug;
         setSelectedDomainSlug(first);
         localStorage.setItem(LS_KEY, first);
      }
   }, [domains, selectedDomainSlug]);

   // Resolve activeSlug: match active workspace's domain name against the domains prop
   const activeSlug = useMemo(() => {
      if (activeName) {
         const match = domains.find((d) => d.domain === activeName);
         if (match) return match.slug;
      }
      return selectedDomainSlug;
   }, [activeName, domains, selectedDomainSlug]);

   // Recommendations counter — shares the dashboard's ['domainRecs', slug] query, so the
   // pipeline's done-invalidation (and any other refresh) updates this badge immediately
   // instead of going stale behind a separate 60s articles cache.
   const { data: domainRecsData } = useQuery(
      ['domainRecs', activeSlug],
      () => fetch(`/api/domains/${activeSlug}/recommendations`).then((r) => r.json()),
      { enabled: !!activeSlug, staleTime: 30 * 1000 },
   );
   const recommendationCount = useMemo(() => {
      type DomainRec = { type?: string | null; score?: number | null };
      const recs = (domainRecsData?.recommendations ?? []) as DomainRec[];
      // Match the dashboard: drop optimize recs with a 0/missing score.
      return recs.filter((r) => {
         const isOptimize = r.type === 'optimize' || r.score != null;
         return !isOptimize || (r.score ?? 0) > 0;
      }).length;
   }, [domainRecsData]);

   const toolItems = [
      { href: workspaceHref(activeId, '/dashboard'), label: 'Audit', icon: <IcoAudit /> },
      { href: workspaceHref(activeId, '/dashboard'), label: 'Topic Research', icon: <IcoTopicResearch /> },
      { href: workspaceHref(activeId, '/research'), label: 'Keyword Research', icon: <IcoKeywordResearch /> },
      { href: workspaceHref(activeId, '/content-editor'), label: 'AI Humanizer', icon: <IcoAIHumanizer /> },
   ];

   // Active-state helpers using asPath suffix matching
   const isActiveSuffix = (suffix: string) => mounted && router.asPath.includes(suffix);
   const isActiveDashboard = () => mounted && router.asPath.endsWith('/dashboard');
   // Recommendations active state is read in 4 spots below — compute the suffix once.
   const recommendationsActive = isActiveSuffix(`/sites/${activeSlug}/recommendations`);

   return (
      <>
         <style dangerouslySetInnerHTML={{ __html: `
            .sidebar-nav-item:hover .sidebar-nav-bg { opacity: 1 !important; }
            .sidebar-nav-item:hover { color: #ffffff !important; }
            .sidebar-nav-item[data-active="true"] .sidebar-nav-bg { opacity: 1 !important; }
            .domain-switcher-row:hover { background: rgba(255,255,255,0.07) !important; }
         ` }} />

         <div
            className="no-scrollbar hidden lg:flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden"
            style={{
               width: 248,
               background: 'var(--color-surface-strong)',
               borderRight: '1px solid var(--color-border-strong)',
               gap: '0.25rem',
               padding: '0 0 88px 0',
            }}
            data-testid="sidebar"
         >

            {/* Top nav items: Dashboard, Recommendations, Activity Log, Content Editor */}
            <nav
               style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.125rem',
                  padding: '4px 8px 0',
               }}
            >
               <NavItem
                  href={workspaceHref(activeId, '/dashboard')}
                  label="Dashboard"
                  icon={<IcoDashboard />}
                  active={isActiveDashboard()}
               />
               {activeSlug && (
                  <>
                     {/* Recommendations — top-level with flame badge */}
                     <Link href={workspaceHref(activeId, `/sites/${activeSlug}/recommendations`)} passHref>
                        <a
                           aria-label="Recommendations"
                           style={{
                              position: 'relative',
                              zIndex: 1,
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem',
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              lineHeight: '1.25rem',
                              fontWeight: 500,
                              textDecoration: 'none',
                              width: '100%',
                              color: recommendationsActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                              transition: 'color 150ms ease',
                           }}
                           className="sidebar-nav-item"
                           data-active={recommendationsActive}
                        >
                           <span
                              aria-hidden="true"
                              style={{
                                 position: 'absolute',
                                 inset: 0,
                                 zIndex: -1,
                                 borderRadius: '0.5rem',
                                 background: '#2F2F34',
                                 opacity: recommendationsActive ? 1 : 0,
                                 transition: 'opacity 150ms ease',
                              }}
                              className="sidebar-nav-bg"
                           />
                           <IcoRecommendations />
                           <span style={{ flexGrow: 1 }}>Recommendations</span>
                           {recommendationCount > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                 <IcoFlame />
                                 <span style={{ fontSize: 12, fontWeight: 600, color: recommendationsActive ? '#fff' : 'rgba(255,255,255,0.6)' }}>{recommendationCount}</span>
                              </span>
                           )}
                        </a>
                     </Link>
                     {/* Activity Log — top-level */}
                     <NavItem
                        href={workspaceHref(activeId, `/sites/${activeSlug}/activity-log`)}
                        label="Activity Log"
                        icon={<IcoActivityLog />}
                        active={isActiveSuffix(`/sites/${activeSlug}/activity-log`)}
                     />
                  </>
               )}
               <NavItem
                  href={workspaceHref(activeId, '/articles')}
                  label="Content Editor"
                  icon={<IcoContentEditor />}
                  active={isActiveSuffix('/articles')}
               />
            </nav>

            {/* Domain section — SEO + AI Visibility groups */}
            {mounted && activeSlug && (
               <div style={{ padding: '4px 8px 0' }}>
                  {/* SEO group: Performance, Content Audit, Topical Map */}
                  <CollapsibleGroup label="SEO" open={seoOpen} onToggle={() => setSeoOpen((v) => !v)} toggleIcon="eye">
                     {SEO_SUB_NAV.map((item) => {
                        const seoPath = item.key === 'performance'
                           ? `/sites/${activeSlug}`
                           : `/sites/${activeSlug}/${item.key}`;
                        const href = workspaceHref(activeId, seoPath);
                        const active = mounted && isActiveSuffix(seoPath);
                        return <SubNavItem key={item.key} href={href} label={item.label} icon={item.icon} active={active} />;
                     })}
                  </CollapsibleGroup>

                  {/* AI Visibility group (mockup pages) */}
                  <CollapsibleGroup label="AI Visibility" open={aiVisOpen} onToggle={() => setAiVisOpen((v) => !v)} toggleIcon="eye">
                     {AI_VIS_NAV.map((item) => (
                        <SubNavItem key={item.label} href="#" label={item.label} icon={item.icon} active={false} badge={item.badge} mock />
                     ))}
                  </CollapsibleGroup>
               </div>
            )}

            {/* More tools collapsible section */}
            <div style={{ padding: '0 8px' }}>
               <CollapsibleGroup label="More tools" open={toolsOpen} onToggle={() => setToolsOpen((v) => !v)}>
                  {toolItems.map((item) => (
                     <NavItem key={item.label} href={item.href} label={item.label} icon={item.icon} active={false} />
                  ))}
               </CollapsibleGroup>
            </div>
         </div>

         <SidebarLaunchpad />
      </>
   );
};

export default Sidebar;
