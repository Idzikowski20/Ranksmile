import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

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

const IcoAITracker = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M1.59859 11.7173C1.60137 11.1596 2.05425 10.7089 2.61196 10.7089C3.17174 10.7089 3.62548 11.1628 3.62533 11.7226L3.62386 17.0295C3.62769 18.4792 4.8088 19.6157 6.19523 19.6157H17.0338C18.472 19.6157 19.6775 18.4267 19.6775 17.031L19.702 6.05271C19.6374 4.66436 18.4839 3.59098 17.1365 3.59098H11.9389C11.3679 3.59098 10.905 3.12811 10.905 2.55713C10.905 1.98615 11.3679 1.52328 11.9389 1.52328H17.0851C19.5055 1.52328 21.5591 3.43526 21.7122 5.8803L21.7322 17.031C21.7322 19.564 19.6021 21.6834 17.0338 21.6834H6.19523C3.67823 21.6834 1.57217 19.6157 1.57217 17.031L1.59859 11.7173Z" fill="currentColor" />
      <path d="M15.1376 7.50336C15.6347 7.50336 16.0376 7.9063 16.0376 8.40336V16.5034C16.0376 17.0004 15.6347 17.4034 15.1376 17.4034C14.6406 17.4034 14.2376 17.0004 14.2376 16.5034V8.40336C14.2376 7.9063 14.6406 7.50336 15.1376 7.50336Z" fill="currentColor" />
      <path d="M11.5376 10.2034C12.0347 10.2034 12.4376 10.6063 12.4376 11.1034V16.5034C12.4376 17.0004 12.0347 17.4034 11.5376 17.4034C11.0406 17.4034 10.6376 17.0004 10.6376 16.5034V11.1034C10.6376 10.6063 11.0406 10.2034 11.5376 10.2034Z" fill="currentColor" />
      <path d="M8.83765 13.8034C8.83765 13.3063 8.4347 12.9034 7.93765 12.9034C7.44059 12.9034 7.03765 13.3063 7.03765 13.8034V16.5034C7.03765 17.0004 7.44059 17.4034 7.93765 17.4034C8.4347 17.4034 8.83765 17.0004 8.83765 16.5034V13.8034Z" fill="currentColor" />
      <path d="M7.03779 10.1756C7.41779 10.1756 7.74496 9.90742 7.81948 9.5348L8.00961 8.58413C8.07273 8.26856 8.3194 8.0219 8.63496 7.95878L9.58563 7.76865C9.95825 7.69413 10.2265 7.36696 10.2265 6.98696C10.2265 6.60697 9.95825 6.2798 9.58563 6.20527L8.63496 6.01514C8.3194 5.95203 8.07273 5.70536 8.00961 5.38979L7.81948 4.43912C7.74496 4.06651 7.41779 3.79829 7.03779 3.79829C6.6578 3.79829 6.33063 4.06651 6.25611 4.43912L6.06597 5.38979C6.00286 5.70536 5.75619 5.95203 5.44062 6.01514L4.48995 6.20527C4.11734 6.2798 3.84912 6.60697 3.84912 6.98696C3.84912 7.36696 4.11734 7.69413 4.48995 7.76865L5.44062 7.95878C5.75619 8.0219 6.00286 8.26856 6.06597 8.58413L6.25611 9.5348C6.33063 9.90742 6.6578 10.1756 7.03779 10.1756Z" fill="currentColor" />
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

