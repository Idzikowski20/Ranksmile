import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell from '../../components/articles/WizardShell';
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

      // Resume an in-flight job if one exists
      try {
        const progRes = await fetch(`/api/articles/job-progress?articleId=${encodeURIComponent(articleId)}`);
        const prog = await progRes.json().catch(() => ({}));
        if (prog.status === 'running' && prog.jobId) {
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
    })().catch((e) => {
      toast.error(e?.message || 'Generation failed');
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 24 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite', color: '#F29964' }}>
            <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#F97316" style={{ position: 'absolute', inset: 0, margin: 'auto' }}>
            <path d="M12.93 1.64a1 1 0 0 0-1.86 0L9.05 6.87c-.3.78-.4 1.01-.52 1.19-.13.18-.29.34-.47.47-.18.13-.41.22-1.19.52L1.64 11.07a1 1 0 0 0 0 1.86l5.23 2.01c.78.3 1.01.4 1.19.52.18.13.34.29.47.47.13.18.22.41.52 1.19l2.01 5.23a1 1 0 0 0 1.86 0l2.01-5.23c.3-.78.4-1.01.52-1.19.13-.18.29-.34.47-.47.18-.13.41-.22 1.19-.52l5.23-2.01a1 1 0 0 0 0-1.86l-5.23-2.01c-.78-.3-1.01-.4-1.19-.52a1.5 1.5 0 0 1-.47-.47c-.13-.18-.22-.41-.52-1.19L12.93 1.64Z" />
          </svg>
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, lineHeight: '28px', fontWeight: 600, color: '#000', fontFamily: 'var(--font-family-primary)' }}>
            Creating your article
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
            {progressMessage}
          </p>
        </div>

        {progressPct != null && (
          <div style={{ width: '100%', maxWidth: 380, height: 6, borderRadius: 9999, background: '#E4E4E7', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: '#F29964', borderRadius: 9999, transition: 'width 0.3s ease' }} />
          </div>
        )}
      </div>
    </WizardShell>
  );
};

export default GeneratingPage;
