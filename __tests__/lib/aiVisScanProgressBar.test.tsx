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

   it('survives the transition to finished without throwing on audio', () => {
      const done = status({
         status: 'completed', progressDone: 50, sourcesPending: false, profilesPending: false, profilesBuilt: 3,
      });
      const { rerender } = render(<ScanProgressBar visible scan={status()} />);
      expect(() => rerender(<ScanProgressBar visible scan={done} />)).not.toThrow();
   });
});
