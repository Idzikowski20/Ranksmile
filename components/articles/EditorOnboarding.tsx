import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Step { target: string; placement: 'bottom' | 'left'; title: string; body: React.ReactNode; }

// Each step anchors to a [data-tour] element in the editor.
const STEPS: Step[] = [
  // ── Editor toolbar ──
  {
    target: 'ask-surfy', placement: 'bottom', title: 'Ask Surfy',
    body: (
      <>
        Need to touch-up your content? Ask Surfy, our AI assistant for a hand!
        <br /><br />
        💡 Highlight the parts you&apos;d like to edit and click &quot;Ask Surfy&quot; to get started.
        <br /><br />
        Surfy knows your and competitors&apos; articles and is aware of Content Editor guidelines.
      </>
    ),
  },
  { target: 'format', placement: 'bottom', title: 'Formatting & structure', body: <>Headings (H1–H3), bold / italic / underline, lists and text alignment.</> },
  { target: 'media', placement: 'bottom', title: 'Images, links & tables', body: <>Insert images, links and tables to enrich your article.</> },
  // ── Top action bar ──
  { target: 'done', placement: 'bottom', title: 'Mark as done', body: <>Mark the article as done when it&apos;s ready for review or publishing.</> },
  { target: 'version', placement: 'bottom', title: 'Version history', body: <>Every save snapshots your draft — restore any earlier version anytime.</> },
  { target: 'voice', placement: 'bottom', title: 'Voice', body: <>Pick the writing voice — SERP-based or one of your Custom Voices.</> },
  { target: 'settings', placement: 'bottom', title: 'Customize', body: <>Tune competitors, terms, word / heading targets and the table columns.</> },
  { target: 'hide-panel', placement: 'bottom', title: 'Hide side panel', body: <>Collapse the panel for a distraction-free, full-width editor.</> },
  { target: 'share', placement: 'bottom', title: 'Share', body: <>Share a read-only link or invite collaborators to your article.</> },
  // ── Right panel (top → bottom) ──
  { target: 'content-score', placement: 'left', title: 'Content Score', body: <>Your live score — cover the suggested terms and hit the targets to push it toward 100. The side gauges break it down into SEO (on-page) and AI Search (LLM citations).</> },
  { target: 'auto-optimize', placement: 'left', title: 'Auto-Optimize', body: <>One click rewrites the draft to close gaps and lift the score.</> },
  { target: 'whats-missing', placement: 'left', title: "What's missing", body: <>The exact actions that will raise your score — each with the points it adds.</> },
  { target: 'competitors', placement: 'left', title: 'Competitors', body: <>Inspect the top-ranking competitor articles for this keyword.</> },
  { target: 'keywords', placement: 'left', title: 'Write & Optimize', body: <>See which terms to add and how often the top competitors use them.</> },
  { target: 'internal-links', placement: 'left', title: 'Internal Links', body: <>Add internal links to your other pages to strengthen topical authority.</> },
  { target: 'pre-publish', placement: 'left', title: 'Pre-Publish Review', body: <>Run the final checks before publishing your article.</> },
  { target: 'publish-export', placement: 'left', title: 'Publish or Export', body: <>Publish to WordPress or export your finished article.</> },
  { target: 'metrics', placement: 'left', title: 'Words · Headings · Paragraphs', body: <>Live structure counts vs the competitor-derived target ranges.</> },
];

const W = 320;

const EditorOnboarding = () => {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; arrow: 'top' | 'left' | 'none'; arrowOffset: number } | null>(null);
  const [ring, setRing] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => { try { if (!localStorage.getItem('editor_onboarding_seen')) setOpen(true); } catch { /* ignore */ } }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem('editor_onboarding_seen', '1'); } catch { /* ignore */ }
  }, []);

  const update = useCallback(() => {
    const step = STEPS[idx];
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el || el.getClientRects().length === 0) {
      setBox({ top: 120, left: Math.max(12, (window.innerWidth - W) / 2), arrow: 'none', arrowOffset: 0 });
      setRing(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRing({ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 });
    const m = 14;
    if (step.placement === 'left') {
      let left = r.left - W - m;
      if (left < 12) left = r.right + m; // flip right if no room on the left
      const top = Math.min(Math.max(r.top + r.height / 2 - 70, 12), window.innerHeight - 240);
      setBox({ top, left, arrow: 'left', arrowOffset: (r.top + r.height / 2) - top });
    } else {
      const top = Math.min(r.bottom + m, window.innerHeight - 280);
      const left = Math.min(Math.max(r.left + r.width / 2 - W / 2, 12), window.innerWidth - W - 12);
      setBox({ top, left, arrow: 'top', arrowOffset: (r.left + r.width / 2) - left });
    }
  }, [idx]);

  // On each step: scroll the target into view, then track it through the scroll.
  useEffect(() => {
    if (!open) return undefined;
    const el = document.querySelector(`[data-tour="${STEPS[idx].target}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    update();
    const settle = setTimeout(update, 400);
    const on = () => update();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { clearTimeout(settle); window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [open, idx, update]);

  if (!open || !box || typeof document === 'undefined') return null;
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const node = (
    <>
      {/* Full-screen blocker — only the tour card stays interactive */}
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 99997, background: 'transparent', cursor: 'default' }}
      />
      {ring && (
        <div style={{ position: 'fixed', top: ring.top, left: ring.left, width: ring.width, height: ring.height, borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', outline: '2px solid #783AFB', outlineOffset: 2, zIndex: 99998, pointerEvents: 'none', transition: 'top 0.2s, left 0.2s, width 0.2s, height 0.2s' }} />
      )}
      <div role="dialog" style={{ position: 'fixed', top: box.top, left: box.left, width: W, background: '#783AFB', color: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 8px 28px rgba(0,0,0,0.25)', zIndex: 99999, fontFamily: 'var(--font-family-primary)', fontSize: 14, lineHeight: '20px' }}>
        {box.arrow === 'top' && <span style={{ position: 'absolute', top: -6, left: Math.min(Math.max(box.arrowOffset - 6, 14), W - 26), width: 14, height: 14, background: '#783AFB', transform: 'rotate(45deg)', borderRadius: 2 }} />}
        {box.arrow === 'left' && <span style={{ position: 'absolute', left: -6, top: Math.min(Math.max(box.arrowOffset - 6, 14), 200), width: 14, height: 14, background: '#783AFB', transform: 'rotate(45deg)', borderRadius: 2 }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Step {idx + 1} of {STEPS.length}</span>
          <button type="button" aria-label="Close" onClick={dismiss} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0, opacity: 0.9 }}>×</button>
        </div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
        <div style={{ fontWeight: 500 }}>{step.body}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <button type="button" onClick={dismiss} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.85)', fontSize: 13, cursor: 'pointer', padding: 0 }}>Skip</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 && <button type="button" onClick={() => setIdx((i) => i - 1)} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Back</button>}
            <button type="button" onClick={() => (isLast ? dismiss() : setIdx((i) => i + 1))} style={{ background: '#fff', color: '#18181B', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{isLast ? 'Done' : 'Next ›'}</button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(node, document.body);
};

export default EditorOnboarding;
