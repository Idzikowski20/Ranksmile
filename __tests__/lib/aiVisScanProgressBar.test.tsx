/** @jest-environment jsdom */
/**
 * The pill's two behaviours that are easy to break: the pin keeps the timeline open when
 * the pointer leaves, and finishing a scan must not throw inside an effect — jsdom's
 * play() returns undefined, which is exactly what a naive .catch() chokes on.
 */
import { render, fireEvent } from '@testing-library/react';
import ScanProgressBar from '@/components/aiVisibility/ScanProgressBar';
import type { AiVisScanStatus } from '@/services/aiVisibility';

const status = (over: Partial<AiVisScanStatus> = {}): AiVisScanStatus => ({
   status: 'running',
   progressDone: 10,
   progressTotal: 50,
   costUsd: 0,
   finishedAt: null,
   sourcesTotal: 0,
   sourcesRead: 0,
   brandsPending: 0,
   profilesBuilt: 0,
   sourcesPending: true,
   profilesPending: true,
   models: ['chat_gpt', 'gemini'],
   recentSourceDomains: [],
   ...over,
});

describe('ScanProgressBar', () => {
   it('keeps the timeline open after the pointer leaves, once pinned', () => {
      const { getByRole } = render(<ScanProgressBar visible scan={status()} />);
      const pill = getByRole('button');
      expect(pill.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(pill);
      expect(pill.getAttribute('aria-pressed')).toBe('true');
      fireEvent.mouseLeave(pill.parentElement as HTMLElement);
      expect(pill.getAttribute('aria-expanded')).toBe('true'); // pinned beats hover

      fireEvent.click(pill);
      expect(pill.getAttribute('aria-expanded')).toBe('false');
   });

   it('shows an engine icon per model while the answers are still coming', () => {
      const { container } = render(<ScanProgressBar visible scan={status()} />);
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1);
   });


   it('shows one favicon — the page it is on, not a trail of everything read', () => {
      const { container } = render(<ScanProgressBar visible scan={status({
         progressDone: 50,
         sourcesTotal: 176,
         sourcesRead: 48,
         recentSourceDomains: ['a.pl', 'b.pl', 'c.pl'],
      })} />);
      // span[title], not [title]: the pill itself is a <button title="Pin the phase timeline open">.
      const marks = container.querySelectorAll('span[title]');
      expect(Array.from(marks).map((m) => m.getAttribute('title'))).toEqual(['a.pl']);
   });

   it('does not gate a finished phase behind an unfinished earlier one', () => {
      // The sidecar drains all three phases every tick, so brands and profiles can finish
      // while page fetching is still going. Chaining them showed both as untouched.
      const { getByText } = render(<ScanProgressBar visible scan={status({
         progressDone: 50,
         sourcesDone: false,
         sourcesPending: true,
         brandsPending: 0,
         profilesDone: true,
         profilesBuilt: 120,
      })} />);
      expect(getByText('120 brands')).toBeTruthy();
   });

   it('survives the transition to finished without throwing on audio', () => {
      const done = status({
         status: 'completed', progressDone: 50, sourcesPending: false, profilesPending: false, profilesBuilt: 3,
      });
      const { rerender } = render(<ScanProgressBar visible scan={status()} />);
      expect(() => rerender(<ScanProgressBar visible scan={done} />)).not.toThrow();
   });
});
