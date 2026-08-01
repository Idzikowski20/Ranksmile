'use client';

/**
 * GlobalSmoothCaret — a single overlay, mounted once in _app, that gives EVERY
 * eligible text field a spring-animated caret (à la Skiper106) while leaving each
 * field's own markup/styling untouched.
 *
 * How it works: on focus of an eligible field we hide the native caret (inline
 * `caret-color: transparent`, only AFTER we've successfully measured a position —
 * so a measurement failure safely falls back to the native caret) and render a
 * `position: fixed` caret positioned in viewport space. Single-line `<input>` uses
 * a hidden-span width measurement; `<textarea>` uses a mirror-div that replicates
 * line wrapping to locate the caret's (x, y) even across wrapped lines + scroll.
 * The caret springs WITHIN a field (glides), and JUMPS when focus moves to another
 * field (no fly-across-the-page).
 *
 * Scope: `<input>` of a selection-capable type (text/search/tel/password) and any
 * `<textarea>`. email/url/number/date/… inputs return null for selectionStart, so
 * they keep the native caret; contenteditable (the editor) also keeps native.
 * Respects prefers-reduced-motion (snaps). Purely visual — never intercepts typing,
 * selection, or focus (pointer-events: none).
 */

import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

type CaretField = HTMLInputElement | HTMLTextAreaElement;

// ONLY <input> types that support the text-selection API (selectionStart/End). email, number,
// date, … return `null` for selectionStart, so the caret position can't be tracked there.
// text/search/url/tel/password DO support it (per the HTML spec); <textarea> is handled via
// the mirror-div path. A runtime `selectionStart === null` guard backs this up defensively.
const ELIGIBLE_TYPES = new Set(['text', 'search', 'url', 'tel', 'password', '']);
const CARET_COLOR = '#F84416'; // brand purple (design.md "primary accent")
const CARET_WIDTH = 2;
const CARET_Z = 2147483000; // above app modals/dropdowns; pointer-events:none so it never blocks

// CSS properties the mirror div must copy so its line wrapping matches the textarea EXACTLY.
// font-variation-settings / font-feature-settings are essential for variable fonts (InterVariable):
// without them the mirror renders glyphs at a slightly different width and wraps at a different
// point, drifting the caret at borderline line lengths.
const MIRROR_PROPS = [
  'font-style', 'font-variant', 'font-weight', 'font-stretch', 'font-size', 'line-height',
  'font-family', 'font-variation-settings', 'font-feature-settings', 'font-kerning',
  'letter-spacing', 'word-spacing', 'text-indent', 'text-transform', 'text-align',
  'text-rendering', 'tab-size', 'word-break',
  // Copy the exact wrapping behaviour from the real field (do NOT hardcode) so the mirror
  // breaks lines identically — the textarea may compute a different white-space/overflow-wrap.
  'white-space', 'overflow-wrap', 'word-wrap',
];

const PASSWORD_CHAR = typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent)
  ? '●'
  : '•';

export function isEligibleField(el: Element | EventTarget | null): el is CaretField {
  if (el instanceof HTMLTextAreaElement) return !el.disabled;
  if (el instanceof HTMLInputElement) {
    if (el.disabled) return false;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return ELIGIBLE_TYPES.has(type);
  }
  return false;
}