const IcoSERPAnalyzer = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M22 22L20.5 20.5M22 10H2M22 12V8.2C22 7.0799 22 6.51984 21.782 6.09202C21.5903 5.7157 21.2843 5.40974 20.908 5.21799C20.4802 5 19.9201 5 18.8 5H5.2C4.0799 5 3.51984 5 3.09202 5.21799C2.7157 5.40973 2.40973 5.71569 2.21799 6.09202C2 6.51984 2 7.0799 2 8.2V15.8C2 16.9201 2 17.4802 2.21799 17.908C2.40973 18.2843 2.71569 18.5903 3.09202 18.782C3.51984 19 4.0799 19 5.2 19H10.5M21.5 18C21.5 19.933 19.933 21.5 18 21.5C16.067 21.5 14.5 19.933 14.5 18C14.5 16.067 16.067 14.5 18 14.5C19.933 14.5 21.5 16.067 21.5 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const IcoRankTracker = () => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M7.13515 11.189L3.3304 4.38052C2.89291 3.59765 2.67417 3.20621 2.71103 2.88573C2.7432 2.60611 2.8917 2.353 3.1201 2.18852C3.38188 2 3.83029 2 4.72711 2H6.96193C7.29523 2 7.46187 2 7.61135 2.04813C7.74362 2.09073 7.86556 2.16042 7.96939 2.25276C8.08674 2.35712 8.17132 2.5007 8.3405 2.78788L12.0001 9L15.6597 2.78788C15.8289 2.5007 15.9135 2.35712 16.0308 2.25276C16.1347 2.16042 16.2566 2.09073 16.3889 2.04813C16.5383 2 16.705 2 17.0383 2H19.2731C20.1699 2 20.6183 2 20.8801 2.18852C21.1085 2.353 21.257 2.60611 21.2892 2.88573C21.326 3.20621 21.1073 3.59765 20.6698 4.38052L16.8651 11.189M10.5001 14L12.0001 13V18M10.7501 18H13.2501M16.5963 10.9038C19.1347 13.4422 19.1347 17.5578 16.5963 20.0962C14.0579 22.6346 9.94232 22.6346 7.40391 20.0962C4.8655 17.5578 4.8655 13.4422 7.40391 10.9038C9.94231 8.3654 14.0579 8.3654 16.5963 10.9038Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

const DOMAIN_SUB_NAV = [
   { key: 'performance', label: 'Performance', icon: <IcoPerformance /> },
   { key: 'recommendations', label: 'Recommendations', icon: <IcoRecommendations /> },
   { key: 'content-audit', label: 'Content Audit', icon: <IcoContentAudit /> },
   { key: 'topical-map', label: 'Topical Map', icon: <IcoTopicalMap /> },
   { key: 'activity-log', label: 'Activity Log', icon: <IcoActivityLog /> },
];

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

