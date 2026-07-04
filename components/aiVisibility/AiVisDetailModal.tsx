import React, { useEffect, useMemo, useState } from 'react';
import TrendLineChart from './TrendLineChart';
import { SkeletonBox } from './SkeletonBlocks';
import { AI_VIS_MODEL_LABEL } from '../../lib/aiVisibility';
import { useAiVisPromptDetail, useAiVisFanoutDetail, type AiVisDetailPayload } from '../../services/aiVisibility';

const FONT = 'var(--font-family-primary)';

export type AiVisDetailItem = { promptId?: number; query?: string; title: string };

type Props = {
   slug: string;
   kind: 'prompt' | 'fanout';
   items: AiVisDetailItem[];
   index: number;
   onNavigate: (nextIndex: number) => void;
   onClose: () => void;
};

type Metric = 'visibilityScore' | 'mentionRate' | 'avgPosition';
const METRICS: Array<{ id: Metric; label: string }> = [
   { id: 'visibilityScore', label: 'Visibility score' },
   { id: 'mentionRate', label: 'Mention rate' },
   { id: 'avgPosition', label: 'Avg. position' },
];

const ArrowUp = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const CloseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ChevronDown = () => (<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" /></svg>);
const Check = () => (<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" /></svg>);

/** Per-engine model glyphs, keyed by the display label from AI_VIS_MODEL_LABEL — mirrors the
 *  set used in AiVisibilityToolbar so the engine dropdown reads the same across the product. */
const Starburst = () => (<svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M32 16.032C27.8484 16.2868 23.9332 18.0509 20.9921 20.9921C18.0509 23.9332 16.2868 27.8484 16.032 32H15.968C15.7136 27.8482 13.9497 23.9328 11.0084 20.9916C8.06716 18.0503 4.15176 16.2864 0 16.032L0 15.968C4.15176 15.7136 8.06716 13.9497 11.0084 11.0084C13.9497 8.06716 15.7136 4.15176 15.968 0L16.032 0C16.2868 4.15162 18.0509 8.06677 20.9921 11.0079C23.9332 13.9491 27.8484 15.7132 32 15.968V16.032Z" fill="currentColor" /></svg>);
const GoogleG = () => (<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="currentColor" /><path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="currentColor" /><path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="currentColor" /><path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="currentColor" /></svg>);
const ChatGptIcon = () => (<svg width="16" height="16" viewBox="0 0 19 18" fill="none" aria-hidden="true"><path d="M18.1007 8.5592C18.2985 8.99438 18.4241 9.45956 18.4754 9.93413C18.5249 10.4087 18.5001 10.8889 18.3974 11.356C18.2966 11.823 18.1217 12.2713 17.8782 12.684C17.7185 12.9597 17.5302 13.2186 17.3134 13.4568C17.0985 13.6932 16.8588 13.907 16.5983 14.0946C16.3358 14.2822 16.0562 14.4397 15.7595 14.5692C15.4647 14.6967 15.1566 14.7942 14.8409 14.858C14.6926 15.312 14.472 15.7415 14.1867 16.1279C13.9033 16.5143 13.5591 16.8538 13.1673 17.1333C12.7755 17.4147 12.3419 17.6323 11.8816 17.7786C11.4214 17.9268 10.9402 17.9999 10.4552 17.9999C10.1338 18.0018 9.81046 17.968 9.49475 17.9043C9.18094 17.8386 8.87284 17.7392 8.57805 17.6098C8.28326 17.4803 8.00368 17.319 7.74312 17.1314C7.48447 16.9439 7.24483 16.7282 7.03182 16.4899C6.55635 16.5912 6.06947 16.6156 5.5883 16.5668C5.10712 16.5162 4.63546 16.3924 4.19232 16.1973C3.75108 16.0041 3.34218 15.7415 2.98272 15.4207C2.62327 15.1 2.31707 14.7248 2.07553 14.3122C1.91387 14.0364 1.78074 13.7457 1.67994 13.4437C1.57914 13.1417 1.51257 12.8303 1.47834 12.5133C1.44411 12.1982 1.44601 11.8793 1.48024 11.5623C1.51448 11.2472 1.58485 10.9358 1.68564 10.6338C1.36233 10.2793 1.09606 9.87599 0.898268 9.44081C0.702374 9.00375 0.574948 8.54044 0.5255 8.06587C0.474149 7.5913 0.500775 7.11111 0.601575 6.64404C0.702374 6.17698 0.877347 5.72867 1.12079 5.316C1.28054 5.04026 1.46883 4.77953 1.68374 4.54318C1.89865 4.30684 2.14019 4.093 2.40075 3.90542C2.66131 3.71785 2.94279 3.55841 3.23758 3.43085C3.53427 3.30143 3.84237 3.20576 4.15808 3.14199C4.30643 2.68617 4.52705 2.2585 4.81043 1.87209C5.09571 1.48568 5.43995 1.14617 5.83174 0.864806C6.22352 0.585317 6.65715 0.367728 7.1174 0.219543C7.57766 0.073233 8.05883 -0.00179761 8.54381 7.81569e-05C8.86523 -0.00179761 9.18855 0.0300904 9.50426 0.0957422C9.81997 0.161394 10.1281 0.258934 10.4229 0.388362C10.7177 0.519665 10.9972 0.679105 11.2578 0.866682C11.5183 1.05613 11.758 1.26997 11.971 1.50819C12.4446 1.40878 12.9314 1.38439 13.4126 1.43316C13.8938 1.48193 14.3636 1.60761 14.8067 1.80081C15.2479 1.99589 15.6568 2.25662 16.0163 2.57738C16.3757 2.89626 16.6819 3.26954 16.9235 3.68408C17.0851 3.95794 17.2183 4.24869 17.3191 4.55256C17.4199 4.85456 17.4883 5.16594 17.5207 5.48294C17.5549 5.79995 17.5549 6.11883 17.5188 6.43583C17.4845 6.75284 17.4142 7.06421 17.3134 7.36621C17.6386 7.72073 17.9029 8.12214 18.1007 8.5592ZM11.7637 16.5668C12.1783 16.398 12.5549 16.1485 12.8725 15.8353C13.1901 15.522 13.443 15.1506 13.6142 14.7398C13.7854 14.3309 13.8748 13.892 13.8748 13.4493V9.26636C13.8735 9.26261 13.8722 9.25823 13.871 9.25323C13.8697 9.24948 13.8678 9.24573 13.8653 9.24198C13.8627 9.23822 13.8596 9.2351 13.8558 9.2326C13.852 9.22885 13.8481 9.22635 13.8443 9.22509L12.3095 8.35099V13.4043C12.3095 13.4549 12.3019 13.5075 12.2886 13.5562C12.2753 13.6069 12.2563 13.6538 12.2296 13.6988C12.203 13.7438 12.1726 13.7851 12.1346 13.8207C12.0976 13.8571 12.056 13.8886 12.0109 13.9145L8.37645 15.9835C8.34602 16.0022 8.29467 16.0285 8.26804 16.0435C8.41829 16.1692 8.58185 16.2798 8.75302 16.3774C8.92609 16.4749 9.10487 16.5575 9.29125 16.625C9.47763 16.6906 9.66972 16.7413 9.86372 16.7751C10.0596 16.8088 10.2574 16.8257 10.4552 16.8257C10.904 16.8257 11.3491 16.7375 11.7637 16.5668ZM3.10825 13.7269C3.33457 14.1115 3.63317 14.4454 3.98882 14.7155C4.34637 14.9856 4.75147 15.1825 5.1851 15.2969C5.61873 15.4114 6.07137 15.4414 6.51641 15.3832C6.96145 15.3251 7.38937 15.1825 7.77926 14.9612L11.4537 12.8697L11.4632 12.8603C11.4657 12.8578 11.4676 12.8541 11.4689 12.8491C11.4714 12.8453 11.4733 12.8416 11.4746 12.8378V11.0746L7.03943 13.605C6.99378 13.6313 6.94624 13.65 6.89679 13.665C6.84544 13.6782 6.79409 13.6838 6.74083 13.6838C6.68948 13.6838 6.63813 13.6782 6.58678 13.665C6.53733 13.65 6.48788 13.6313 6.44224 13.605L2.80775 11.5342C2.77542 11.5154 2.72787 11.4873 2.70125 11.4704C2.66701 11.6636 2.6499 11.8587 2.6499 12.0537C2.6499 12.2488 2.66891 12.4439 2.70315 12.6371C2.73738 12.8284 2.79064 13.0179 2.8572 13.2017C2.92567 13.3855 3.00935 13.5619 3.10825 13.7307V13.7269ZM2.15351 5.90499C1.92908 6.28952 1.78454 6.71344 1.72558 7.15237C1.66663 7.5913 1.69706 8.03586 1.81307 8.46541C1.92908 8.89308 2.12878 9.29262 2.40265 9.64527C2.67652 9.99603 3.01696 10.2905 3.40494 10.5119L7.07747 12.6052C7.08127 12.6065 7.08571 12.6077 7.09078 12.609H7.10409C7.10916 12.609 7.1136 12.6077 7.1174 12.6052C7.12121 12.604 7.12501 12.6021 7.12882 12.5996L8.66934 11.7217L4.23416 9.19696C4.19042 9.1707 4.14858 9.13881 4.11054 9.10317C4.07368 9.0667 4.04173 9.02573 4.01544 8.98125C3.99072 8.93623 3.9698 8.88933 3.95649 8.83869C3.94317 8.78992 3.93556 8.73927 3.93747 8.68675V4.42689C3.75108 4.49441 3.5704 4.57695 3.39924 4.67449C3.22807 4.7739 3.06641 4.88645 2.91426 5.01213C2.76401 5.1378 2.62327 5.27661 2.49584 5.42667C2.36842 5.57485 2.25621 5.73617 2.15731 5.90499H2.15351ZM14.7687 8.80117C14.8143 8.82743 14.8561 8.85744 14.8942 8.89496C14.9303 8.9306 14.9626 8.97187 14.9893 9.01688C15.014 9.0619 15.0349 9.11067 15.0482 9.15944C15.0596 9.21009 15.0673 9.26073 15.0653 9.31326V13.5731C15.6759 13.3518 16.2084 12.9635 16.6021 12.4533C16.9977 11.9431 17.2354 11.3335 17.2905 10.6957C17.3457 10.0579 17.2164 9.41642 16.9159 8.84807C16.6154 8.27971 16.157 7.80702 15.5941 7.48814L11.9215 5.39478C11.9177 5.39353 11.9133 5.39228 11.9082 5.39103H11.8949C11.8911 5.39228 11.8867 5.39353 11.8816 5.39478C11.8778 5.39603 11.874 5.39791 11.8702 5.40041L10.3373 6.27452L14.7725 8.80117H14.7687ZM16.2978 6.52962C16.4081 5.89936 16.3339 5.25035 16.0829 4.65948C15.8337 4.06861 15.4172 3.56028 14.8847 3.19263C14.3521 2.82686 13.7245 2.61677 13.076 2.58863C12.4255 2.56237 11.7827 2.71806 11.2198 3.03694L7.54723 5.12842C7.54343 5.13092 7.54026 5.13405 7.53772 5.1378L7.53011 5.14906C7.52884 5.15281 7.52758 5.15718 7.52631 5.16219C7.52504 5.16594 7.52441 5.17031 7.52441 5.17532V6.92353L11.9596 4.39687C12.0052 4.37061 12.0547 4.35185 12.1041 4.33685C12.1555 4.32372 12.2068 4.31809 12.2582 4.31809C12.3114 4.31809 12.3628 4.32372 12.4141 4.33685C12.4636 4.35185 12.5111 4.37061 12.5568 4.39687L16.1913 6.46772C16.2236 6.48648 16.2711 6.51274 16.2978 6.52962ZM6.68758 4.59383C6.68758 4.54318 6.69519 4.49254 6.7085 4.44189C6.72181 4.39312 6.74083 4.34435 6.76746 4.29933C6.79409 4.25619 6.82452 4.21492 6.86255 4.17741C6.89869 4.14177 6.94053 4.10988 6.98618 4.0855L10.6207 2.01653C10.6549 1.99589 10.7024 1.96963 10.7291 1.9565C10.2308 1.54571 9.62218 1.2831 8.97744 1.20244C8.33271 1.11991 7.67846 1.2212 7.09078 1.49319C6.5012 1.76517 6.00291 2.19848 5.65486 2.7387C5.30682 3.28079 5.12234 3.9073 5.12234 4.54881V8.73177C5.1236 8.73677 5.12487 8.74115 5.12614 8.7449C5.12741 8.74865 5.12931 8.7524 5.13185 8.75615C5.13438 8.7599 5.13755 8.76366 5.14136 8.76741C5.14389 8.76991 5.14769 8.77241 5.15277 8.77491L6.68758 9.64902V4.59383ZM7.5206 10.1217L9.49665 11.2472L11.4727 10.1217V7.87267L9.49856 6.74721L7.52251 7.87267L7.5206 10.1217Z" fill="currentColor" /></svg>);
const PerplexityIcon = () => (<svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M26.38 0V9.696H30V23.4933H26.0867V32L16.704 23.7413V31.9347H15.2493V23.732L5.856 32V23.38H2V9.584H5.84533V0L15.2493 8.65867V0.253333H16.7027V8.90667L26.38 0ZM16.704 12.0587V21.8173L24.632 28.796V19.2533L16.704 12.0587ZM15.2387 11.952L7.31067 19.1493V28.796L15.2387 21.8173V11.9533V11.952ZM26.0867 22.0587H28.5453V11.132H17.9467L26.0867 18.5187V22.0587ZM14.1107 11.0187H3.45333V21.9453H5.85333V18.5107L14.1093 11.0173L14.1107 11.0187ZM7.3 3.30133V9.58133H14.12L7.3 3.30133ZM24.9253 3.30133L18.1053 9.58133H24.9253V3.30133Z" fill="currentColor" /></svg>);

const MODEL_ICON: Record<string, React.ReactNode> = {
   'AI Overviews': <Starburst />,
   'AI Mode': <GoogleG />,
   ChatGPT: <ChatGptIcon />,
   Perplexity: <PerplexityIcon />,
   Gemini: <Starburst />,
};

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 4, color: '#52525C', cursor: 'pointer', borderRadius: 6 };
const subBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', fontSize: 14, fontWeight: 600, fontFamily: FONT, color: '#18181B', cursor: 'pointer' };
const cell: React.CSSProperties = { padding: '12px 16px', fontSize: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', boxSizing: 'border-box' };
const engineLabel = (e: string): string => AI_VIS_MODEL_LABEL[e] || e;

/** Segmented pill toggle mirroring the overview page's icon-toggle chrome (F4F4F5 track,
 *  white active pill), but text-only for the Overview/Responses + metric switches. */
const Segmented = <T extends string>({ options, value, onChange }: { options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) => (
   <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 10, background: '#F4F4F5' }}>
      {options.map((o) => {
         const on = value === o.id;
         return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 28, padding: '0 12px', border: 'none', borderRadius: 7, background: on ? '#fff' : 'transparent', color: on ? '#18181B' : '#9F9FA9', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.10)' : 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: FONT, transition: 'color 150ms ease', whiteSpace: 'nowrap' }}>{o.label}</button>
         );
      })}
   </div>
);

const StatCard = ({ label, value, loading }: { label: string; value: React.ReactNode; loading: boolean }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#71717B' }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: '#18181B' }}>{loading ? <SkeletonBox w={40} h={26} /> : value}</span>
   </div>
);

/** Blinking-robot empty state — same copy/structure the AI Visibility tables use when a
 *  filter combination yields nothing. */
const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
   <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <span style={{ fontSize: 28 }} className="aiv-robot" aria-hidden>🤖</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{title}</span>
      <span style={{ fontSize: 13, color: '#9F9FA9' }}>{hint}</span>
   </div>
);

