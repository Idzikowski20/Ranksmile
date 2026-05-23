import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo } from 'react';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

function relativeTime(dateStr: string): string {
   const d = new Date(dateStr);
   const diff = Date.now() - d.getTime();
   const mins = Math.floor(diff / 60000);
   if (mins < 60) return `${mins}m ago`;
   const hrs = Math.floor(mins / 60);
   if (hrs < 24) return `${hrs}h ago`;
   const days = Math.floor(hrs / 24);
   if (days < 30) return `${days}d ago`;
   return d.toLocaleDateString();
}

const EVENT_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
   published: { bg: '#F0FDF4', color: '#15803D', dot: '#16a34a' },
   draft: { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
   updated: { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
   created: { bg: '#FAF5FF', color: '#6D28D9', dot: '#783AFB' },
};

type LogEntry = {
   id: string | number;
   type: 'created' | 'updated' | 'published' | 'draft';
   title: string;
   keyword?: string;
   time: string;
   url?: string;
};

const ActivityLogPage: NextPage = () => {
   const router = useRouter();
   const { domain: slug } = router.query as { domain: string };
   const domain = slug ? slugToDomain(slug) : '';

   const { data: domainsData } = useFetchDomains(router, true);
   const domains = domainsData?.domains || [];
   const activeDomain = domains.find((d) => d.slug === slug);

   const { data: articlesData, isLoading } = useQuery(
      ['articles-activity', activeDomain?.ID],
      async () => {
         const res = await fetch(`/api/articles?domainId=${activeDomain!.ID}`);
         return res.json();
      },
      { enabled: !!activeDomain?.ID },
   );

   const events: LogEntry[] = useMemo(() => {
      const articles: any[] = articlesData?.articles || [];
      const entries: LogEntry[] = [];

      articles.forEach((a: any) => {
         // Published event
         if (a.status === 'published' && a.published_at) {
            entries.push({
               id: `pub-${a.id}`,
               type: 'published',
               title: a.title,
               keyword: a.target_keyword,
               time: a.published_at,
               url: a.publish_url,
            });
         }
         // Created event
         if (a.created_at) {
            entries.push({
               id: `create-${a.id}`,
               type: 'created',
               title: a.title,
               keyword: a.target_keyword,
               time: a.created_at,
            });
         }
         // Updated (if different from created)
         if (a.updated_at && a.updated_at !== a.created_at) {
            entries.push({
               id: `upd-${a.id}`,
               type: 'updated',
               title: a.title,
               keyword: a.target_keyword,
               time: a.updated_at,
            });
         }
      });

      // Sort by time descending
      return entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 50);
   }, [articlesData]);

   const EVENT_LABELS: Record<string, string> = {
      published: 'Published',
      created: 'Created',
      updated: 'Updated',
      draft: 'Saved draft',
   };

   return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
         <Head>
            <title>Activity Log — {domain} — SerpBear</title>
         </Head>

         <DomainSubLayout domain={domain} slug={slug || ''} section="Activity Log">
            <div style={{ maxWidth: 680 }}>
               {/* Header description */}
               <p style={{ fontSize: 14, color: '#52525C', margin: '0 0 24px', lineHeight: 1.6, fontFamily: 'var(--font-family-primary)' }}>
                  Track content creation, optimization, and publishing events. Stay aligned with your team's work.
               </p>

               {isLoading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>Loading…</div>
               ) : events.length === 0 ? (
                  <div
                     style={{
                        padding: 32,
                        textAlign: 'center',
                        border: '1px solid #F4F4F5',
                        borderRadius: 12,
                        fontSize: 14,
                        color: '#9F9FA9',
                        fontFamily: 'var(--font-family-primary)',
                     }}
                  >
                     No activity yet. Start creating content for <strong>{domain}</strong> to see events here.
                  </div>
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {events.map((event, i) => {
                        const s = EVENT_COLORS[event.type] || EVENT_COLORS.created;
                        return (
                           <div
                              key={event.id}
                              style={{
                                 display: 'flex',
                                 gap: 16,
                                 paddingBottom: i < events.length - 1 ? 20 : 0,
                              }}
                           >
                              {/* Timeline line + dot */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 20 }}>
                                 <div
                                    style={{
                                       width: 10,
                                       height: 10,
                                       borderRadius: '50%',
                                       background: s.dot,
                                       marginTop: 4,
                                       flexShrink: 0,
                                    }}
                                 />
                                 {i < events.length - 1 && (
                                    <div style={{ width: 1, flexGrow: 1, background: '#F4F4F5', marginTop: 4 }} />
                                 )}
                              </div>

                              {/* Event content */}
                              <div style={{ flex: 1, paddingBottom: i < events.length - 1 ? 0 : 0 }}>
                                 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span
                                             style={{
                                                padding: '1px 8px',
                                                borderRadius: 20,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: s.bg,
                                                color: s.color,
                                                fontFamily: 'var(--font-family-primary)',
                                             }}
                                          >
                                             {EVENT_LABELS[event.type]}
                                          </span>
                                          <span
                                             style={{
                                                fontSize: 13,
                                                fontWeight: 500,
                                                color: '#09090B',
                                                fontFamily: 'var(--font-family-primary)',
                                             }}
                                          >
                                             {event.title}
                                          </span>
                                       </div>
                                       {event.keyword && (
                                          <div style={{ fontSize: 12, color: '#71717B', marginTop: 2, fontFamily: 'var(--font-family-primary)' }}>
                                             Keyword: {event.keyword}
                                          </div>
                                       )}
                                       {event.url && (
                                          <a
                                             href={event.url}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             style={{
                                                fontSize: 12,
                                                color: '#783AFB',
                                                marginTop: 2,
                                                display: 'block',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontFamily: 'var(--font-family-primary)',
                                             }}
                                          >
                                             {event.url}
                                          </a>
                                       )}
                                    </div>
                                    <span style={{ fontSize: 12, color: '#9F9FA9', flexShrink: 0, fontFamily: 'var(--font-family-primary)', marginTop: 2 }}>
                                       {relativeTime(event.time)}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </DomainSubLayout>
      </AppShell>
   );
};

export default ActivityLogPage;
