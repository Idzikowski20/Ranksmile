import { fireEvent, render, screen } from '@testing-library/react';
import OutlineGenerateBar from '../../components/articles/OutlineGenerateBar';

jest.mock('../../lib/motion/useEntrance', () => ({ useEntrance: () => null }));

const noop = () => undefined;

it('offers Generate content as the only button while the outline is under review', () => {
  render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onCancel={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});

/**
 * Discarding the review aborts the in-flight request and restores the article the
 * reviewer started from — nothing else undoes that, so losing the Cancel button must
 * not lose the capability.
 */
it('still discards the review on Escape', () => {
  const onCancel = jest.fn();
  render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onCancel={onCancel} />);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('does not discard on Escape while a generation is already running', () => {
  const onCancel = jest.fn();
  render(<OutlineGenerateBar busy headingCount={3} onGenerate={noop} onCancel={onCancel} />);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).not.toHaveBeenCalled();
});

it('disables Generate content until the outline has a heading', () => {
  render(<OutlineGenerateBar busy={false} headingCount={0} onGenerate={noop} onCancel={noop} />);
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeDisabled();
});

// The planning and writing states are progress-only by design: there is nothing to
// review or approve yet. Cancelling a running generation is therefore not reachable
// from this bar — see cancelGenerationJob if that capability is wanted back.
it('shows a progress pill with no controls while planning the outline', () => {
  render(<OutlineGenerateBar planning busy={false} headingCount={0} onGenerate={noop} onCancel={noop} />);
  expect(screen.getByText('Generating outline')).toBeInTheDocument();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('shows a progress pill with no controls while writing', () => {
  render(<OutlineGenerateBar busy headingCount={3} progressPct={42} onGenerate={noop} onCancel={noop} />);
  expect(screen.getByText('Generating content 42%')).toBeInTheDocument();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
