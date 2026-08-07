import { render, screen } from '@testing-library/react';
import OutlineGenerateBar from '../../components/articles/OutlineGenerateBar';

jest.mock('../../lib/motion/useEntrance', () => ({ useEntrance: () => null }));

const noop = () => undefined;

it('offers Generate content as the only button while the outline is under review', () => {
  render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});

it('disables Generate content until the outline has a heading', () => {
  render(<OutlineGenerateBar busy={false} headingCount={0} onGenerate={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeDisabled();
});

// The planning and writing states are progress-only by design: there is nothing to
// review or approve yet. Cancelling a running generation is therefore not reachable
// from this bar — see cancelGenerationJob if that capability is wanted back.
it('shows a progress pill with no controls while planning the outline', () => {
  render(<OutlineGenerateBar planning busy={false} headingCount={0} onGenerate={noop} />);
  expect(screen.getByText('Generating outline')).toBeInTheDocument();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('shows a progress pill with no controls while writing', () => {
  render(<OutlineGenerateBar busy headingCount={3} progressPct={42} onGenerate={noop} />);
  expect(screen.getByText('Generating content 42%')).toBeInTheDocument();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

/**
 * All three states are one pill that changes its label. The review state used to be a
 * wide bar restating "Outline / Review outline / N headings ready" — the outline being
 * described is on screen already — so the control changed shape on every transition.
 */
it('is the same pill in every state, not a wider bar while reviewing', () => {
  const { container: idle } = render(<OutlineGenerateBar busy={false} headingCount={12} onGenerate={noop} />);
  const { container: planning } = render(<OutlineGenerateBar planning busy={false} headingCount={0} onGenerate={noop} />);
  const { container: writing } = render(<OutlineGenerateBar busy headingCount={12} onGenerate={noop} />);

  const shapeOf = (el: HTMLElement) => {
    const { height, borderRadius, width } = el.style;
    return { height, borderRadius, width };
  };
  const idleShape = shapeOf(idle.firstElementChild as HTMLElement);

  expect(idleShape).toEqual({ height: '44px', borderRadius: '999px', width: '' });
  expect(shapeOf(planning.firstElementChild as HTMLElement)).toEqual(idleShape);
  expect(shapeOf(writing.firstElementChild as HTMLElement)).toEqual(idleShape);
});

it('says nothing but its own action while reviewing', () => {
  render(<OutlineGenerateBar busy={false} headingCount={12} onGenerate={noop} />);

  expect(screen.queryByText('Review outline')).toBeNull();
  expect(screen.queryByText(/headings ready/)).toBeNull();
  expect(screen.getByRole('button')).toHaveTextContent('Generate content');
});

it('explains why it is disabled instead of just going dead', () => {
  render(<OutlineGenerateBar busy={false} headingCount={0} onGenerate={noop} />);

  expect(screen.getByRole('button', { name: /Generate content/ }))
    .toHaveAttribute('title', 'Add at least one heading to the outline first');
});
