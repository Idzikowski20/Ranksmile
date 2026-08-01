import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import AutomationsCalendar, { MONTHS_FULL, toDateKey } from '../../../components/automations/AutomationsCalendar';
import AddEventDialog from '../../../components/automations/AddEventDialog';
import { Alert, Button } from '../../../components/koala/core';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';
import type { AutomationEvent, AutomationPublishMode } from '../../../lib/types/automations';

type ListResponse = {
  wordpressConnected: boolean;
  siteUrl: string | null;
  events: AutomationEvent[];
};

function monthRange(monthDate: Date): { from: string; to: string } {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const from = toDateKey(new Date(y, m, 1));
  const to = toDateKey(new Date(y, m + 1, 0));
  return { from, to };
}

function fmtDateLabel(d: Date): string {
  return `${MONTHS_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const AutomationsPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router);
  const domains = domainsData?.domains || [];
  const queryClient = useQueryClient();

  const [monthDate, setMonthDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => monthRange(monthDate), [monthDate]);

  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const listQ = useQuery(
    ['automations', slug, from, to],
    async (): Promise<ListResponse> => {
      const res = await fetch(`/api/automations/${encodeURIComponent(slug)}?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load automations');
      }
      return res.json() as Promise<ListResponse>;
    },
    { enabled: Boolean(slug), staleTime: 15_000 },
  );

  const createMut = useMutation(
    async (payload: {
      scheduledDate: string;
      title: string;
      targetKeyword: string;
      publishMode: AutomationPublishMode;
    }) => {
      const res = await fetch(`/api/automations/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        event?: AutomationEvent;
        articleId?: number | null;
      };
      if (!res.ok) {
        if (body.error === 'wordpress_not_connected') {
          throw new Error(body.message || 'Connect WordPress in Settings first.');
        }
        throw new Error(body.message || body.error || 'Failed to create event');
      }
      return body;
    },
    {
      onSuccess: () => {
        setDialogDate(null);
        setSubmitError(null);
        void queryClient.invalidateQueries(['automations', slug]);
      },
      onError: (err: unknown) => {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create event');
      },
    },
  );

  const wordpressConnected = listQ.data?.wordpressConnected ?? true;
  const events = listQ.data?.events ?? [];

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{domain ? `${domain} · Automations` : 'Automations'} | Ranksmile</title>
      </Head>
      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="automations"
        contentMaxWidth={1120}
        heading="Automations"
        subtitle="Schedule article creation and WordPress publish intent on the calendar."
        actions={(
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setDialogDate(new Date())}
          >
            Add event
          </Button>
        )}
      >
        {!listQ.isLoading && !wordpressConnected ? (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" title="Connect WordPress to use Automations">
              This workspace is not connected to WordPress yet. Connect it in Settings before adding events.{' '}
              <Link href="/settings/wordpress" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
                Open WordPress settings
              </Link>
            </Alert>
          </div>
        ) : null}

        {listQ.isError ? (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" title="Could not load calendar">
              {listQ.error instanceof Error ? listQ.error.message : 'Something went wrong.'}
            </Alert>
          </div>
        ) : null}

        <AutomationsCalendar
          monthDate={monthDate}
          today={today}
          events={events}
          onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          onToday={() => {
            const n = new Date();
            setMonthDate(new Date(n.getFullYear(), n.getMonth(), 1));
          }}
          onDayClick={(d) => {
            setSubmitError(null);
            setDialogDate(d);
          }}
          onEventClick={(ev) => {
            if (ev.articleId) void router.push(`/articles/${ev.articleId}`);
          }}
        />

        <AddEventDialog
          open={!!dialogDate}
          onClose={() => {
            setDialogDate(null);
            setSubmitError(null);
          }}
          dateLabel={dialogDate ? fmtDateLabel(dialogDate) : ''}
          scheduledDate={dialogDate ? toDateKey(dialogDate) : ''}
          wordpressConnected={wordpressConnected}
          submitting={createMut.isLoading}
          error={submitError}
          onSubmit={({ title, targetKeyword, publishMode }) => {
            if (!dialogDate) return;
            setSubmitError(null);
            createMut.mutate({
              scheduledDate: toDateKey(dialogDate),
              title,
              targetKeyword,
              publishMode,
            });
          }}
        />
      </DomainSubLayout>
    </AppShell>
  );
};

export default AutomationsPage;
