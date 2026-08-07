import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { radius, shadow } from '../tokens/effects';
import { zIndex } from '../tokens/zIndex';
import { typeface } from '../tokens/typography';
import { brandMain, greyNeutral } from '../tokens/colors';
import { popoverMotion } from '../motion';
import Button from '../primitives/Button';

/**
 * Swallows every pointer event for as long as the tour runs, so the app underneath
 * (including the spotlighted element itself) cannot be clicked mid-walkthrough.
 * It is also inert on click: the only ways out are Skip, finishing the last step,
 * or Escape — a stray click must never dismiss a tour the user hasn't read.
 */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndex.tour};
  pointer-events: auto;
`;

/** Dimming for centered steps — anchored ones get theirs from the Spot's ring shadow. */
const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
`;

const Card = styled.div<{ $centered: boolean }>`
  position: absolute;
  z-index: ${zIndex.tour};
  pointer-events: auto;
  width: ${(p) => (p.$centered ? 'min(380px, calc(100vw - 32px))' : 'min(340px, calc(100vw - 24px))')};
  background: ${semantic.background.primary};
  border: 1px solid ${semantic.border.primary};
  border-radius: ${radius.sm};
  box-shadow: ${shadow.lg};
  overflow: hidden;
  font-family: ${typeface.body};
  ${popoverMotion};
`;

/** Figma `4897:5384` image slot — 8px gutter, inner panel rounded on top only. */
const IllustrationSlot = styled.div`
  padding: 8px 8px 0;
  background: ${semantic.background.primary};
`;

const IllustrationInner = styled.div`
  height: 220px;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
  background: ${semantic.background.secondary};
`;

const Info = styled.div<{ $divided: boolean }>`
  padding: 16px;
  ${(p) => (p.$divided ? `border-top: 1px solid ${semantic.border.primary};` : '')}
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
  /** Omit to render the step as a centered modal card instead of an anchored coachmark. */
  selector?: string;
  title: string;
  body: string;
  /** Fills the Figma image slot. Centered steps without one collapse to a text-only card. */
  illustration?: React.ReactNode;
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
  /** Measured so the bottom clamp uses the real card, not a guess that lets a long
   *  tour walk the card off the bottom of the screen. 380 ≈ an illustrated card. */
  const [cardH, setCardH] = useState(380);
  const cardRef = useRef<HTMLDivElement>(null);

  /** The single exit: marks the tour seen so it doesn't reappear. Skip, Done and
   *  Escape all route through here — there is no dismissal that leaves it pending. */
  const finish = useCallback(() => {
    if (storageKey && typeof localStorage !== 'undefined') { // check-koala-tokens-ignore
      localStorage.setItem(storageKey, '1'); // check-koala-tokens-ignore — tour prefs
    }
    onClose();
  }, [storageKey, onClose]);

  /**
   * Focus trap. The overlay already swallows pointer events, so without this Tab would
   * still walk into the blocked app behind it — reachable but unclickable, which is
   * worse than either state alone. Focus is restored to wherever it came from on close.
   */
  useEffect(() => {
    if (!open) return undefined;
    const returnTo = document.activeElement as HTMLElement | null;
    const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(
      cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    ).filter((el) => !el.hasAttribute('disabled'));

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      const card = cardRef.current;
      if (!card) return;
      // Nothing focusable yet (or focus escaped) — pull it back to the card itself.
      if (!items.length) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!card.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onTab, true);
    return () => {
      document.removeEventListener('keydown', onTab, true);
      returnTo?.focus?.();
    };
  }, [open]);

  /** Land focus on the card each step so the new content is announced. */
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, idx]);

  useEffect(() => {
    if (!open) return undefined;
    const step = steps[idx];
    if (!step) return undefined;
    const el = step.selector ? document.querySelector(step.selector) : null;

    if (!el) setRect(null);
    // A long tour walks down a scrollable sidebar — pull the target into view first,
    // then measure on the next frame so the rect isn't the pre-scroll position.
    // Feature-checked: an unimplemented scrollIntoView (jsdom, exotic elements) must
    // not throw out of the effect and take the whole tour down with it.
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const frame = requestAnimationFrame(() => {
      if (el) setRect(el.getBoundingClientRect());
      const h = cardRef.current?.offsetHeight;
      if (h) setCardH(h);
    });

    const remeasure = () => { if (el) setRect(el.getBoundingClientRect()); };
    // Escape is Skip's keyboard equivalent, not a separate dismissal — a pointer-blocked
    // overlay with no keyboard way out would be a trap.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', remeasure);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', remeasure);
    };
  }, [open, idx, steps, finish]);

  if (!open || typeof document === 'undefined' || !steps[idx]) return null;

  const step = steps[idx];
  const last = idx >= steps.length - 1;
  // A step that asked for an anchor it couldn't find still centers — better than
  // pinning the card to a stale 0,0 rect.
  const centered = !rect;

  // Anchored: sit beside the target when there's room (sidebar items → card on the
  // right), otherwise drop below it. The card tracks the target down the sidebar but
  // stops once its own bottom would leave the viewport, so late steps in a long tour
  // hold their position instead of sliding off-screen.
  const CARD_W = 348;
  const MARGIN = 16;
  const maxTop = Math.max(MARGIN, window.innerHeight - cardH - MARGIN);
  const position: React.CSSProperties = (() => {
    if (centered) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    if (window.innerWidth - rect.right >= CARD_W + 24) {
      return {
        top: Math.max(MARGIN, Math.min(rect.top - 8, maxTop)),
        left: rect.right + MARGIN,
      };
    }
    return {
      top: Math.max(MARGIN, Math.min(rect.bottom + 12, maxTop)),
      left: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
    };
  })();

  return createPortal(
    <Overlay data-testid="tour-overlay">
      {centered ? <Backdrop data-testid="tour-backdrop" /> : <Spot $rect={rect} />}
      <Card
        ref={cardRef}
        tabIndex={-1}
        $centered={centered}
        style={position}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
      >
        {step.illustration ? (
          <IllustrationSlot>
            <IllustrationInner>{step.illustration}</IllustrationInner>
          </IllustrationSlot>
        ) : null}
        <Info $divided={Boolean(step.illustration)}>
          <div style={{ fontSize: 12, color: greyNeutral[500], marginBottom: 8 }}>
            {idx + 1} of {steps.length}
          </div>
          <Title>{step.title}</Title>
          <Body>{step.body}</Body>
          {/* Skip is pushed to the far edge: it ends the tour for good, so it must not
              sit next to the button being clicked repeatedly to advance. */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="transparent" size="sm" onClick={finish}>
              Skip
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              {idx > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => setIdx((i) => i - 1)}>
                  Back
                </Button>
              ) : null}
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
          </div>
        </Info>
      </Card>
    </Overlay>,
    document.body,
  );
}

export default GuidedTour;
