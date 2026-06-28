import React, { useEffect, useRef, useState } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import WizardShell from '../../components/articles/WizardShell';
import { clearWizardState } from '../../lib/wizardState';

const STEPS = [
  'Reviewing ranking content & terms',
  'Building the outline',
  'Writing sections',
  'Inserting internal & external links',
  'Optimizing for AI Search & SEO',
];

// While the real generation finishes, cycle the last step's label so it never
// looks frozen on a single spinner.
const OPTIMIZING_MSGS = [
  'Optimizing for AI Search & SEO',
  'Tuning headings & structure',
  'Improving readability & flow',
  'Strengthening keyword coverage',
  'Polishing the final draft',
];

const GeneratingPage: NextPage = () => {
  const router = useRouter();
  const articleId = typeof router.query.articleId === 'string' ? router.query.articleId : '';
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [holdIdx, setHoldIdx] = useState(0);
  const startedRef = useRef(false);

  // Kick off the real generation once.
  useEffect(() => {
    if (!router.isReady || startedRef.current) return;
    startedRef.current = true;

    if (!articleId) { router.replace('/articles'); return; }

    const q = router.query;
    let instructions = '';
    let voiceId = 'serp';
    try {
      instructions = sessionStorage.getItem(`nc_instructions_${articleId}`) || '';
      voiceId = sessionStorage.getItem(`nc_voice_${articleId}`) || 'serp';
    } catch { /* ignore */ }
    // Generation runs async on the sidecar: kick it off (returns a jobId), then poll the
    // job until the result is written back to the article. Avoids the multi-minute
    // synchronous wait that would exceed the serverless function limit.
    const pollJob = (jobId: string) => new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = async () => {
        try {
          const r = await fetch(`/api/articles/job-progress?jobId=${encodeURIComponent(jobId)}`);
          const d = await r.json().catch(() => ({}));
          if (d.status === 'done') { resolve(); return; }
          if (d.status === 'failed') { reject(new Error(d.progressMessage || 'Generation failed')); return; }
        } catch { /* transient network error — keep polling */ }
        if (Date.now() - started > 8 * 60 * 1000) { reject(new Error('Generation timed out')); return; }
        setTimeout(tick, 3000);
      };
      setTimeout(tick, 3000);
    });

    fetch(`/api/articles/${articleId}/generate`, {
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
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || 'Generation failed');
        return d.jobId as string;
      })
      .then((jobId) => pollJob(jobId))
      .then(() => { clearWizardState(articleId); setFinished(true); })
      .catch((e) => { toast.error(e?.message || 'Generation failed'); setFinished(true); });
  }, [router.isReady, articleId, router]);

  // Step animation: advance until the last-but-one step, hold until the real
  // generation finishes, then complete and open the editor.
  useEffect(() => {
    if (finished) {
      setStep(STEPS.length);
      const t = setTimeout(() => router.replace(articleId ? `/articles/${articleId}` : '/articles'), 700);
      return () => clearTimeout(t);
    }
    if (step < STEPS.length - 1) {
      const t = setTimeout(() => setStep((s) => s + 1), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step, finished, articleId, router]);

  // Hold on the last step → rotate its label so the wait never looks frozen.
  useEffect(() => {
    if (finished || step !== STEPS.length - 1) { setHoldIdx(0); return undefined; }
    const t = setInterval(() => setHoldIdx((i) => (i + 1) % OPTIMIZING_MSGS.length), 2200);
    return () => clearInterval(t);
  }, [step, finished]);

  return (
    <WizardShell title="Creating your article">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 24 }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite', color: '#783AFB' }}>
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
            This usually takes a minute. You can keep this tab open.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const label = active && i === STEPS.length - 1 && !finished ? OPTIMIZING_MSGS[holdIdx] : s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done || active ? 1 : 0.45, transition: 'opacity 0.3s' }}>
                <span style={{ width: 20, height: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {done ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#1AB25E' }}><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : active ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.9s linear infinite', color: '#783AFB' }}><path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                  ) : (
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: '#D4D4D8' }} />
                  )}
                </span>
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#09090B' : '#52525C', fontFamily: 'var(--font-family-primary)' }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </WizardShell>
  );
};

export default GeneratingPage;
