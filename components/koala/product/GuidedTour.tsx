import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { radius, shadow } from '../tokens/effects';
import { zIndex } from '../tokens/zIndex';
import { typeface } from '../tokens/typography';
import { brandMain, greyNeutral } from '../tokens/colors';
import { popoverMotion } from '../motion';
import Button from '../primitives/Button';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.tour};
  pointer-events: none;
`;

const Card = styled.div`
  position: absolute;
  z-index: ${zIndex.tour};
  pointer-events: auto;
  width: min(320px, calc(100vw - 24px));
  background: ${semantic.background.primary};
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius['2xl']};
  box-shadow: ${shadow.lg};
  padding: 16px;
  font-family: ${typeface.body};
  ${popoverMotion};
`;

const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${semantic.text.primary};
  margin-bottom: 4px;
`;

const Body = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  color: ${semantic.text.secondary};
  line-height: 20px;
`;

const Spot = styled.div<{ $rect: DOMRect }>`
  position: absolute;
  pointer-events: none;
  border: 2px solid ${brandMain};
  border-radius: ${radius.lg};
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  top: ${(p) => p.$rect.top - 4}px;
  left: ${(p) => p.$rect.left - 4}px;
  width: ${(p) => p.$rect.width + 8}px;
  height: ${(p) => p.$rect.height + 8}px;
`;

export type GuidedTourStep = {
  id: string;
  selector: string;
  title: string;
  body: string;
};

export type GuidedTourProps = {
  steps: GuidedTourStep[];
  open: boolean;
  onClose: () => void;
  storageKey?: string;
};

/** Koala GuidedTour — Figma `4897:5383`. Chrome only; steps via props. */
export function GuidedTour({ steps, open, onClose, storageKey }: GuidedTourProps) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const step = steps[idx];
    if (!step) return undefined;
    const el = document.querySelector(step.selector);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, idx, steps, onClose]);

  if (!open || typeof document === 'undefined' || !steps[idx]) return null;

  const step = steps[idx];
  const last = idx >= steps.length - 1;
  const cardTop = rect ? Math.min(rect.bottom + 12, window.innerHeight - 180) : 80;
  const cardLeft = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 340) : 24;

  const finish = () => {
    if (storageKey && typeof localStorage !== 'undefined') { // check-koala-tokens-ignore
      localStorage.setItem(storageKey, '1'); // check-koala-tokens-ignore — tour prefs
    }
    onClose();
  };

  return createPortal(
    <Overlay>
      {rect ? <Spot $rect={rect} /> : null}
      <Card style={{ top: cardTop, left: cardLeft }}>
        <div style={{ fontSize: 12, color: greyNeutral[500], marginBottom: 8 }}>
          {idx + 1} / {steps.length}
        </div>
        <Title>{step.title}</Title>
        <Body>{step.body}</Body>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="transparent" size="sm" onClick={finish}>
            Skip
          </Button>
          {!last ? (
            <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
              Next
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>
              Done
            </Button>
          )}
        </div>
      </Card>
    </Overlay>,
    document.body,
  );
}

export default GuidedTour;