/** Caret index respecting a directional selection (matches native caret placement). */
function caretIndexOf(field: CaretField): number {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? 0;
  if (start === end) return start;
  return field.selectionDirection === 'backward' ? start : end;
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
  const activeRef = useRef<CaretField | null>(null);
  const prevCaretColorRef = useRef<string>('');
  const nativeHiddenRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null); // the blinking bar (inner layer)

  useEffect(() => {
    // One offscreen span (single-line width) + one mirror div (textarea wrapping) for the app.
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;';
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    // white-space / overflow-wrap / word-wrap are copied per-field from computed style (MIRROR_PROPS),
    // not hardcoded, so the mirror wraps exactly like the target textarea.
    mirror.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;overflow:hidden;'
      + 'box-sizing:content-box;padding:0;border:0;margin:0;';
    const marker = document.createElement('span');
    document.body.appendChild(span);
    document.body.appendChild(mirror);

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

    /** Caret (x, y) within a textarea's CONTENT box, via a wrapping-accurate mirror div. */
    const textareaCaretOffset = (el: HTMLTextAreaElement, index: number) => {
      const cs = window.getComputedStyle(el);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      // clientWidth excludes border + scrollbar → exact content width for identical wrapping.
      mirror.style.width = `${Math.max(0, el.clientWidth - padL - padR)}px`;
      MIRROR_PROPS.forEach((p) => mirror.style.setProperty(p, cs.getPropertyValue(p)));
      mirror.textContent = el.value.slice(0, index);
      marker.textContent = el.value.slice(index) || '.';
      mirror.appendChild(marker);
      const left = marker.offsetLeft;
      const top = marker.offsetTop;
      let lineHeight = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lineHeight)) lineHeight = (parseFloat(cs.fontSize) || 16) * 1.2;
      return { left, top, lineHeight };
    };

    const hideNativeCaret = (field: CaretField) => {
      if (nativeHiddenRef.current) return;
      prevCaretColorRef.current = field.style.caretColor;
      field.style.caretColor = 'transparent';
      nativeHiddenRef.current = true;
    };
    const restoreNativeCaret = () => {
      const field = activeRef.current;
      if (field && nativeHiddenRef.current) {
        field.style.caretColor = prevCaretColorRef.current;
      }
      nativeHiddenRef.current = false;
    };

    /** Position the caret over `field`. `jump=true` snaps the springs (used when focus
     *  moves to a DIFFERENT field, so the caret doesn't glide across the whole page). */
    const applyPosition = (field: CaretField, jump: boolean) => {
      const styles = window.getComputedStyle(field);
      const rect = field.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false; // hidden / detached
      // Defense-in-depth: a field that doesn't expose the selection API keeps its native caret.
      if (field.selectionStart === null) return false;

      const padL = parseFloat(styles.paddingLeft) || 0;
      const padR = parseFloat(styles.paddingRight) || 0;
      const padT = parseFloat(styles.paddingTop) || 0;
      const padB = parseFloat(styles.paddingBottom) || 0;
      const bL = parseFloat(styles.borderLeftWidth) || 0;
      const bR = parseFloat(styles.borderRightWidth) || 0;
      const bT = parseFloat(styles.borderTopWidth) || 0;
      const bB = parseFloat(styles.borderBottomWidth) || 0;
      const fontSize = parseFloat(styles.fontSize) || 16;

      const index = caretIndexOf(field);
      const hasSelection = (field.selectionStart ?? 0) !== (field.selectionEnd ?? 0);

      if (field instanceof HTMLTextAreaElement) {
        const { left, top, lineHeight } = textareaCaretOffset(field, index);
        const caretVpX = rect.left + bL + padL + left - field.scrollLeft;
        const lineTop = rect.top + bT + padT + top - field.scrollTop;
        const h = Math.min(lineHeight, fontSize * 1.15);
        const y = lineTop + (lineHeight - h) / 2;

        const visL = rect.left + bL + padL;
        const visR = rect.right - bR - padR;
        const visT = rect.top + bT + padT;
        const visB = rect.bottom - bB - padB;
        const visible = !hasSelection
          && caretVpX >= visL - 1 && caretVpX <= visR + 1
          && lineTop >= visT - 1 && lineTop + lineHeight <= visB + 1;

        caretH.set(h);
        caretX.set(caretVpX);
        caretY.set(y);
        if (jump) { springX.jump(caretVpX); springY.jump(y); }
        caretOpacity.set(visible ? 1 : 0);
        return true;
      }

      // Single-line <input>.
      const isPw = field.type === 'password';
      const prefix = isPw ? PASSWORD_CHAR.repeat(index) : field.value.slice(0, index);
      const textWidth = measurePrefixWidth(field, prefix);

      const contentLeft = rect.left + bL + padL;
      const contentRight = rect.right - bR - padR;
      const rawX = contentLeft + textWidth - field.scrollLeft;
      const visible = !hasSelection && rawX >= contentLeft - 1 && rawX <= contentRight + 1;
      const clampedX = Math.max(contentLeft, Math.min(rawX, contentRight));
      const h = fontSize * 0.9;
      const y = rect.top + rect.height / 2 - h / 2;

      caretH.set(h);
      caretX.set(clampedX);
      caretY.set(y);
      if (jump) { springX.jump(clampedX); springY.jump(y); }
      caretOpacity.set(visible ? 1 : 0);
      return true;
    };

    const update = (jump = false) => {
      const field = activeRef.current;
      if (!field || document.activeElement !== field) return;
      try {
        if (applyPosition(field, jump)) {
          hideNativeCaret(field); // hide native only once positioned
        } else {
          // Not positionable (hidden, or no selection API) → keep the native caret, hide overlay.
          restoreNativeCaret();
          caretOpacity.set(0);
        }
      } catch {
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

    // Restart the blink so the caret is SOLID while it moves (typing/click/focus),
    // then resumes blinking when idle — matching native caret behaviour.
    const resetBlink = () => {
      const bar = barRef.current;
      if (!bar) return;
      bar.style.animation = 'none';
      void bar.offsetWidth; // force reflow to restart the CSS animation
      bar.style.animation = '';
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);

    const setActive = (field: CaretField) => {
      if (activeRef.current === field) return;
      // Restore the previous field's native caret + stop observing it.
      if (activeRef.current) {
        restoreNativeCaret();
        resizeObserver.unobserve(activeRef.current);
      }
      activeRef.current = field;
      resizeObserver.observe(field);
      update(true); // jump the springs to the new field (no cross-page glide)
      resetBlink();
    };

    const clearActive = () => {
      restoreNativeCaret();
      if (activeRef.current) resizeObserver.unobserve(activeRef.current);
      activeRef.current = null;
      caretOpacity.set(0);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isEligibleField(e.target)) setActive(e.target);
      else clearActive();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.target === activeRef.current) clearActive();
    };
    const onInput = (e: Event) => { if (e.target === activeRef.current) { resetBlink(); scheduleUpdate(); } };
    const onSelectionChange = () => { if (activeRef.current) { resetBlink(); scheduleUpdate(); } };
    const onScrollOrResize = () => { if (activeRef.current) scheduleUpdate(); };
    const onFontsDone = () => { if (activeRef.current) scheduleUpdate(); };
    // A modal/dropdown open animation (e.g. `growOut` scale) or transition moves the
    // field AFTER focusin measured the caret. CSS transforms don't resize the layout
    // box, so ResizeObserver never fires — re-measure when the field (or an ancestor
    // that just animated/transitioned) settles. This is the fix for the caret landing
    // below the search input inside animated dropdowns until the first click.
    const onAncestorSettle = (e: Event) => {
      const field = activeRef.current;
      const target = e.target;
      if (field && target instanceof Node && (target === field || target.contains(field))) scheduleUpdate();
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('input', onInput, true);
    document.addEventListener('selectionchange', onSelectionChange);
    // capture: true catches scrolling of any ancestor (modals, scroll panes) + the field itself.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    // capture: true — animationend/transitionend don't bubble reliably from all ancestors.
    document.addEventListener('animationend', onAncestorSettle, true);
    document.addEventListener('transitionend', onAncestorSettle, true);
    document.fonts?.addEventListener?.('loadingdone', onFontsDone);

    // If a field is already focused when we mount (e.g. autoFocus), pick it up.
    if (isEligibleField(document.activeElement)) setActive(document.activeElement as CaretField);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('animationend', onAncestorSettle, true);
      document.removeEventListener('transitionend', onAncestorSettle, true);
      document.fonts?.removeEventListener?.('loadingdone', onFontsDone);
      resizeObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      restoreNativeCaret();
      span.remove();
      mirror.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Blink keyframes + class — the inner bar's opacity, independent of show/hide (outer
          opacity). Defined as a CLASS (not inline) so resetBlink can clear the inline
          `animation:none` and fall back to a live animation that restarts from the top. */}
      <style>{'@keyframes smoothCaretBlink{0%,100%{opacity:1}50%{opacity:0}}.smooth-caret-bar{animation:smoothCaretBlink 1.1s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.smooth-caret-bar{animation:none}}'}</style>
      {/* Outer: position (spring x/y) + show/hide (caretOpacity 0|1). */}
      <motion.div
        className="global-smooth-caret"
        aria-hidden
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: CARET_WIDTH,
          height: caretH,
          x: springX,
          y: springY,
          opacity: caretOpacity,
          pointerEvents: 'none',
          zIndex: CARET_Z,
          willChange: 'transform, opacity',
        }}
      >
        {/* Inner: the visible bar that blinks (animation via the .smooth-caret-bar class so
            resetBlink can restart it; reset to solid while moving via resetBlink). */}
        <div
          ref={barRef}
          className="smooth-caret-bar"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 1,
            background: CARET_COLOR,
          }}
        />
      </motion.div>
    </>
  );
};

export default GlobalSmoothCaret;
