/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import AutoOptimizeProgressBar, { optimizeSteps } from '../../components/articles/AutoOptimizeProgressBar';

const base = {
  state: 'optimizing' as const,
  processed: 0,
  total: 0,
  status: 'Optimizing article…',
  remaining: 0,
  changedCount: 0,
  saving: false,
  onCancel: () => undefined,
  onSave: () => undefined,
};

const states = (over: Partial<typeof base>) => optimizeSteps({ ...base, ...over }).map((s) => s.state);

/** Phases follow the stream: meta closes enrichment, progress rounds rewrite, done opens review. */
it('walks enrichment → rewriting → review off the stream', () => {
  expect(states({})).toEqual(['active', 'idle', 'idle']);
  expect(states({ total: 4, processed: 1 })).toEqual(['done', 'active', 'idle']);
  expect(states({ state: 'reviewing', total: 4, processed: 4, remaining: 2, changedCount: 3 })).toEqual(['done', 'done', 'active']);
});

it('shows the round and the live scores while rewriting, the sections left while reviewing', () => {
  expect(optimizeSteps({ ...base, total: 4, processed: 2, status: 'Round 3 — SEO 82 · AI 61' })[1].detail)
    .toBe('2 / 4 rounds · Round 3 — SEO 82 · AI 61');
  expect(optimizeSteps({ ...base, state: 'reviewing', remaining: 2, changedCount: 3 })[2].detail)
    .toBe('2 of 3 sections left');
});

it('offers Cancel while running and Cancel + Save while reviewing', () => {
  const onSave = jest.fn();
  const { rerender } = render(<AutoOptimizeProgressBar {...base} total={4} processed={1} />);
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Cancel']));
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

  rerender(<AutoOptimizeProgressBar {...base} state="reviewing" remaining={1} changedCount={2} onSave={onSave} />);
  screen.getByRole('button', { name: 'Save' }).click();
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Review changes · 1 of 2 sections left');
});

it('disables Save while saving', () => {
  render(<AutoOptimizeProgressBar {...base} state="reviewing" remaining={1} changedCount={2} saving />);
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
});
