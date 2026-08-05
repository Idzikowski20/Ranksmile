import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell from '../../components/articles/WizardShell';
import GeneratingStage from '../../components/articles/GeneratingStage';
import { clearWizardState } from '../../lib/wizardState';
import { isUsableArticleHtml } from '../../lib/articleHtmlUsable';
import { shouldSkipFreshGenerate } from '../../lib/generateResume';

async function fetchArticleContent(articleId: string): Promise<{
  content: string;
  instructions: string;
  voiceId: string;
}> {
  const artRes = await fetch(`/api/articles/${articleId}`);
  const artData = await artRes.json().catch(() => ({})) as {
    article?: { content?: string | null; wizard_state?: string | null };
  };
  let instructions = '';
  let voiceId = 'serp';
  if (artData.article?.wizard_state) {
    try {
      const ws = JSON.parse(artData.article.wizard_state) as { instructions?: string; voiceId?: string };
      instructions = ws.instructions || '';
      voiceId = ws.voiceId || 'serp';
    } catch { /* ignore bad wizard_state */ }
  }
  return { content: artData.article?.content || '', instructions, voiceId };
}

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
      const pre = await fetchArticleContent(articleId).catch(() => ({
        content: '', instructions: '', voiceId: 'serp',
      }));
      const { instructions, voiceId } = pre;

      // Resume only an in-flight *generate* job. A prior "done" with empty HTML must
      // NOT skip — that left article 170 stuck on a stub after an empty LLM result.
      try {
        const progRes = await fetch(
          `/api/articles/job-progress?articleId=${encodeURIComponent(articleId)}&jobType=article_generate`,
        );
        if (progRes.ok) {
          const prog = await progRes.json().catch(() => ({})) as { status?: string; jobId?: string };
          const articleHtml = (await fetchArticleContent(articleId).catch(() => ({ content: '' }))).content;
          const action = shouldSkipFreshGenerate({ jobStatus: prog.status, articleHtml });
          if (action === 'poll' && prog.jobId) {
            await pollJob(prog.jobId);
            const after = await fetchArticleContent(articleId);
            if (!isUsableArticleHtml(after.content)) {
              throw new Error('Generation finished without usable article content');
            }
            clearWizardState(articleId);
            setFinished(true);
            return;
          }
          if (action === 'finish') {
            clearWizardState(articleId);
            setFinished(true);
            return;
          }
          // fresh → fall through
        }
      } catch (e) {
        // Only swallow lookup errors; content-empty after poll must surface.
        if (e instanceof Error && e.message.includes('usable article')) throw e;
      }

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
      if (!genRes.ok) {
        const detail = typeof genData?.message === 'string' && genData.message.trim()
          ? genData.message.trim()
          : (typeof genData?.error === 'string' ? genData.error : 'Generation failed');
        const issues = Array.isArray(genData?.planValidation?.issues)
          ? genData.planValidation.issues
            .map((i: { code?: string; message?: string }) => i?.message || i?.code)
            .filter(Boolean)
            .slice(0, 2)
            .join('; ')
          : '';
        throw new Error(issues ? `${detail}: ${issues}` : detail);
      }
      await pollJob(genData.jobId as string);
      const after = await fetchArticleContent(articleId);
      if (!isUsableArticleHtml(after.content)) {
        throw new Error('Generation finished without usable article content');
      }
      clearWizardState(articleId);
      setFinished(true);
    })().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setProgressMessage(msg);
      setProgressPct(null);
      toast.error(msg);
      // Stay on this page so a retry (reload) can start a fresh generate.
    });

    return undefined;
  }, [router.isReady, articleId, router]);

  useEffect(() => {
    if (!finished) return undefined;
    const t = setTimeout(() => router.replace(articleId ? `/articles/${articleId}?reveal=1` : '/articles'), 700);
    return () => clearTimeout(t);
  }, [finished, articleId, router]);

  return (
    <WizardShell title="Creating your article">
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
        <GeneratingStage
          size="lg"
          title="Creating your article"
          status={progressMessage}
          progressPct={progressPct}
        />
      </div>
    </WizardShell>
  );
};

export default GeneratingPage;
