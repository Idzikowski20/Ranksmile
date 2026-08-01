import React, { useEffect, useMemo, useState } from 'react';
import { GuidedTour, type GuidedTourStep } from '../koala/product/GuidedTour';

const STEPS: GuidedTourStep[] = [
  {
    id: 'ask-ranksmile',
    selector: '[data-tour="ask-ranksmile"]',
    title: 'Ask Smily',
    body: 'Need to touch-up your content? Ask Smily, our AI assistant. Highlight text and click Ask Smily to get started.',
  },
  {
    id: 'format',
    selector: '[data-tour="format"]',
    title: 'Formatting & structure',
    body: 'Headings (H1–H3), bold / italic / underline, lists and text alignment.',
  },
  {
    id: 'media',
    selector: '[data-tour="media"]',
    title: 'Images, links & tables',
    body: 'Insert images, links and tables to enrich your article.',
  },
  {
    id: 'content-score',
    selector: '[data-tour="content-score"]',
    title: 'Content Score',
    body: 'Your live score — cover suggested terms and hit targets to push toward 100.',
  },
  {
    id: 'auto-optimize',
    selector: '[data-tour="auto-optimize"]',
    title: 'Auto-Optimize',
    body: 'One click rewrites the draft to close gaps and lift the score.',
  },
];

/** Editor coachmarks — chrome via Koala GuidedTour. */
const EditorOnboarding = () => {
  const [open, setOpen] = useState(false);
  const steps = useMemo(() => STEPS, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem('editor_onboarding_seen')) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <GuidedTour
      open={open}
      steps={steps}
      storageKey="editor_onboarding_seen"
      onClose={() => setOpen(false)}
    />
  );
};

export default EditorOnboarding;
