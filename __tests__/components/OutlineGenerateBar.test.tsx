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
  // The review state wraps its two controls in a row, so the pill is the button, not the
  // outer element — the other two states have no second control and stay unwrapped.
  const idleShape = shapeOf(idle.querySelector('button') as HTMLElement);

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

/**
 * One re-plan per article: a second one is a second LLM bill, and the reviewer can edit
 * the outline in place instead. The spent state is greyed rather than removed so the
 * limit is visible, not mysterious.
 */
describe('regenerate', () => {
  it('offers regeneration as an icon-only control beside the pill', () => {
    render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onRegenerate={noop} />);

    const regenerate = screen.getByRole('button', { name: 'Regenerate outline' });
    expect(regenerate).toBeEnabled();
    expect(regenerate).toHaveTextContent('');
  });

  it('has no regenerate control where the caller offers none', () => {
    render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} />);
    expect(screen.queryByRole('button', { name: 'Regenerate outline' })).toBeNull();
  });

  it('greys out regeneration once it has been used, and says why', () => {
    render(
      <OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onRegenerate={noop} regenerateUsed />,
    );

    const regenerate = screen.getByRole('button', { name: 'Regenerate outline' });
    expect(regenerate).toBeDisabled();
    expect(regenerate).toHaveAttribute('title', 'An outline can be regenerated once — this one already has been');
    // The primary action stays available: a spent regeneration is not a blocked article.
    expect(screen.getByRole('button', { name: /Generate content/ })).toBeEnabled();
  });
});

/**
 * The pill's `gap` needs a flex context, which used to come from the shell it spread.
 * Once the review state moved into a row with the regenerate button it stopped spreading
 * that shell, the button fell back to inline-block, and the icon wrapped onto its own
 * line above the label.
 */
it('lays the icon and its label out on one line', () => {
  render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onRegenerate={noop} />);

  const pill = screen.getByRole('button', { name: /Generate content/ });
  expect(pill.style.display).toBe('inline-flex');
  expect(pill.style.whiteSpace).toBe('nowrap');
  // Shrinking is the other way the label breaks: as a flex item it would give way first.
  expect(pill.style.flexShrink).toBe('0');
});

it('explains why it is disabled instead of just going dead', () => {
  render(<OutlineGenerateBar busy={false} headingCount={0} onGenerate={noop} />);

  expect(screen.getByRole('button', { name: /Generate content/ }))
    .toHaveAttribute('title', 'Add at least one heading to the outline first');
});
