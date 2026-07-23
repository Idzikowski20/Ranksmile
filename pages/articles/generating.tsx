import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell from '../../components/articles/WizardShell';
import GeneratingStage from '../../components/articles/GeneratingStage';
import { clearWizardState } from '../../lib/wizardState';

const GeneratingPage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const [progressMessage, setProgressMessage] = useState('Generating article…');
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || startedRef.current) return undefined;
    startedRef.current = true;

    if (!articleId) { router.replace('/articles'); return undefined; }

    const q = router.query;

    const pollJob = (jobId: string) => new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = async () => {
        try {
          const r = await fetch(`/api/articles/job-progress?jobId=${encodeURIComponent(jobId)}`);
          const d = await r.json().catch(() => ({}));
          if (typeof d.progressMessage === 'string' && d.progressMessage.trim()) {
            setProgressMessage(d.progressMessage.trim());
          }
          if (typeof d.totalProgress === 'number') {
            setProgressPct(Math.max(0, Math.min(100, d.totalProgress)));
          }
          if (d.status === 'done') { resolve(); return; }
          if (d.status === 'failed') { reject(new Error(d.progressMessage || 'Generation failed')); return; }
        } catch { /* transient network error — keep polling */ }
        if (Date.now() - started > 8 * 60 * 1000) { reject(new Error('Generation timed out')); return; }
        setTimeout(tick, 3000);
      };
      setTimeout(tick, 1500);
    });

    (async () => {
      let instructions = '';
      let voiceId = 'serp';
      try {
        const artRes = await fetch(`/api/articles/${articleId}`);
        const artData = await artRes.json().catch(() => ({}));
        const article = artData.article as { wizard_state?: string | null } | undefined;
        if (article?.wizard_state) {
          const ws = JSON.parse(article.wizard_state) as { instructions?: string; voiceId?: string };
          instructions = ws.instructions || '';
          voiceId = ws.voiceId || 'serp';
        }
      } catch { /* ignore */ }

      // Resume only an in-flight *generate* job. Looking up by articleId alone used to
      // return the finished deep_analysis job (status=done) and skip /generate entirely.
      try {
        const progRes = await fetch(
          `/api/articles/job-progress?articleId=${encodeURIComponent(articleId)}&jobType=article_generate`,
        );
        if (progRes.ok) {
          const prog = await progRes.json().catch(() => ({}));
          if (prog.status === 'running' && prog.jobId) {
            await pollJob(prog.jobId);
            clearWizardState(articleId);
            setFinished(true);
            return;
          }
          if (prog.status === 'queued' && prog.jobId) {
            await pollJob(prog.jobId);
            clearWizardState(articleId);
            setFinished(true);
            return;
          }
          if (prog.status === 'done') {
            clearWizardState(articleId);
            setFinished(true);
            return;
          }
          // failed / unknown → fall through and start a fresh generate
        }
      } catch { /* start fresh */ }

      const genRes = await fetch(`/api/articles/${articleId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: typeof q.type === 'string' ? q.type : 'blog',
          instructions,
          voiceId,
          internalLinks: q.internal !== '0',
          externalLinks: q.external !== '0',
          reviewOutline: q.outline === '1',
        }),
      });
      const genData = await genRes.json().catch(() => ({}));
      if (!genRes.ok) throw new Error(genData?.error || 'Generation failed');
      await pollJob(genData.jobId as string);
      clearWizardState(articleId);
      setFinished(true);
    })().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      toast.error(msg);
      setFinished(true);
    });

    return undefined;
  }, [router.isReady, articleId, router]);

  useEffect(() => {
    if (!finished) return undefined;
    const t = setTimeout(() => router.replace(articleId ? `/articles/${articleId}` : '/articles'), 700);
    return () => clearTimeout(t);
  }, [finished, articleId, router]);

  return (
    <WizardShell title="Creating your article">
      <GeneratingStage
        size="lg"
        title="Creating your article"
        status={progressMessage}
        progressPct={progressPct}
      />
    </WizardShell>
  );
};

export default GeneratingPage;
