'use client';

/**
 * GlobalSmoothCaret — a single overlay, mounted once in _app, that gives EVERY
 * eligible single-line text input a spring-animated caret (à la Skiper106) while
 * leaving each input's own markup/styling untouched.
 *
 * How it works: on focus of an eligible input we hide the native caret (inline
 * `caret-color: transparent`, only AFTER we've successfully measured a position —
 * so a measurement failure safely falls back to the native caret) and render a
 * `position: fixed` caret positioned in viewport space via the input's rect +
 * hidden-span text measurement. It springs WITHIN an input (glides along the text
 * line) but JUMPS when focus moves to a different input (no fly-across-the-page).
 *
 * Scope (by design): text/search/email/url/tel/password `<input>` only. textarea,
 * number/date/color/checkbox/radio/range/file and contenteditable keep the native
 * caret. Respects prefers-reduced-motion (snaps). Purely visual — never intercepts
 * typing, selection, or focus (pointer-events: none).
 */

import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const ELIGIBLE_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', '']);
const CARET_COLOR = '#783AFB'; // brand purple (design.md "primary accent")
const CARET_WIDTH = 2;
const CARET_Z = 2147483000; // above app modals/dropdowns; pointer-events:none so it never blocks

const PASSWORD_CHAR = typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent)
  ? '●'
  : '•';

function isEligibleInput(el: Element | EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.disabled) return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return ELIGIBLE_TYPES.has(type);
}

/** Caret index respecting a directional selection (matches native caret placement). */
function caretIndexOf(input: HTMLInputElement): number {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start === end) return start;
  return input.selectionDirection === 'backward' ? start : end;
}

