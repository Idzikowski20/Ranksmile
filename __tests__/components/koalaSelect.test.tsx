/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { Select } from '../../components/koala/core/select/select';

const OPTIONS = [{ value: 'draft', label: 'Draft' }, { value: 'live', label: 'Live' }];

function renderInScroller(onChange = jest.fn()) {
  const utils = render(
    <div data-testid="scroller" style={{ overflow: 'auto', height: 40 }}>
      <Select options={OPTIONS} value="draft" onChange={onChange} />
    </div>,
  );
  return { ...utils, onChange, trigger: screen.getByRole('button', { name: 'Draft' }) };
}

it('renders the open menu outside a clipping (overflow) ancestor, e.g. a modal body', () => {
  const { trigger } = renderInScroller();
  fireEvent.click(trigger);
  const option = screen.getByRole('button', { name: 'Live' });
  expect(screen.getByTestId('scroller').contains(option)).toBe(false);
  expect(document.body.contains(option)).toBe(true);
  // Fixed-positioned against the trigger, above modal overlays.
  const menu = option.closest('[data-koala-select-menu]') as HTMLElement;
  expect(menu).not.toBeNull();
  expect(getComputedStyle(menu).position).toBe('fixed');
});

it('selects an option from the portalled menu and closes it', () => {
  const { trigger, onChange } = renderInScroller();
  fireEvent.click(trigger);
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Live' }));
  fireEvent.click(screen.getByRole('button', { name: 'Live' }));
  expect(onChange).toHaveBeenCalledWith('live');
  expect(screen.queryByRole('button', { name: 'Live' })).toBeNull();
});

it('closes on an outside click', () => {
  const { trigger } = renderInScroller();
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Live' })).toBeInTheDocument();
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('button', { name: 'Live' })).toBeNull();
});
