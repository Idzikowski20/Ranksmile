import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { authClient } from '../../../lib/auth/client';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Heatmap palette (mirrors Surfer's var(--gray-20) / --purple-40 / --brand-orange).
const DOT_IDLE = '#D4D4D8';
const DOT_ACTIVE = '#AA93FD';
const DOT_PEAK = '#FB6A3C';

type ApiArticle = {
   id: number | string;
   title?: string | null;
   status?: string | null;
   source?: string | null;
   target_keyword?: string | null;
   published_at?: string | null;
   created_at?: string | null;
   updated_at?: string | null;
};

type EventType = 'created' | 'optimized' | 'published';
type LogEvent = {
   id: string;
   articleId: number | string;
   type: EventType;
   verb: string;       // "Created" | "Optimized" | "Published"
   context: string | null; // "in Content Editor" | "from Content Audit" | null
   title: string;
   time: Date;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const fmtMostActive = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}, ${MONTHS[d.getMonth()]}`;
const fmtTime = (d: Date) => {
   let h = d.getHours();
   const m = d.getMinutes();
   const ap = h >= 12 ? 'PM' : 'AM';
   h %= 12;
   if (h === 0) h = 12;
   return `${h}:${String(m).padStart(2, '0')}${ap}`;
};

// ─── Icons ──────────────────────────────────────────────────────────────────

const DownloadIcon = () => (
   <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
   </svg>
);
const PeopleIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M22 21V19C22 17.1362 20.7252 15.5701 19 15.126M15.5 3.29076C16.9659 3.88415 18 5.32131 18 7C18 8.67869 16.9659 10.1159 15.5 10.7092M17 21C17 19.1362 17 18.2044 16.6955 17.4693C16.2895 16.4892 15.5108 15.7105 14.5307 15.3045C13.7956 15 12.8638 15 11 15H8C6.13623 15 5.20435 15 4.46927 15.3045C3.48915 15.7105 2.71046 16.4892 2.30448 17.4693C2 18.2044 2 19.1362 2 21M13.5 7C13.5 9.20914 11.7091 11 9.5 11C7.29086 11 5.5 9.20914 5.5 7C5.5 4.79086 7.29086 3 9.5 3C11.7091 3 13.5 4.79086 13.5 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const FilterIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6 12H18M3 6H21M9 18H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const ChevronDown = ({ open }: { open: boolean }) => (
   <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);
const SortArrow = ({ asc }: { asc: boolean }) => (
   <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: asc ? 'rotate(180deg)' : 'none', color: '#52525C' }}>
      <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
   </svg>
);
const TickIcon = () => (
   <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094z" clipRule="evenodd" />
   </svg>
);

// ─── Filter dropdown ─────────────────────────────────────────────────────────

type Opt = { value: string; label: string };
const FilterDropdown = ({ icon, options, value, onChange, minWidth }: {
   icon: React.ReactNode; options: Opt[]; value: string; onChange: (v: string) => void; minWidth: number;
}) => {
   const [open, setOpen] = useState(false);
   const ref = useRef<HTMLDivElement>(null);
   const current = options.find((o) => o.value === value) || options[0];
   useEffect(() => {
      if (!open) return undefined;
      const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
   }, [open]);

   return (
      <div ref={ref} style={{ position: 'relative' }}>
         <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
               display: 'inline-flex', alignItems: 'center', gap: 8, minWidth, height: 38, padding: '0 12px',
               borderRadius: 10, border: '1px solid #D4D4D8', background: '#fff', cursor: 'pointer',
               fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#18181B', transition: 'opacity 150ms ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
         >
            <span style={{ color: '#52525C', display: 'inline-flex' }}>{icon}</span>
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.label}</span>
            <span style={{ color: '#52525C', display: 'inline-flex' }}><ChevronDown open={open} /></span>
         </button>
         {open && (
            <div
               role="menu"
               style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 150, minWidth: Math.max(minWidth, 180),
                  background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: 6,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.14)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)',
                  transformOrigin: 'top right', fontFamily: FONT,
               }}
            >
               {options.map((o) => {
                  const sel = o.value === value;
                  return (
                     <button
                        key={o.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sel}
                        onClick={() => { onChange(o.value); setOpen(false); }}
                        style={{
                           display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8,
                           border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, fontSize: 14,
                           fontWeight: sel ? 600 : 500, color: '#18181B', background: 'transparent', transition: 'background 120ms ease',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F8F8F9'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                     >
                        <span style={{ flex: 1 }}>{o.label}</span>
                        {sel && <span style={{ color: '#783AFB', display: 'inline-flex' }}><TickIcon /></span>}
                     </button>
                  );
               })}
            </div>
         )}
      </div>
   );
};

// ─── Contribution heatmap ────────────────────────────────────────────────────

const Heatmap = ({ counts, peakKey }: { counts: Map<string, number>; peakKey: string | null }) => {
   const year = new Date().getFullYear();
   const { weeks, monthLabels } = useMemo(() => {
      const first = new Date(year, 0, 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay()); // back to Sunday
      const last = new Date(year, 11, 31);
      const cols: Date[][] = [];
      const cur = new Date(start);
      while (cur <= last) {
         const week: Date[] = [];
         for (let i = 0; i < 7; i += 1) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
         cols.push(week);
      }
      let prev = -1;
      const labels = cols.map((week) => {
         const rep = week.find((d) => d.getFullYear() === year) || week[0];
         const m = rep.getMonth();
         if (m !== prev) { prev = m; return MONTHS[m]; }
         return '';
      });
      return { weeks: cols, monthLabels: labels };
   }, [year]);

   const CELL = 14;
   const ROW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

   return (
      <div style={{ overflowX: 'auto' }} className="styled-scrollbar">
         <div style={{ minWidth: 28 + weeks.length * CELL }}>
            {/* Month labels */}
            <div style={{ display: 'flex', paddingLeft: 28 }}>
               {monthLabels.map((label, wi) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={wi} style={{ width: CELL, flexShrink: 0, height: 16, fontSize: 10, color: '#71717B', fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'visible' }}>
                     {label}
                  </div>
               ))}
            </div>
            {/* Grid */}
            <div style={{ display: 'flex' }}>
               {/* Weekday labels */}
               <div style={{ width: 28, flexShrink: 0 }}>
                  {ROW_LABELS.map((d, ri) => (
                     // eslint-disable-next-line react/no-array-index-key
                     <div key={ri} style={{ height: CELL, display: 'flex', alignItems: 'center', fontSize: 10, color: '#71717B', fontFamily: FONT }}>{d}</div>
                  ))}
               </div>
               {/* Week columns */}
               <div style={{ display: 'flex' }}>
                  {weeks.map((week, wi) => (
                     // eslint-disable-next-line react/no-array-index-key
                     <div key={wi} style={{ display: 'flex', flexDirection: 'column' }}>
                        {week.map((day) => {
                           const inYear = day.getFullYear() === year;
                           const key = dayKey(day);
                           const count = counts.get(key) || 0;
                           let bg = DOT_IDLE;
                           let opacity = inYear ? 0.3 : 0;
                           if (count > 0) { bg = key === peakKey ? DOT_PEAK : DOT_ACTIVE; opacity = 1; }
                           const title = count > 0 ? `${count} ${count === 1 ? 'activity' : 'activities'} on ${fmtMostActive(day)}` : undefined;
                           return (
                              <div key={key} style={{ width: CELL, height: CELL, display: 'grid', placeItems: 'center' }} title={title}>
                                 <div style={{ width: 8, height: 8, borderRadius: 9999, background: bg, opacity, transition: 'opacity 300ms' }} />
                              </div>
                           );
                        })}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
   );
};

// ─── Page ────────────────────────────────────────────────────────────────────

const ActivityLogPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const [mounted, setMounted] = useState(false);
   useEffect(() => { setMounted(true); }, []);
   const session = authClient.useSession?.();
   const person = (mounted && session?.data?.user?.email) ? session.data.user.email : 'You';
   const personInitial = (person.charAt(0) || '?').toUpperCase();

   const [range, setRange] = useState<'7d' | 'all'>('7d');
   const [typeFilter, setTypeFilter] = useState<'all' | EventType>('all');
   const [sortAsc, setSortAsc] = useState(false);

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d) => d.slug === slug);

   const { data: articlesData, isLoading } = useQuery<{ articles?: ApiArticle[] }>(
      ['articles-activity', activeDomain?.ID],
      async () => {
         const res = await fetch(`/api/articles?domainId=${activeDomain!.ID}`);
         return res.json();
      },
      { enabled: !!activeDomain?.ID },
   );

   // Build raw events from article timestamps.
   const allEvents: LogEvent[] = useMemo(() => {
      const list = (articlesData?.articles || []).filter((a) => a.source !== 'site_context');
      const out: LogEvent[] = [];
      list.forEach((a) => {
         const title = (a.title || '').trim();
         if (!title) return;
         if (a.created_at) {
            out.push({ id: `c-${a.id}`, articleId: a.id, type: 'created', verb: 'Created', context: 'in Content Editor', title, time: new Date(a.created_at) });
         }
         if (a.updated_at && a.updated_at !== a.created_at) {
            out.push({ id: `o-${a.id}`, articleId: a.id, type: 'optimized', verb: 'Optimized', context: 'in Content Editor', title, time: new Date(a.updated_at) });
         }
         if (a.status === 'published' && a.published_at) {
            out.push({ id: `p-${a.id}`, articleId: a.id, type: 'published', verb: 'Published', context: null, title, time: new Date(a.published_at) });
         }
      });
      return out;
   }, [articlesData]);

   // Apply range + type filters, then sort by date.
   const events = useMemo(() => {
      const cutoff = range === '7d' ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0;
      const filtered = allEvents.filter((e) => e.time.getTime() >= cutoff && (typeFilter === 'all' || e.type === typeFilter));
      return filtered.sort((a, b) => (sortAsc ? a.time.getTime() - b.time.getTime() : b.time.getTime() - a.time.getTime()));
   }, [allEvents, range, typeFilter, sortAsc]);

   // Heatmap counts + stats over the filtered set.
   const { counts, peakKey, activeDays, peakLabel, peakCount } = useMemo(() => {
      const map = new Map<string, number>();
      const repr = new Map<string, Date>();
      events.forEach((e) => {
         const k = dayKey(e.time);
         map.set(k, (map.get(k) || 0) + 1);
         if (!repr.has(k)) repr.set(k, e.time);
      });
      let pk: string | null = null;
      let pc = 0;
      map.forEach((c, k) => { if (c > pc) { pc = c; pk = k; } });
      const pd = pk ? repr.get(pk) : undefined;
      return { counts: map, peakKey: pk, activeDays: map.size, peakLabel: pd ? fmtMostActive(pd) : '—', peakCount: pc };
   }, [events]);

   const exportCsv = () => {
      const rows = [['Person', 'Activity', 'Date'], ...events.map((e) => [
         person,
         `${e.verb} ${e.title}${e.context ? ` ${e.context}` : ''}`,
         `${fmtDate(e.time)} ${fmtTime(e.time)}`,
      ])];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${slug || 'export'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
   };

   const exportBtn = (
      <button
         type="button"
         onClick={exportCsv}
         disabled={events.length === 0}
         style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', borderRadius: 8,
            border: 'none', cursor: events.length === 0 ? 'not-allowed' : 'pointer', background: '#18181B', color: '#fff',
            fontFamily: FONT, fontSize: 14, fontWeight: 600, opacity: events.length === 0 ? 0.45 : 1, transition: 'background 150ms ease',
         }}
         onMouseEnter={(e) => { if (events.length) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
         onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#18181B'; }}
      >
         <DownloadIcon />
         Export CSV
      </button>
   );

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Activity Log — ${domain} — SerpBear`}</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Activity Log" actions={exportBtn} contentMaxWidth={880}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
               {/* Filters row */}
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'inline-flex', padding: 4, borderRadius: 10, background: '#F4F4F5', gap: 2 }}>
                     {([['7d', 'Last 7d'], ['all', 'Custom']] as const).map(([val, label]) => {
                        const sel = range === val;
                        return (
                           <button
                              key={val}
                              type="button"
                              onClick={() => setRange(val)}
                              style={{
                                 display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 14px', borderRadius: 7,
                                 border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600,
                                 color: sel ? '#18181B' : '#71717B', background: sel ? '#fff' : 'transparent',
                                 boxShadow: sel ? '0 1px 2px rgba(0,0,0,0.08)' : 'none', transition: 'background 150ms ease, color 150ms ease',
                              }}
                           >
                              {label}
                           </button>
                        );
                     })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <FilterDropdown icon={<PeopleIcon />} minWidth={150} value={person} onChange={() => {}} options={[{ value: person, label: 'All people' }]} />
                     <FilterDropdown
                        icon={<FilterIcon />}
                        minWidth={160}
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v as 'all' | EventType)}
                        options={[
                           { value: 'all', label: 'All activities' },
                           { value: 'created', label: 'Created' },
                           { value: 'optimized', label: 'Optimized' },
                           { value: 'published', label: 'Published' },
                        ]}
                     />
                  </div>
               </div>

               {/* Heatmap card */}
               <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginBottom: 16, fontSize: 13, color: '#71717B' }}>
                     <span>Activities: <strong style={{ color: '#18181B', fontWeight: 600 }}>{events.length}</strong></span>
                     <span>Active days: <strong style={{ color: '#18181B', fontWeight: 600 }}>{activeDays}</strong></span>
                     <span>Most active day: <strong style={{ color: '#18181B', fontWeight: 600 }}>{peakCount > 0 ? `${peakLabel} with ${peakCount} ${peakCount === 1 ? 'activity' : 'activities'}` : '—'}</strong></span>
                  </div>
                  <Heatmap counts={counts} peakKey={peakKey} />
               </div>

               {/* Activity table */}
               <div style={{ overflowX: 'auto' }} className="styled-scrollbar">
                  <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontFamily: FONT }}>
                     <thead>
                        <tr>
                           <th style={{ width: 220, textAlign: 'left', padding: '12px 16px 12px 4px', fontSize: 13, fontWeight: 600, color: '#52525C', borderBottom: '1px solid #F4F4F5' }}>Person</th>
                           <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#52525C', borderBottom: '1px solid #F4F4F5' }}>Activity</th>
                           <th style={{ width: 200, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #F4F4F5' }}>
                              <button
                                 type="button"
                                 onClick={() => setSortAsc((s) => !s)}
                                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#52525C' }}
                              >
                                 Date
                                 <SortArrow asc={sortAsc} />
                              </button>
                           </th>
                        </tr>
                     </thead>
                     <tbody>
                        {isLoading ? (
                           Array.from({ length: 4 }).map((_, i) => (
                              // eslint-disable-next-line react/no-array-index-key
                              <tr key={i}>
                                 <td style={{ padding: '14px 16px 14px 4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                       <span style={{ width: 28, height: 28, borderRadius: 9999, background: '#F1F1F3' }} />
                                       <span style={{ width: 150, height: 12, borderRadius: 6, background: '#F1F1F3' }} />
                                    </div>
                                 </td>
                                 <td style={{ padding: '14px 16px' }}><span style={{ display: 'block', width: '60%', height: 12, borderRadius: 6, background: '#F1F1F3' }} /></td>
                                 <td style={{ padding: '14px 16px' }}><span style={{ display: 'block', width: 120, height: 12, borderRadius: 6, background: '#F1F1F3' }} /></td>
                              </tr>
                           ))
                        ) : events.length === 0 ? (
                           <tr>
                              <td colSpan={3} style={{ padding: '48px 16px', textAlign: 'center', fontSize: 14, color: '#9F9FA9' }}>
                                 No activity in this range. Create or optimize content for <strong>{domain}</strong> to see events here.
                              </td>
                           </tr>
                        ) : (
                           events.map((e) => (
                              <tr key={e.id} className="activity-log-row">
                                 <td style={{ padding: '14px 16px 14px 4px', verticalAlign: 'middle' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                       <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9999, background: '#E4E4E7', color: '#18181B', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                                          {personInitial}
                                       </span>
                                       <span style={{ minWidth: 0, fontSize: 14, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person}</span>
                                    </div>
                                 </td>
                                 <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, fontSize: 14, color: '#18181B' }}>
                                       <span style={{ flexShrink: 0 }}>{e.verb}</span>
                                       <Link href={`/articles/${e.articleId}`} passHref>
                                          <a style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#18181B', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 150ms ease, color 150ms ease' }} className="activity-log-link">
                                             {e.title}
                                          </a>
                                       </Link>
                                       {e.context && <span style={{ flexShrink: 0, color: '#52525C' }}>{e.context}</span>}
                                    </div>
                                 </td>
                                 <td style={{ padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 14, color: '#18181B' }}>{fmtDate(e.time)} </span>
                                    <span style={{ fontSize: 14, color: '#71717B' }}>{fmtTime(e.time)}</span>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </DomainSubLayout>
      </AppShell>
   );
};

export default ActivityLogPage;