/** Engine picker: mirrors the toolbar model dropdown ('' == all engines). Options come from
 *  the active payload's `engines`, each shown with its model glyph + AI_VIS_MODEL_LABEL. */
const EnginePicker = ({ engines, value, onChange }: { engines: string[]; value: string; onChange: (e: string) => void }) => {
   const [open, setOpen] = useState(false);
   const label = value ? engineLabel(value) : 'All models';
   const item = (id: string, name: string, on: boolean, icon: React.ReactNode) => (
      <button key={id || 'all'} type="button" onClick={() => { onChange(id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#18181B', textAlign: 'left', fontFamily: FONT }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
         {icon ? <span style={{ display: 'inline-flex', color: '#18181B', flexShrink: 0 }}>{icon}</span> : null}
         <span style={{ flex: 1 }}>{name}</span>
         {on ? <span style={{ display: 'inline-flex', color: '#18181B' }}><Check /></span> : null}
      </button>
   );
   return (
      <div style={{ position: 'relative' }}>
         <button type="button" style={subBtn} onClick={() => setOpen((o) => !o)}>
            {value && MODEL_ICON[label] ? <span style={{ display: 'inline-flex', flexShrink: 0 }}>{MODEL_ICON[label]}</span> : null}
            <span>{label}</span>
            <ChevronDown />
         </button>
         {open ? (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 220, background: '#fff', borderRadius: 12, padding: 8, boxShadow: '0 18px 40px rgba(17,24,39,0.14), 0 8px 18px rgba(17,24,39,0.09)', zIndex: 320, fontFamily: FONT, animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
               {item('', 'All models', value === '', null)}
               {engines.map((e) => item(e, engineLabel(e), value === e, MODEL_ICON[engineLabel(e)] ?? null))}
            </div>
         ) : null}
      </div>
   );
};

/** Right-side slide-over for a tracked prompt (or a fanout query), reusing the SourceDetail
 *  shell: overview stat cards, a metric trend chart, plus Brands + Fanout tables. */
const AiVisDetailModal = ({ slug, kind, items, index, onNavigate, onClose }: Props) => {
   const active = items[index];
   const promptId = kind === 'prompt' ? (active?.promptId ?? null) : null;
   const fanoutQuery = kind === 'fanout' ? (active?.query ?? null) : null;
   const [engine, setEngine] = useState('');
   const [tab, setTab] = useState<'overview' | 'responses'>('overview');
   const [metric, setMetric] = useState<Metric>('visibilityScore');

   // Both hooks are called unconditionally (hooks rule); the inactive one is disabled via a
   // null id, so only the active `kind` fires a request.
   const promptQ = useAiVisPromptDetail(slug, { promptId, engine: engine || undefined });
   const fanoutQ = useAiVisFanoutDetail(slug, { query: fanoutQuery, engine: engine || undefined });
   const activeQ = kind === 'prompt' ? promptQ : fanoutQ;

   // Reset engine to "all" whenever the entity changes, so a per-entity engine choice never
   // leaks onto the next prompt/query.
   useEffect(() => { setEngine(''); }, [promptId, fanoutQuery]);

   // Hard staleness guard: keepPreviousData holds the prior entity's payload during a refetch
   // after an index/engine change. Blank it while fetching so no stale numbers ever show.
   const payload: AiVisDetailPayload | undefined = activeQ.isFetching ? undefined : activeQ.data;
   const loading = activeQ.isFetching || !payload;

   // Slide-in on mount, slide-out on close — same chrome as SourceDetailModal.
   const [visible, setVisible] = useState(false);
   useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
   const handleClose = () => { setVisible(false); setTimeout(onClose, 220); };

   const canPrev = index > 0;
   const canNext = index < items.length - 1;
   useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
         if (e.key === 'Escape') handleClose();
         if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onNavigate(index - 1); }
         if (e.key === 'ArrowDown' && index < items.length - 1) { e.preventDefault(); onNavigate(index + 1); }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [index, items.length, onNavigate]);

   const ov = payload?.overview;
   const brands = payload?.brands || [];
   const fanout = payload?.fanout || [];
   const engines = payload?.engines || [];

   // TrendLineChart plots `series.you.visibilityScore` only, so map the selected metric's value
   // into that slot. Nulls (no data / avg-position gaps) fall back to 0, matching the chart.
   const trendScans = useMemo(
      () => (payload?.series || []).map((p) => ({
         finishedAt: p.finishedAt,
         series: { you: { visibilityScore: (p[metric] ?? 0) as number } },
      })),
      [payload, metric],
   );

   if (!active) return null;
   const title = payload?.title || active.title;

   return (
      <>
         <style>{'@keyframes aivRobotBlink{0%,92%,100%{opacity:1}96%{opacity:.35}}.aiv-robot{display:inline-block;animation:aivRobotBlink 2.4s ease-in-out infinite}'}</style>
         <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }} role="presentation" />
         <div style={{ position: 'fixed', top: 8, bottom: 8, right: 8, width: 800, maxWidth: 'calc(100vw - 16px)', zIndex: 301, background: '#fff', borderRadius: 16, boxShadow: '0px 24px 64px rgba(0,0,0,0.16), 0px 8px 24px rgba(0,0,0,0.08)', border: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 16px))', transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }} role="dialog" aria-modal="true">
            {/* Header: nav arrows (left) · Overview/Responses toggle (center) · close (right) */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid #F4F4F5' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <button type="button" aria-label="Previous" disabled={!canPrev} onClick={() => onNavigate(index - 1)} style={{ ...iconBtn, opacity: canPrev ? 1 : 0.35, cursor: canPrev ? 'pointer' : 'not-allowed' }}><ArrowUp /></button>
                     <button type="button" aria-label="Next" disabled={!canNext} onClick={() => onNavigate(index + 1)} style={{ ...iconBtn, opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'not-allowed' }}><ArrowDown /></button>
                  </div>
                  <Segmented options={[{ id: 'overview', label: 'Overview' }, { id: 'responses', label: 'Responses' }]} value={tab} onChange={setTab} />
                  <button type="button" aria-label="Close" onClick={handleClose} style={iconBtn}><CloseIcon /></button>
               </div>
               <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{title}</h2>
               {/* Sub-row: Compare (placeholder) + functional engine picker */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...subBtn, color: '#52525C' }} aria-label="Compare (coming soon)"><span>Compare</span></button>
                  <EnginePicker engines={engines} value={engine} onChange={setEngine} />
               </div>
            </div>

            {/* Body */}
            <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
               {tab === 'responses' ? (
                  <EmptyState title="Responses coming soon" hint="Per-model AI answers for this prompt will appear here." />
               ) : (
                  <>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <StatCard label="Visibility score" loading={loading} value={ov?.visibilityScore ?? 0} />
                        <StatCard label="Mention rate" loading={loading} value={`${ov?.mentionRate ?? 0}%`} />
                        <StatCard label="Average position" loading={loading} value={ov?.avgPosition != null ? ov.avgPosition.toFixed(1) : '—'} />
                     </div>

                     {/* Metric trend */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                           <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Trend</span>
                           <Segmented options={METRICS} value={metric} onChange={setMetric} />
                        </div>
                        <div style={{ height: 320 }}>
                           {loading ? <SkeletonBox w="100%" h={320} /> : <TrendLineChart scans={trendScans} competitorDomain={null} />}
                        </div>
                     </div>

                     <div role="separator" style={{ height: 1, background: '#E4E4E7' }} />

                     {/* Brands */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Brands <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{brands.length}</span></span>
                        {loading ? (
                           <SkeletonBox w="100%" h={160} />
                        ) : brands.length === 0 ? (
                           <EmptyState title="No brands found" hint="Try changing the filters" />
                        ) : (
                           <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                                 <div style={{ ...cell, flex: 1, minWidth: 0 }}>Brand</div>
                                 <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Visibility score</div>
                                 <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Avg. position</div>
                              </div>
                              {brands.map((b) => (
                                 <div key={`${b.domain}-${b.brand}`} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
                                    <div style={{ ...cell, flex: 1, minWidth: 0, gap: 8 }}>
                                       <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontWeight: 500, color: '#18181B' }}>{b.brand}</span>
                                          {b.domain ? <span style={{ color: '#9F9FA9' }}> · {b.domain}</span> : null}
                                       </span>
                                    </div>
                                    <div style={{ ...cell, width: 150, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{b.mentions}</div>
                                    <div style={{ ...cell, width: 130, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', color: b.avgPosition != null ? '#18181B' : '#9F9FA9' }}>{b.avgPosition != null ? b.avgPosition.toFixed(1) : '—'}</div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>

                     <div role="separator" style={{ height: 1, background: '#E4E4E7' }} />

                     {/* Fanout queries */}
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#18181B' }}>Fanout Queries <span style={{ color: '#9F9FA9', fontWeight: 400 }}>{fanout.length}</span></span>
                        {loading ? (
                           <SkeletonBox w="100%" h={160} />
                        ) : fanout.length === 0 ? (
                           <EmptyState title="No fanout queries found" hint="Try changing the filters" />
                        ) : (
                           <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', borderBottom: '1px solid #F4F4F5', fontSize: 13, color: '#71717B' }}>
                                 <div style={{ ...cell, flex: 1, minWidth: 0 }}>Query</div>
                                 <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5' }}>Count</div>
                              </div>
                              {fanout.map((f) => (
                                 <div key={f.query} style={{ display: 'flex', borderTop: '1px solid #F4F4F5' }}>
                                    <div style={{ ...cell, flex: 1, minWidth: 0, color: '#18181B', lineHeight: 1.5 }}>{f.query}</div>
                                    <div style={{ ...cell, width: 120, flexShrink: 0, justifyContent: 'flex-end', borderLeft: '1px solid #F4F4F5', fontWeight: 600, color: '#18181B' }}>{f.timesShown}</div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </>
               )}
            </div>
         </div>
      </>
   );
};

export default AiVisDetailModal;
