import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import EmptyEyes from '../../../components/common/EmptyEyes';
import { HoverTooltip, Button, CompactSelect, SegmentedControl, ToolRibbon } from '../../../components/core';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import {
  SentryPanel,
  SentryPanelBody,
  SentryTable,
  SentryTableHead,
  SentryTableBody,
  SentryTableRow,
  SentryTableCell,
  SentryTableHeaderCell,
  SentryEmptyState,
} from '../../../components/sentry-pages';
import { authClient } from '../../../lib/auth/client';
import { useFetchDomains } from '../../../services/domains';
import { usePeople } from '../../../services/people';
import { slugToDomain } from '../../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
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

type Surface = 'Content Editor' | 'Content Audit' | 'Topical Map';
type EventType = 'created' | 'optimized' | 'published';
type LogEvent = {
   id: string;
   articleId: number | string;
   type: EventType;
   verb: string;        // "Created" | "Optimized" | "Published"
   surface: Surface;    // which tool the activity belongs to
   title: string;
   time: Date;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
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
// Compact table date (no year) with the full date+time surfaced on hover.
const fmtDateShort = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtDateFull = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${fmtTime(d)}`;
const fmtRangeLabel = (from: Date | null, to: Date | null) => {
   if (!from) return 'Custom';
   const f = `${MONTHS[from.getMonth()]} ${from.getDate()}`;
   if (!to || sameDay(from, to)) return `${f}, ${from.getFullYear()}`;
   const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
   const t = sameMonth ? `${to.getDate()}` : `${MONTHS[to.getMonth()]} ${to.getDate()}`;
   return `${f} - ${t}, ${to.getFullYear()}`;
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
const SortArrow = ({ asc }: { asc: boolean }) => (
   <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, transition: 'transform 200ms ease', transform: asc ? 'rotate(180deg)' : 'none', color: '#52525C' }}>
      <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />
   </svg>
);
const CalArrow = ({ dir }: { dir: 'left' | 'right' }) => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, transform: dir === 'right' ? 'scaleX(-1)' : 'none' }}>
      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" />
   </svg>
);
const Avatar = ({ initial }: { initial: string }) => (
   <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 9999, background: '#E4E4E7', color: '#18181B', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{initial}</span>
);

// ─── Multi-select filter (CompactSelect) ───────────────────────────────────────

type MultiOpt = { value: string; label: string; initial?: string };
const MultiSelectFilter = ({ prefix, allLabel, countNoun, withSearch, options, selected, onChange }: {
   prefix: React.ReactNode; allLabel: string; countNoun: string; withSearch?: boolean;
   options: MultiOpt[]; selected: string[] | null; onChange: (next: string[] | null) => void;
}) => {
   const allValues = options.map((o) => o.value);
   const eff = selected === null ? allValues : selected;
   const allChecked = options.length > 0 && eff.length === options.length;

   let label = allLabel;
   if (!(selected === null || allChecked)) {
      label = eff.length === 1 ? (options.find((o) => o.value === eff[0])?.label || allLabel) : `${eff.length} ${countNoun}`;
   }

   return (
      <CompactSelect
         multiple
         prefix={prefix}
         size="sm"
         search={withSearch ? { placeholder: 'Search people…' } : false}
         options={options.map((o) => ({
            value: o.value,
            label: o.label,
            textValue: o.label,
            leadingItems: o.initial ? <Avatar initial={o.initial} /> : undefined,
         }))}
         value={eff}
         triggerLabel={label}
         clearable
         onChange={(opts) => {
            const vals = opts.map((o) => String(o.value));
            if (vals.length === 0 || vals.length === options.length) onChange(null);
            else onChange(vals);
         }}
      />
   );
};

// ─── Range calendar (two months) ─────────────────────────────────────────────

type Range = { from: Date | null; to: Date | null };

const MonthGrid = ({ monthDate, range, today, onPick }: { monthDate: Date; range: Range; today: Date; onPick: (d: Date) => void }) => {
   const y = monthDate.getFullYear();
   const m = monthDate.getMonth();
   const startDow = new Date(y, m, 1).getDay();
   const daysInMonth = new Date(y, m + 1, 0).getDate();
   const cells: (Date | null)[] = [];
   for (let i = 0; i < startDow; i += 1) cells.push(null);
   for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(y, m, d));
   while (cells.length % 7 !== 0) cells.push(null);

   return (
      <div style={{ width: 252 }}>
         <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#18181B', marginBottom: 10 }}>{`${MONTHS_FULL[m]} ${y}`}</div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {WEEKDAYS_SHORT.map((w) => (
               <div key={w} style={{ height: 28, display: 'grid', placeItems: 'center', fontSize: 11, color: '#71717B' }}>{w}</div>
            ))}
            {cells.map((day, i) => {
               if (!day) return <div key={`e${i}`} style={{ height: 36 }} />;
               const { from, to } = range;
               const isFrom = !!from && sameDay(day, from);
               const isTo = !!to && sameDay(day, to);
               const isEnd = isFrom || isTo;
               const inRange = !!from && !!to && day > from && day < to;
               const isToday = sameDay(day, today);
               return (
                  <div key={dayKey(day)} style={{ height: 36, display: 'grid', placeItems: 'center', background: (inRange || isEnd) ? '#F4F4F5' : 'transparent', borderRadius: isFrom ? '9999px 0 0 9999px' : isTo ? '0 9999px 9999px 0' : 0 }}>
                     <button
                        type="button"
                        onClick={() => onPick(day)}
                        style={{
                           width: 34, height: 34, borderRadius: 9999, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: isEnd ? 600 : 500,
                           background: isEnd ? '#18181B' : 'transparent', color: isEnd ? '#fff' : '#18181B',
                           border: isToday && !isEnd ? '2px solid #FB6A3C' : '2px solid transparent', transition: 'background 120ms ease',
                        }}
                        onMouseEnter={(e) => { if (!isEnd) (e.currentTarget as HTMLButtonElement).style.background = '#E9E9EC'; }}
                        onMouseLeave={(e) => { if (!isEnd) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                     >
                        {day.getDate()}
                     </button>
                  </div>
               );
            })}
         </div>
      </div>
   );
};

const RangeCalendar = ({ range, onPick, today }: { range: Range; onPick: (d: Date) => void; today: Date }) => {
   const [view, setView] = useState(() => {
      const base = range.from || today;
      return new Date(base.getFullYear(), base.getMonth(), 1);
   });
   const right = new Date(view.getFullYear(), view.getMonth() + 1, 1);

   return (
      <div
         style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, width: 580, maxWidth: 'calc(100vw - 2rem)',
            background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16, padding: 20,
            boxShadow: '0 24px 60px rgba(0,0,0,0.18)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top left', fontFamily: FONT,
         }}
      >
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Button type="button" variant="link" size="xs" onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button>
            <div style={{ display: 'flex', gap: 4 }}>
               <Button type="button" variant="transparent" size="sm" aria-label="Previous month" icon={<CalArrow dir="left" />} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} />
               <Button type="button" variant="transparent" size="sm" aria-label="Next month" icon={<CalArrow dir="right" />} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} />
            </div>
         </div>
         <div style={{ display: 'flex', gap: 36, justifyContent: 'center' }}>
            <MonthGrid monthDate={view} range={range} today={today} onPick={onPick} />
            <MonthGrid monthDate={right} range={range} today={today} onPick={onPick} />
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
   const personImage = (mounted && (session?.data?.user as { image?: string } | undefined)?.image) || '';

   const { data: peopleData } = usePeople();
   const peopleOptions: MultiOpt[] = useMemo(() => {
      const emails = new Set<string>();
      (peopleData?.members || []).forEach((m) => { if (m.email) emails.add(m.email); });
      if (person && person !== 'You') emails.add(person);
      return Array.from(emails).map((e) => ({ value: e, label: e, initial: e.charAt(0).toUpperCase() }));
   }, [peopleData, person]);

   // Filters
   const [mode, setMode] = useState<'7d' | 'custom'>('7d');
   const [customRange, setCustomRange] = useState<Range>({ from: null, to: null });
   const [calOpen, setCalOpen] = useState(false);
   const [peopleSel, setPeopleSel] = useState<string[] | null>(null);
   const [actSel, setActSel] = useState<string[] | null>(null);
   const [sortAsc, setSortAsc] = useState(false);
   const segRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      if (!calOpen) return undefined;
      const onDown = (e: MouseEvent) => { if (segRef.current && !segRef.current.contains(e.target as Node)) setCalOpen(false); };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
   }, [calOpen]);

   const today = useMemo(() => startOfDay(new Date()), []);
   const openCustom = () => {
      setMode('custom');
      if (!customRange.from) {
         const from = new Date(today);
         from.setDate(from.getDate() - 6);
         setCustomRange({ from, to: today });
      }
      setCalOpen(true);
   };
   const pickDay = (d: Date) => {
      setMode('custom');
      const { from, to } = customRange;
      if (!from || (from && to)) { setCustomRange({ from: d, to: null }); return; }
      if (d < from) { setCustomRange({ from: d, to: null }); return; }
      setCustomRange({ from, to: d });
      setCalOpen(false);
   };
   // Clicking a heatmap dot filters the log to that single day.
   const filterToDay = (d: Date) => {
      setMode('custom');
      setCustomRange({ from: startOfDay(d), to: startOfDay(d) });
      setCalOpen(false);
   };

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

   // Build raw events from article timestamps. Optimizations are attributed to
   // Content Audit (our auto-optimize is driven by audit recs); creates/publishes
   // belong to the Content Editor — matching Surfer's activity surfaces.
   const allEvents: LogEvent[] = useMemo(() => {
      const list = (articlesData?.articles || []).filter((a) => a.source !== 'site_context');
      const out: LogEvent[] = [];
      list.forEach((a) => {
         const title = (a.title || '').trim();
         if (!title) return;
         if (a.created_at) out.push({ id: `c-${a.id}`, articleId: a.id, type: 'created', verb: 'Created', surface: 'Content Editor', title, time: new Date(a.created_at) });
         if (a.updated_at && a.updated_at !== a.created_at) out.push({ id: `o-${a.id}`, articleId: a.id, type: 'optimized', verb: 'Optimized', surface: 'Content Audit', title, time: new Date(a.updated_at) });
         if (a.status === 'published' && a.published_at) out.push({ id: `p-${a.id}`, articleId: a.id, type: 'published', verb: 'Published', surface: 'Content Editor', title, time: new Date(a.published_at) });
      });
      return out;
   }, [articlesData]);

   // Apply range + people + activity filters, then sort by date.
   const events = useMemo(() => {
      let start = 0;
      let end = Number.POSITIVE_INFINITY;
      if (mode === '7d') {
         start = Date.now() - 7 * 24 * 60 * 60 * 1000;
      } else if (customRange.from) {
         start = startOfDay(customRange.from).getTime();
         end = endOfDay(customRange.to || customRange.from).getTime();
      }
      const filtered = allEvents.filter((e) => {
         const t = e.time.getTime();
         if (t < start || t > end) return false;
         if (peopleSel !== null && !peopleSel.includes(person)) return false;
         if (actSel !== null && !actSel.includes(e.surface)) return false;
         return true;
      });
      return filtered.sort((a, b) => (sortAsc ? a.time.getTime() - b.time.getTime() : b.time.getTime() - a.time.getTime()));
   }, [allEvents, mode, customRange, peopleSel, actSel, person, sortAsc]);

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
         `${e.verb} ${e.title} ${e.type === 'optimized' ? 'from Content Audit' : 'in Content Editor'}`,
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
      <Button type="button" variant="primary" size="sm" icon={<DownloadIcon />} onClick={exportCsv} disabled={events.length === 0}>
         Export CSV
      </Button>
   );

   const customLabel = mode === 'custom' && customRange.from ? fmtRangeLabel(customRange.from, customRange.to) : 'Custom';

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>{`Activity Log — ${domain} — SerpBear`}</title>
         </Head>

         <DomainSubLayout
            domain={domain}
            slug={slug || ''}
            section="Activity Log"
            heading="Activity Log"
            actions={exportBtn}
            contentMaxWidth={880}
            filters={(
               <ToolRibbon>
                  <div ref={segRef} style={{ position: 'relative' }}>
                     <SegmentedControl
                        size="sm"
                        name="activity-range"
                        value={mode}
                        onChange={(v) => {
                           if (v === '7d') { setMode('7d'); setCalOpen(false); }
                           else openCustom();
                        }}
                        options={[
                           { value: '7d', label: 'Last 7d' },
                           { value: 'custom', label: customLabel },
                        ]}
                     />
                     {calOpen && <RangeCalendar range={customRange} onPick={pickDay} today={today} />}
                  </div>
                  <MultiSelectFilter prefix={<PeopleIcon />} allLabel="All people" countNoun="people" withSearch options={peopleOptions} selected={peopleSel} onChange={setPeopleSel} />
                  <MultiSelectFilter
                     prefix={<FilterIcon />}
                     allLabel="All activities"
                     countNoun="selected"
                     options={[
                        { value: 'Content Audit', label: 'Content Audit' },
                        { value: 'Content Editor', label: 'Content Editor' },
                        { value: 'Topical Map', label: 'Topical Map' },
                     ]}
                     selected={actSel}
                     onChange={setActSel}
                  />
               </ToolRibbon>
            )}
         >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%' }}>
               <SentryPanel>
                  <SentryPanelBody>
                     <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginBottom: 16, fontSize: 13, color: '#71717B' }}>
                        <span>Activities: <strong style={{ color: '#18181B', fontWeight: 600 }}>{events.length}</strong></span>
                        <span>Active days: <strong style={{ color: '#18181B', fontWeight: 600 }}>{activeDays}</strong></span>
                        <span>Most active day: <strong style={{ color: '#18181B', fontWeight: 600 }}>{peakCount > 0 ? `${peakLabel} with ${peakCount} ${peakCount === 1 ? 'activity' : 'activities'}` : '—'}</strong></span>
                     </div>
                     <Heatmap counts={counts} peakKey={peakKey} onPickDay={filterToDay} />
                  </SentryPanelBody>
               </SentryPanel>

               <SentryPanel noPadding>
                  <SentryTable>
                     <SentryTableHead>
                        <tr>
                           <SentryTableHeaderCell style={{ width: 96 }}>Person</SentryTableHeaderCell>
                           <SentryTableHeaderCell>Activity</SentryTableHeaderCell>
                           <SentryTableHeaderCell style={{ width: 200 }}>
                              <Button type="button" variant="transparent" size="sm" onClick={() => setSortAsc((s) => !s)} style={{ gap: 6, fontSize: 11, fontWeight: 600, color: '#6a6772', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                 Date
                                 <SortArrow asc={sortAsc} />
                              </Button>
                           </SentryTableHeaderCell>
                        </tr>
                     </SentryTableHead>
                     <SentryTableBody>
                        {isLoading ? (
                           Array.from({ length: 4 }).map((_, i) => (
                              // eslint-disable-next-line react/no-array-index-key
                              <SentryTableRow key={i}>
                                 <SentryTableCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                       <span style={{ width: 28, height: 28, borderRadius: 9999, background: '#F1F1F3' }} />
                                       <span style={{ width: 150, height: 12, borderRadius: 6, background: '#F1F1F3' }} />
                                    </div>
                                 </SentryTableCell>
                                 <SentryTableCell><span style={{ display: 'block', width: '60%', height: 12, borderRadius: 6, background: '#F1F1F3' }} /></SentryTableCell>
                                 <SentryTableCell><span style={{ display: 'block', width: 120, height: 12, borderRadius: 6, background: '#F1F1F3' }} /></SentryTableCell>
                              </SentryTableRow>
                           ))
                        ) : events.length === 0 ? (
                           <SentryTableRow>
                              <SentryTableCell colSpan={3}>
                                 <SentryEmptyState title="No activities found" description={<EmptyEyes />} />
                              </SentryTableCell>
                           </SentryTableRow>
                        ) : (
                           events.map((e) => (
                              <SentryTableRow key={e.id} className="activity-log-row">
                                 <SentryTableCell>
                                    <HoverTooltip label={person}>
                                       {personImage ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img alt={person} src={personImage} width={28} height={28} style={{ width: 28, height: 28, borderRadius: 9999, objectFit: 'cover', flexShrink: 0, cursor: 'default' }} />
                                       ) : (
                                          <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9999, background: '#E4E4E7', color: '#18181B', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', cursor: 'default' }}>
                                             {personInitial}
                                          </span>
                                       )}
                                    </HoverTooltip>
                                 </SentryTableCell>
                                 <SentryTableCell>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0, fontSize: 14, color: '#18181B' }}>
                                       <span style={{ flexShrink: 0 }}>{e.verb}</span>
                                       <Link href={`/articles/${e.articleId}`} passHref>
                                          <a style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#18181B', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 150ms ease, color 150ms ease' }} className="activity-log-link">
                                             {e.title}
                                          </a>
                                       </Link>
                                       {e.type === 'optimized' ? (
                                          <span style={{ flexShrink: 0, color: '#52525C' }}>
                                             from{' '}
                                             <Link href={`/sites/${slug}/content-audit`} passHref>
                                                <a style={{ fontWeight: 600, color: '#18181B', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 150ms ease, color 150ms ease' }} className="activity-log-link">Content Audit</a>
                                             </Link>
                                          </span>
                                       ) : (
                                          <span style={{ flexShrink: 0, color: '#52525C' }}>in Content Editor</span>
                                       )}
                                    </div>
                                 </SentryTableCell>
                                 <SentryTableCell>
                                    <HoverTooltip label={fmtDateFull(e.time)} align="right">
                                       <span style={{ fontSize: 14, color: '#18181B', cursor: 'default' }}>
                                          {fmtDateShort(e.time)}, <span style={{ color: '#71717B' }}>{fmtTime(e.time)}</span>
                                       </span>
                                    </HoverTooltip>
                                 </SentryTableCell>
                              </SentryTableRow>
                           ))
                        )}
                     </SentryTableBody>
                  </SentryTable>
               </SentryPanel>
            </div>
         </DomainSubLayout>
      </AppShell>
   );
};

// ─── Contribution heatmap ────────────────────────────────────────────────────

const Heatmap = ({ counts, peakKey, onPickDay }: { counts: Map<string, number>; peakKey: string | null; onPickDay: (d: Date) => void }) => {
   const year = new Date().getFullYear();
   const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
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
         const mo = rep.getMonth();
         if (mo !== prev) { prev = mo; return MONTHS[mo]; }
         return '';
      });
      return { weeks: cols, monthLabels: labels };
   }, [year]);

   // Scale the grid to fill the card width (Surfer-sized cells), recomputed on resize.
   const scrollRef = useRef<HTMLDivElement>(null);
   const [cell, setCell] = useState(16);
   useEffect(() => {
      const el = scrollRef.current;
      if (!el) return undefined;
      const measure = () => setCell(Math.max(14, Math.floor((el.clientWidth - 28) / weeks.length)));
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
   }, [weeks.length]);
   const CELL = cell;
   const DOT = Math.max(9, CELL - 5);
   const ROW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

   return (
      <>
         <div ref={scrollRef} style={{ overflowX: 'auto' }} className="styled-scrollbar">
            <div style={{ minWidth: 28 + weeks.length * CELL }}>
               <div style={{ display: 'flex', paddingLeft: 28 }}>
                  {monthLabels.map((label, wi) => (
                     // eslint-disable-next-line react/no-array-index-key
                     <div key={wi} style={{ width: CELL, flexShrink: 0, height: 16, fontSize: 10, color: '#71717B', fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'visible' }}>{label}</div>
                  ))}
               </div>
               <div style={{ display: 'flex' }}>
                  <div style={{ width: 28, flexShrink: 0 }}>
                     {ROW_LABELS.map((d, ri) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <div key={ri} style={{ height: CELL, display: 'flex', alignItems: 'center', fontSize: 10, color: '#71717B', fontFamily: FONT }}>{d}</div>
                     ))}
                  </div>
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
                              const text = `${fmtDate(day)}: ${count} ${count === 1 ? 'activity' : 'activities'}`;
                              return (
                                 <div
                                    key={key}
                                    style={{ width: CELL, height: CELL, display: 'grid', placeItems: 'center', cursor: inYear ? 'pointer' : 'default' }}
                                    onMouseEnter={inYear ? (ev) => { const r = (ev.currentTarget as HTMLDivElement).getBoundingClientRect(); setTip({ text, x: r.left + r.width / 2, y: r.top }); } : undefined}
                                    onMouseLeave={inYear ? () => setTip(null) : undefined}
                                    onClick={inYear ? () => { setTip(null); onPickDay(day); } : undefined}
                                 >
                                    <div style={{ width: DOT, height: DOT, borderRadius: 9999, background: bg, opacity, transition: 'opacity 300ms' }} />
                                 </div>
                              );
                           })}
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
         {tip && typeof document !== 'undefined' && createPortal(
            <div style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 10px))', zIndex: 300, pointerEvents: 'none', background: '#18181B', color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
               {tip.text}
            </div>,
            document.body,
         )}
      </>
   );
};

export default ActivityLogPage;
