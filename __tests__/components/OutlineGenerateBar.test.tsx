import { render, screen } from '@testing-library/react';
import OutlineGenerateBar from '../../components/articles/OutlineGenerateBar';

jest.mock('../../lib/motion/useEntrance', () => ({ useEntrance: () => null }));

const noop = () => undefined;

it('offers Cancel and Generate content while the outline is under review', () => {
  render(<OutlineGenerateBar busy={false} headingCount={3} onGenerate={noop} onCancel={noop} />);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Generate content/ })).toBeEnabled();
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
