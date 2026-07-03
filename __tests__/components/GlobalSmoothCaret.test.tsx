/** @jest-environment jsdom */
// Guards the smooth-caret eligibility: only input types that support the text
// selection API (selectionStart) may get the animated caret. email/url/number/…
// return null for selectionStart, so the caret can't track the cursor there —
// they must be excluded (root cause of "caret works on password but not email").

// motion/react is only needed by the component render, not by the pure predicate.
jest.mock('motion/react', () => ({
  motion: { div: 'div' },
  useMotionValue: () => ({ set: jest.fn(), jump: jest.fn(), get: () => 0 }),
  useSpring: () => ({ set: jest.fn(), jump: jest.fn(), get: () => 0 }),
  useReducedMotion: () => false,
}));

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import GlobalSmoothCaret, { isEligibleField } from '../../components/common/GlobalSmoothCaret';

const inputOfType = (type?: string, disabled = false): HTMLInputElement => {
  const el = document.createElement('input');
  if (type !== undefined) el.setAttribute('type', type);
  el.disabled = disabled;
  return el;
};

describe('GlobalSmoothCaret · isEligibleField', () => {
  it('accepts single-line <input> types that support the selection API', () => {
    for (const t of ['text', 'search', 'url', 'tel', 'password']) {
      expect(isEligibleField(inputOfType(t))).toBe(true);
    }
    expect(isEligibleField(inputOfType(undefined))).toBe(true); // no type → defaults to text
  });

  it('accepts <textarea> (handled via the mirror-div path)', () => {
    expect(isEligibleField(document.createElement('textarea'))).toBe(true);
    const disabled = document.createElement('textarea');
    disabled.disabled = true;
    expect(isEligibleField(disabled)).toBe(false);
  });

  it('rejects <input> types whose selectionStart is null (email/number/date/…)', () => {
    for (const t of ['email', 'number', 'date', 'datetime-local', 'month', 'time', 'week', 'color']) {
      expect(isEligibleField(inputOfType(t))).toBe(false);
    }
  });

  it('rejects non-text control types', () => {
    for (const t of ['checkbox', 'radio', 'range', 'file', 'button', 'submit']) {
      expect(isEligibleField(inputOfType(t))).toBe(false);
    }
  });

  it('rejects disabled inputs and non-field elements', () => {
    expect(isEligibleField(inputOfType('text', true))).toBe(false);
    expect(isEligibleField(document.createElement('div'))).toBe(false);
    expect(isEligibleField(null)).toBe(false);
  });
});

describe('GlobalSmoothCaret · re-measures after an open animation settles', () => {
  let rafCbs: FrameRequestCallback[] = [];
  const flushRaf = () => { const cbs = rafCbs; rafCbs = []; cbs.forEach((cb) => cb(0)); };

  beforeEach(() => {
    rafCbs = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { rafCbs.push(cb); return 1; });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    // jsdom lacks ResizeObserver, which the component instantiates on mount.
    (global as unknown as { ResizeObserver: unknown }).ResizeObserver = jest.fn(() => ({
      observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
    }));
  });
  afterEach(() => { cleanup(); jest.restoreAllMocks(); });

  it('re-positions the caret when an ancestor animation finishes (growOut in a dropdown)', () => {
    render(<GlobalSmoothCaret />);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'hello';
    document.body.appendChild(input);
    Object.defineProperty(input, 'selectionStart', { value: 5, configurable: true });
    Object.defineProperty(input, 'selectionEnd', { value: 5, configurable: true });
    const rect = { left: 10, top: 100, right: 200, bottom: 130, width: 190, height: 30, x: 10, y: 100, toJSON: () => ({}) };
    const gbcr = jest.spyOn(input, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    input.focus(); // focusin → setActive → measures the (mid-animation) rect once
    flushRaf();
    const afterFocus = gbcr.mock.calls.length;
    expect(afterFocus).toBeGreaterThan(0);

    // The dropdown's growOut transform finishes AFTER focus measured the caret. A
    // transform doesn't fire ResizeObserver, so only an animationend listener re-measures.
    input.dispatchEvent(new Event('animationend', { bubbles: true }));
    flushRaf();
    expect(gbcr.mock.calls.length).toBeGreaterThan(afterFocus);
  });
});