const GlobalSmoothCaret = () => {
  const prefersReducedMotion = useReducedMotion();

  const caretX = useMotionValue(0);
  const caretY = useMotionValue(0);
  const caretH = useMotionValue(16);
  const caretOpacity = useMotionValue(0);

  const spring = prefersReducedMotion
    ? { stiffness: 10000, damping: 100, mass: 0.1 }
    : { stiffness: 500, damping: 30, mass: 0.5 };
  const springX = useSpring(caretX, spring);
  const springY = useSpring(caretY, spring);

  // Mutable state kept in refs (this component never re-renders after mount).
  const activeRef = useRef<HTMLInputElement | null>(null);
  const prevCaretColorRef = useRef<string>('');
  const nativeHiddenRef = useRef(false);
  const measureSpanRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // One offscreen measuring span for the whole app.
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;';
    document.body.appendChild(span);
    measureSpanRef.current = span;

    const measurePrefixWidth = (input: HTMLInputElement, text: string): number => {
      const styles = window.getComputedStyle(input);
      let fontSize = styles.fontSize;
      // Firefox/Safari render the bullet glyph larger than Chrome — nudge the
      // measuring font up so masked-character width stays aligned.
      if (
        PASSWORD_CHAR === '•'
        && input.type === 'password'
        && !/chrome|chromium|crios/i.test(navigator.userAgent)
      ) {
        fontSize = `${parseFloat(fontSize) + 6.25}px`;
      }
      span.style.font = `${styles.fontStyle} ${styles.fontWeight} ${fontSize} ${styles.fontFamily}`;
      span.style.letterSpacing = styles.letterSpacing;
      span.style.fontFeatureSettings = styles.fontFeatureSettings;
      span.style.fontVariationSettings = (styles as unknown as { fontVariationSettings?: string }).fontVariationSettings ?? '';
      span.textContent = text;
      return span.offsetWidth;
    };

    const hideNativeCaret = (input: HTMLInputElement) => {
      if (nativeHiddenRef.current) return;
      prevCaretColorRef.current = input.style.caretColor;
      input.style.caretColor = 'transparent';
      nativeHiddenRef.current = true;
    };
    const restoreNativeCaret = () => {
      const input = activeRef.current;
      if (input && nativeHiddenRef.current) {
        input.style.caretColor = prevCaretColorRef.current;
      }
      nativeHiddenRef.current = false;
    };

    /** Position the caret over `input`. `jump=true` snaps the springs (used when focus
     *  moves to a DIFFERENT input, so the caret doesn't glide across the whole page). */
    const applyPosition = (input: HTMLInputElement, jump: boolean) => {
      const styles = window.getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false; // hidden / detached

      const padL = parseFloat(styles.paddingLeft) || 0;
      const padR = parseFloat(styles.paddingRight) || 0;
      const bL = parseFloat(styles.borderLeftWidth) || 0;
      const bR = parseFloat(styles.borderRightWidth) || 0;
      const fontSize = parseFloat(styles.fontSize) || 16;

      const index = caretIndexOf(input);
      const isPw = input.type === 'password';
      const prefix = isPw ? PASSWORD_CHAR.repeat(index) : input.value.slice(0, index);
      const textWidth = measurePrefixWidth(input, prefix);

      const contentLeft = rect.left + bL + padL;
      const contentRight = rect.right - bR - padR;
      const rawX = contentLeft + textWidth - input.scrollLeft;

      const hasSelection = (input.selectionStart ?? 0) !== (input.selectionEnd ?? 0);
      const visible = !hasSelection && rawX >= contentLeft - 1 && rawX <= contentRight + 1;

      const clampedX = Math.max(contentLeft, Math.min(rawX, contentRight));
      const h = fontSize * 0.9;
      const y = rect.top + rect.height / 2 - h / 2;

      caretH.set(h);
      caretX.set(clampedX);
      caretY.set(y);
      if (jump) {
        springX.jump(clampedX);
        springY.jump(y);
      }
      caretOpacity.set(visible ? 1 : 0);
      return true;
    };

    const update = (jump = false) => {
      const input = activeRef.current;
      if (!input || document.activeElement !== input) return;
      try {
        if (applyPosition(input, jump)) hideNativeCaret(input); // hide native only once positioned
      } catch {
        // Any measurement failure → keep the native caret, hide our overlay.
        restoreNativeCaret();
        caretOpacity.set(0);
      }
    };

    const scheduleUpdate = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        update(false);
      });
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);

    const setActive = (input: HTMLInputElement) => {
      if (activeRef.current === input) return;
      // Restore the previous input's native caret + stop observing it.
      if (activeRef.current) {
        restoreNativeCaret();
        resizeObserver.unobserve(activeRef.current);
      }
      activeRef.current = input;
      resizeObserver.observe(input);
      update(true); // jump the springs to the new input (no cross-page glide)
    };

    const clearActive = () => {
      restoreNativeCaret();
      if (activeRef.current) resizeObserver.unobserve(activeRef.current);
      activeRef.current = null;
      caretOpacity.set(0);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isEligibleInput(e.target)) setActive(e.target);
      else clearActive();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.target === activeRef.current) clearActive();
    };
    const onInput = (e: Event) => { if (e.target === activeRef.current) scheduleUpdate(); };
    const onSelectionChange = () => { if (activeRef.current) scheduleUpdate(); };
    const onScrollOrResize = () => { if (activeRef.current) scheduleUpdate(); };
    const onFontsDone = () => { if (activeRef.current) scheduleUpdate(); };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onInput, true);
    document.addEventListener('selectionchange', onSelectionChange);
    // capture: true catches scrolling of any ancestor (modals, scroll panes) + the input itself.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.fonts?.addEventListener?.('loadingdone', onFontsDone);

    // If an input is already focused when we mount (e.g. autoFocus), pick it up.
    if (isEligibleInput(document.activeElement)) setActive(document.activeElement as HTMLInputElement);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.fonts?.removeEventListener?.('loadingdone', onFontsDone);
      resizeObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      restoreNativeCaret();
      span.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: CARET_WIDTH,
        height: caretH,
        borderRadius: 1,
        background: CARET_COLOR,
        x: springX,
        y: springY,
        opacity: caretOpacity,
        pointerEvents: 'none',
        zIndex: CARET_Z,
        willChange: 'transform, opacity',
      }}
    />
  );
};

export default GlobalSmoothCaret;
