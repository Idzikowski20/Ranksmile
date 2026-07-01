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

import { isEligibleField } from '../../components/common/GlobalSmoothCaret';

const inputOfType = (type?: string, disabled = false): HTMLInputElement => {
  const el = document.createElement('input');
  if (type !== undefined) el.setAttribute('type', type);
  el.disabled = disabled;
  return el;
};

describe('GlobalSmoothCaret · isEligibleField', () => {
  it('accepts single-line <input> types that support the selection API', () => {
    for (const t of ['text', 'search', 'tel', 'password']) {
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

  it('rejects <input> types whose selectionStart is null (email/url/number/date/…)', () => {
    for (const t of ['email', 'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week', 'color']) {
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
