import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import type { AutomationEvent, AutomationPublishMode } from '@/src/core/shared/types/automations';
import {
  WINDOW_DAYS, startOfDay, shiftDays, windowRange, toDateKey,
} from '@/src/core/domain/automations/board';
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
  country: string;
  events: AutomationEvent[];
};

type CreatePayload = {
  scheduledDate: string;
  keywords: string[];
  publishMode: AutomationPublishMode;
};

const AutomationsPage: NextPage = () => {
  const router = useRouter();
  const slug = typeof router.query.domain === 'string' ? router.query.domain : '';
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router);
  const domains = domainsData?.domains || [];
  const queryClient = useQueryClient();

  // Today and the next days; the arrows page by the window size.
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const { from, to } = useMemo(() => windowRange(windowStart), [windowStart]);

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
        // The picked day is a day on this browser's calendar; the cron runs it on that day there.
        body: JSON.stringify({ ...payload, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(body.message || body.error || 'Failed to remove event');
      }
    },
    {
      onSuccess: () => { void queryClient.invalidateQueries(['automations', slug]); },
      // The card stays on the calendar, so say why instead of failing silently.
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Could not remove the event.');
      },
    },
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
        subtitle="Plan the coming days — each scheduled keyword is written into an article on its day and, for live events, published to WordPress."
      >
        {listQ.isError ? (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" title="Could not load calendar">
              {listQ.error instanceof Error ? listQ.error.message : 'Something went wrong.'}
            </Alert>
          </div>
        ) : null}

        <AutomationsBoard
          windowStart={windowStart}
          events={events}
          onPrevDays={() => setWindowStart((d) => shiftDays(d, -WINDOW_DAYS))}
          onNextDays={() => setWindowStart((d) => shiftDays(d, WINDOW_DAYS))}
          onToday={() => setWindowStart(startOfDay(new Date()))}
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
          slug={slug}
          country={listQ.data?.country}
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
