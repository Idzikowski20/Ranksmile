/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ suggestions: [{ keyword: 'local seo tips', volume: 1200, competitionIndex: 20 }], hasVolumeData: true }),
  }) as unknown as typeof fetch;
});
afterEach(() => { jest.useRealTimers(); });

it('shows suggestions outside a clipping ancestor and adds the clicked one', async () => {
  const onAdd = jest.fn();
  render(
    <div data-testid="scroller" style={{ overflow: 'auto', height: 60 }}>
      <KeywordSuggestInput keywords={[]} onAdd={onAdd} onRemove={jest.fn()} />
    </div>,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'local seo' } });
  await act(async () => { jest.advanceTimersByTime(400); });
  const option = await screen.findByText('local seo tips');
  const list = screen.getByRole('listbox');
  expect(screen.getByTestId('scroller').contains(list)).toBe(false);
  expect(list.style.position).toBe('fixed');
  fireEvent.mouseDown(option);
  expect(onAdd).toHaveBeenCalledWith('local seo tips');
});
