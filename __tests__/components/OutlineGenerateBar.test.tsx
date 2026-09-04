import { render, screen } from '@testing-library/react';
import OutlineGenerateBar from '../../components/articles/OutlineGenerateBar';

jest.mock('@/components/motion/useEntrance', () => ({ useEntrance: () => null }));

const noop = () => undefined;

it('offers Generate content as the only button while the outline is under review', () => {
  render(<OutlineGenerateBar headingCount={3} onGenerate={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});

it('disables Generate content until the outline has a heading', () => {
  render(<OutlineGenerateBar headingCount={0} onGenerate={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeDisabled();
});

/**
 * The review state used to be a wide bar restating "Outline / Review outline / N headings
 * ready" — the outline being described is on screen already.
 */
it('is a pill that says nothing but its own action', () => {
  const { container } = render(<OutlineGenerateBar headingCount={12} onGenerate={noop} />);

  const { height, borderRadius } = (container.firstElementChild as HTMLElement).style;
  expect({ height, borderRadius }).toEqual({ height: '44px', borderRadius: '999px' });
  expect(screen.queryByText('Review outline')).toBeNull();
  expect(screen.queryByText(/headings ready/)).toBeNull();
  expect(screen.getByRole('button')).toHaveTextContent('Generate content');
});

it('explains why it is disabled instead of just going dead', () => {
  render(<OutlineGenerateBar headingCount={0} onGenerate={noop} />);

  expect(screen.getByRole('button', { name: /Generate content/ }))
    .toHaveAttribute('title', 'Add at least one heading to the outline first');
});