const Sidebar = ({ domains = [], showAddModal, showSettings = () => {} }: SidebarProps) => {
   const router = useRouter();
   const [toolsOpen, setToolsOpen] = useState(true);
   const [domainNavOpen, setDomainNavOpen] = useState(true);

   const isActive = (path: string) => router.asPath === path;
   const isActivePrefix = (prefix: string) => router.asPath.startsWith(prefix);

   // Detect active domain slug from router
   const domainSlugMatch = router.asPath.match(/^\/(?:domain|sites)\/([^/]+)/);
   const activeDomainSlug = domainSlugMatch ? domainSlugMatch[1] : null;
   const activeDomain = activeDomainSlug ? domains.find((d) => d.slug === activeDomainSlug) : null;

   const topItems = [
      {
         href: '/dashboard',
         label: 'Dashboard',
         icon: <IcoDashboard />,
         active: isActive('/dashboard'),
      },
      {
         href: '/articles',
         label: 'Content Editor',
         icon: <IcoContentEditor />,
         active: isActivePrefix('/articles'),
      },
      {
         href: '/sites',
         label: 'Sites',
         icon: <IcoSites />,
         active: isActivePrefix('/sites'),
      },
   ];

   const toolItems = [
      { href: '/dashboard', label: 'Audit', icon: <IcoAudit /> },
      { href: '/dashboard', label: 'Topic Research', icon: <IcoTopicResearch /> },
      { href: '/research', label: 'Keyword Research', icon: <IcoKeywordResearch /> },
      { href: '/dashboard', label: 'SERP Analyzer', icon: <IcoSERPAnalyzer /> },
      { href: '/research', label: 'Rank Tracker', icon: <IcoRankTracker /> },
      { href: '/content-editor', label: 'AI Humanizer', icon: <IcoAIHumanizer /> },
   ];

   return (
      <>
         <style dangerouslySetInnerHTML={{ __html: `
            .sidebar-nav-item:hover .sidebar-nav-bg { opacity: 1 !important; }
            .sidebar-nav-item:hover { color: #ffffff !important; }
            .sidebar-nav-item[data-active="true"] .sidebar-nav-bg { opacity: 1 !important; }
         ` }} />

         <div
            className="hidden lg:flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden"
            style={{
               width: 224,
               background: 'var(--color-surface-strong)',
               borderRight: '1px solid var(--color-border-strong)',
               gap: '0.25rem',
               padding: '0 0 16px 0',
            }}
            data-testid="sidebar"
         >
            {/* Top nav items */}
            <nav
               style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.125rem',
                  padding: '8px 8px 0',
               }}
            >
               {topItems.map((item) => (
                  <NavItem key={item.href} {...item} />
               ))}
            </nav>

            {/* Domain sub-nav — visible when on a domain page */}
            {activeDomainSlug && (
               <div style={{ padding: '0 8px' }}>
                  {/* Domain header button */}
                  <button
                     type="button"
                     onClick={() => setDomainNavOpen((v) => !v)}
                     style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '6px 8px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderRadius: '0.5rem',
                        color: 'rgba(255,255,255,0.9)',
                        marginTop: '4px',
                     }}
                  >
                     <img
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                        src={`https://www.google.com/s2/favicons?domain=${activeDomain?.domain || activeDomainSlug.replace(/_/g, '-').replace(/-/g, '.')}&sz=32`}
                     />
                     <span style={{ fontSize: '0.8125rem', fontWeight: 600, flexGrow: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeDomain?.domain || activeDomainSlug}
                     </span>
                     <svg
                        viewBox="0 0 24 24" width="14" height="14"
                        style={{ flexShrink: 0, color: 'rgba(255,255,255,0.4)', transition: 'transform 200ms', transform: domainNavOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                     >
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
                     </svg>
                  </button>
                  {/* Sub-items */}
                  <div style={{ overflow: 'hidden', maxHeight: domainNavOpen ? '400px' : '0', transition: 'max-height 200ms ease-out' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', paddingLeft: '8px' }}>
                        {DOMAIN_SUB_NAV.map((item) => {
                           const href = `/sites/${activeDomainSlug}/${item.key}`;
                           const active = router.asPath === href || router.asPath.startsWith(href + '?');
                           return (
                              <Link key={item.key} href={href} passHref>
                                 <a
                                    style={{
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
                                    }}
                                    onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'; } }}
                                    onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; } }}
                                 >
                                    {item.icon}
                                    <span>{item.label}</span>
                                 </a>
                              </Link>
                           );
                        })}
                     </div>
                  </div>
               </div>
            )}

            {/* AI Tracker */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0 8px' }}>
               <NavItem
                  href="/dashboard"
                  label="AI Tracker"
                  icon={<IcoAITracker />}
                  active={false}
               />
            </nav>

            {/* Tools collapsible section */}
            <div style={{ padding: '0 8px' }}>
               <button
                  type="button"
                  onClick={() => setToolsOpen((v) => !v)}
                  style={{
                     display: 'flex',
                     alignItems: 'center',
                     gap: '0.25rem',
                     paddingLeft: '0.375rem',
                     paddingTop: '0.5rem',
                     paddingBottom: '0.5rem',
                     fontSize: '0.8125rem',
                     lineHeight: '1rem',
                     fontWeight: 600,
                     color: '#71717b',
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     marginTop: '0.25rem',
                  }}
               >
                  Tools
                  <svg
                     viewBox="0 0 24 24"
                     width="16"
                     height="16"
                     style={{
                        flexShrink: 0,
                        marginLeft: 'auto',
                        transition: 'transform 250ms ease',
                        transform: toolsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                     }}
                  >
                     <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5" />
                  </svg>
               </button>

               <div
                  style={{
                     overflow: 'hidden',
                     maxHeight: toolsOpen ? '500px' : '0',
                     transition: 'max-height 200ms ease-out',
                  }}
               >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                     {toolItems.map((item) => (
                        <NavItem
                           key={item.label}
                           href={item.href}
                           label={item.label}
                           icon={item.icon}
                           active={false}
                        />
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </>
   );
};

export default Sidebar;
