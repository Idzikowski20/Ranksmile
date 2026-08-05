/**
 * Animated pipeline queue strip — polls DB-backed jobs so status survives refresh.
 * Uses shared GeneratingStage (nc-gen) while queued/running.
 */
import { useEffect, useRef, useState } from 'react';
import GeneratingStage from './GeneratingStage';
import { Badge } from '../koala/core';
import { StatusBadge, type StatusTone } from '../koala/primitives/StatusBadge';

type PipelineJob = {
  id: number;
  queue: string;
  status: string;
  worker: string | null;
  error: string | null;
};

type JobsResponse = {
  activeCount: number;
  latest: PipelineJob | null;
  jobs: PipelineJob[];
};

const STORAGE_KEY = (articleId: number) => `ranksmile:pipeline-active:${articleId}`;

const QUEUE_LABEL: Record<string, string> = {
  serp: 'SERP',
  serp_crawl: 'SERP',
  coverage: 'Coverage',
  live_score: 'Live score',
  ner: 'NER',
  fingerprint: 'Fingerprint',
  tfidf: 'TF-IDF',
  planner: 'Planner',
  visibility: 'Visibility',
  geo: 'GEO',
  diff: 'Diff',
  embeddings: 'Embeddings',
};

function queueLabel(q: string): string {
  return QUEUE_LABEL[q] || q.replace(/_/g, ' ');
}

function queueStatusTone(status: string): StatusTone {
  return status === 'running' ? 'running' : 'queued';
}

function isActiveStatus(status: string): boolean {
  return status === 'queued' || status === 'running';
}

/** Queues that should not surface the sidebar status strip (silent background work). */
const HIDDEN_STRIP_QUEUES = new Set(['live_score']);

export function isStripVisibleQueue(queue: string): boolean {
  return !HIDDEN_STRIP_QUEUES.has(queue);
}

/** One chip per queue — prefer running over queued, then newest id. */
export function dedupeActiveJobs(jobs: PipelineJob[]): PipelineJob[] {
  const byQueue = new Map<string, PipelineJob>();
  for (const j of jobs) {
    if (!isActiveStatus(j.status)) continue;
    if (!isStripVisibleQueue(j.queue)) continue;
    const prev = byQueue.get(j.queue);
    if (!prev) {
      byQueue.set(j.queue, j);
      continue;
    }
    const prefer =
      (j.status === 'running' && prev.status !== 'running') ||
      (j.status === prev.status && j.id > prev.id);
    if (prefer) byQueue.set(j.queue, j);
  }
  return Array.from(byQueue.values()).sort((a, b) => b.id - a.id).slice(0, 4);
}

export default function PipelineStatusStrip(props: { articleId: number | string | null | undefined }) {
  const articleId = props.articleId != null ? Number(props.articleId) : null;
  const [data, setData] = useState<JobsResponse | null>(null);
  const [resumeHint, setResumeHint] = useState(false);
  const [enterAnim, setEnterAnim] = useState(false);
  const prevActive = useRef(false);

  useEffect(() => {
    if (!articleId || Number.isNaN(articleId)) return undefined;
    try {
      if (window.localStorage.getItem(STORAGE_KEY(articleId)) === '1') {
        setResumeHint(true);
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }, [articleId]);

  useEffect(() => {
    if (!articleId || Number.isNaN(articleId)) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/pipeline/jobs?articleId=${encodeURIComponent(String(articleId))}`);
        if (!res.ok) return;
        const json = (await res.json()) as JobsResponse;
        if (cancelled) return;
        setData(json);
        setResumeHint(false);

        const active = (json.activeCount ?? 0) > 0;
        try {
          if (active) window.localStorage.setItem(STORAGE_KEY(articleId), '1');
          else window.localStorage.removeItem(STORAGE_KEY(articleId));
        } catch {
          /* ignore */
        }

        if (active && !prevActive.current) setEnterAnim(true);
        prevActive.current = active;
      } catch {
        /* ignore */
      }
    };

    void tick();
    const activePoll = (data?.activeCount ?? 0) > 0 || resumeHint;
    const id = window.setInterval(() => void tick(), activePoll ? 1500 : 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [articleId, data?.activeCount, resumeHint]);

  if (!articleId) return null;

  const waitingForResume = resumeHint && !data?.latest;
  if (!data?.latest && !waitingForResume) return null;

  const latest = data?.latest;
  const visibleJobs = dedupeActiveJobs(data?.jobs ?? []);
  const latestVisible = latest && isStripVisibleQueue(latest.queue) ? latest : visibleJobs[0] ?? null;
  const active = visibleJobs.length > 0
    || (latestVisible != null && isActiveStatus(latestVisible.status));

  // Hide idle / failed / live_score-only strip — only show while visible queues run.
  if (!active && !waitingForResume) return null;

  const status = latestVisible?.status ?? 'queued';
  const queue = latestVisible?.queue ?? 'pipeline';
  const label = waitingForResume
    ? 'Wznawiam pipeline…'
    : status === 'queued'
      ? `W kolejce · ${queueLabel(queue)}`
      : `W tle · ${queueLabel(queue)}`;

  const activeJobs = visibleJobs;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'pipeline-queue-strip',
        'pipeline-queue-strip--active',
        enterAnim ? 'pipeline-queue-strip--enter' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onAnimationEnd={() => setEnterAnim(false)}
    >
      <GeneratingStage
        size="sm"
        layout="inline"
        title={label}
        status="Działa w tle — możesz odświeżyć stronę, kolejka wróci sama."
        showProgress={false}
      />
      {activeJobs.length > 0 ? (
        <div className="pipeline-queue-chips">
          {activeJobs.map((j, i) => (
            <span
              key={j.queue}
              className={`pipeline-queue-chip pipeline-queue-chip--${j.status}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Badge appearance="neutral" size="sm" style={{ height: 'auto', padding: '0 4px', background: 'transparent', border: 'none' }}>
                {queueLabel(j.queue)}
              </Badge>
              <StatusBadge status={queueStatusTone(j.status)} label={j.status === 'queued' ? 'queued' : 'running'} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
