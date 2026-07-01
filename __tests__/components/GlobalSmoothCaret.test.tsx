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

import { isEligibleInput } from '../../components/common/GlobalSmoothCaret';

const inputOfType = (type?: string, disabled = false): HTMLInputElement => {
  const el = document.createElement('input');
  if (type !== undefined) el.setAttribute('type', type);
  el.disabled = disabled;
  return el;
};

describe('GlobalSmoothCaret · isEligibleInput', () => {
  it('accepts single-line types that support the selection API', () => {
    for (const t of ['text', 'search', 'tel', 'password']) {
      expect(isEligibleInput(inputOfType(t))).toBe(true);
    }
    expect(isEligibleInput(inputOfType(undefined))).toBe(true); // no type → defaults to text
  });

  it('rejects types whose selectionStart is null (email/url/number/date/…)', () => {
    for (const t of ['email', 'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week', 'color']) {
      expect(isEligibleInput(inputOfType(t))).toBe(false);
    }
  });

  it('rejects non-text control types', () => {
    for (const t of ['checkbox', 'radio', 'range', 'file', 'button', 'submit']) {
      expect(isEligibleInput(inputOfType(t))).toBe(false);
    }
  });

  it('rejects disabled inputs and non-input elements', () => {
    expect(isEligibleInput(inputOfType('text', true))).toBe(false);
    expect(isEligibleInput(document.createElement('textarea'))).toBe(false);
    expect(isEligibleInput(document.createElement('div'))).toBe(false);
    expect(isEligibleInput(null)).toBe(false);
  });
});
