/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useAnchoredPosition } from '../../components/koala/core/useAnchoredPosition';

// Stable refs, as a component's useRef would give — one per anchor position.
const anchorAt = (top: number, bottom: number): RefObject<HTMLElement> => ({
  current: { getBoundingClientRect: () => ({ top, bottom, left: 40, width: 300 }) } as unknown as HTMLElement,
});
const low = anchorAt(520, 560);
const high = anchorAt(60, 100);

beforeAll(() => { Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true }); });

it('opens below the anchor when the menu fits', () => {
  const { result } = renderHook(() => useAnchoredPosition(low, true, 90));
  expect(result.current).toEqual({ left: 40, width: 300, top: 564 });
});

it('flips above when the menu does not fit below but there is more room above', () => {
  const { result } = renderHook(() => useAnchoredPosition(low, true, 300));
  expect(result.current).toEqual({ left: 40, width: 300, bottom: 284 });
});

it('stays below when there is even less room above', () => {
  const { result } = renderHook(() => useAnchoredPosition(high, true, 900));
  expect(result.current).toMatchObject({ top: 104 });
});

it('is null while closed', () => {
  const { result } = renderHook(() => useAnchoredPosition(low, false));
  expect(result.current).toBeNull();
});

it('keeps the same position object when a scroll does not move the anchor', () => {
  const { result } = renderHook(() => useAnchoredPosition(low, true, 90));
  const first = result.current;
  window.dispatchEvent(new Event('scroll'));
  expect(result.current).toBe(first);
});
