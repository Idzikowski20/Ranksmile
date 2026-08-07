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
 * The editor passes its generation-status state straight through here. That state used
 * to be seeded with "Generating article…", so an idle review bar announced a run that
 * had not started and the reviewer never saw how many headings were waiting.
 */
it('falls back to the heading count when no status is in flight', () => {
  render(<OutlineGenerateBar busy={false} status="" headingCount={12} onGenerate={noop} />);
  expect(screen.getByText('12 headings ready — edit freely, then generate')).toBeInTheDocument();
});

it('shows a live status while one is supplied', () => {
  render(<OutlineGenerateBar busy={false} status="Writing your article…" headingCount={12} onGenerate={noop} />);
  expect(screen.getByText('Writing your article…')).toBeInTheDocument();
});
