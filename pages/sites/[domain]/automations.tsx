import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import type { AutomationEvent, AutomationPublishMode } from '@/src/core/shared/types/automations';
import { weekRange, toDateKey } from '@/src/core/domain/automations/board';
import AppShell from '../../../components/common/AppShell';
import DomainSubLayout from '../../../components/domains/DomainSubLayout';
import AutomationsBoard from '../../../components/automations/AutomationsBoard';
import AddEventDialog from '../../../components/automations/AddEventDialog';
import { Alert } from '../../../components/koala/core';
import { useAppBanner } from '../../../components/koala/shell';
import { useFetchDomains } from '../../../services/domains';
import { slugToDomain } from '../../../utils/slugToDomain';

type ListResponse = {
  wordpressConnected: boolean;
  siteUrl: string | null;
  events: AutomationEvent[];
};

type CreatePayload = {
  scheduledDate: string;
  title: string;
  targetKeyword: string;
  publishMode: AutomationPublishMode;
};

const AutomationsPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router);
  const domains = domainsData?.domains || [];
  const queryClient = useQueryClient();

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const { from, to } = useMemo(() => weekRange(weekAnchor), [weekAnchor]);

  /** YYYY-MM-DD the add dialog opens on; null while closed. */
  const [dialogDate, setDialogDate] = useState<string | null>(null);
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
    async (payload: CreatePayload) => {
      const res = await fetch(`/api/automations/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(body.message || body.error || 'Failed to schedule event');
      return body;
    },
    {
      onSuccess: () => {
        setDialogDate(null);
        setSubmitError(null);
        void queryClient.invalidateQueries(['automations', slug]);
      },
      onError: (err: unknown) => {
        setSubmitError(err instanceof Error ? err.message : 'Failed to schedule event');
      },
    },
  );

  const deleteMut = useMutation(
    async (eventId: number) => {
      const res = await fetch(`/api/automations/${encodeURIComponent(slug)}/${eventId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to remove event');
      }
    },
    { onSuccess: () => { void queryClient.invalidateQueries(['automations', slug]); } },
  );

  const wordpressConnected = listQ.data?.wordpressConnected ?? true;
  const events = listQ.data?.events ?? [];

  useAppBanner(!listQ.isLoading && !wordpressConnected
    ? {
      variant: 'warning',
      message: 'WordPress is not connected. You can still schedule draft events — connect it to publish live.',
      action: { label: 'Open WordPress settings', href: '/settings/wordpress' },
    }
    : null);

  const openDialog = (date: Date) => {
    setSubmitError(null);
    setDialogDate(toDateKey(date));
  };

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
        subtitle="Plan the week — each scheduled event writes its article on the day and, for live events, publishes it to WordPress."
      >
        {listQ.isError ? (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" title="Could not load calendar">
              {listQ.error instanceof Error ? listQ.error.message : 'Something went wrong.'}
            </Alert>
          </div>
        ) : null}

        <AutomationsBoard
          weekAnchor={weekAnchor}
          events={events}
          onPrevWeek={() => setWeekAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
          onNextWeek={() => setWeekAnchor((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          onThisWeek={() => setWeekAnchor(new Date())}
          onAdd={() => openDialog(new Date())}
          onDayAdd={openDialog}
          onEventClick={(ev) => {
            if (ev.articleId) void router.push(`/articles/${ev.articleId}`);
          }}
          onEventDelete={(ev) => {
            // eslint-disable-next-line no-alert
            if (window.confirm(`Remove "${ev.title}" from the calendar?`)) deleteMut.mutate(ev.id);
          }}
        />

        <AddEventDialog
          open={dialogDate !== null}
          onClose={() => {
            setDialogDate(null);
            setSubmitError(null);
          }}
          initialDate={dialogDate ?? ''}
          wordpressConnected={wordpressConnected}
          submitting={createMut.isLoading}
          error={submitError}
          onSubmit={(payload) => {
            setSubmitError(null);
            createMut.mutate(payload);
          }}
        />
      </DomainSubLayout>
    </AppShell>
  );
};

export default AutomationsPage;
