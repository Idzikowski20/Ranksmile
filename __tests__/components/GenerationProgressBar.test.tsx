/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import GenerationProgressBar, { generationSteps } from '../../components/articles/GenerationProgressBar';

const states = (status: string) => generationSteps(status).map((s) => s.state);

/** The phases are read off the sidecar's status line — the only evidence the editor has. */
it('walks planning → sections → finishing off the status line', () => {
  expect(states('Starting generation…')).toEqual(['active', 'idle', 'idle']);
  expect(states('Reading competitor outlines…')).toEqual(['active', 'idle', 'idle']);
  expect(states('Writing section 3/13…')).toEqual(['done', 'active', 'idle']);
  expect(states('Checking links & images…')).toEqual(['done', 'done', 'active']);
});

it('shows the section counter and the raw planning status as details', () => {
  expect(generationSteps('Writing section 3/13…')[1].detail).toBe('3 / 13 sections');
  expect(generationSteps('Researching "najemca"…')[0].detail).toBe('Researching "najemca"');
  expect(generationSteps('')[0].detail).toBeUndefined();
});

it('announces the current phase in the pill status line', () => {
  render(<GenerationProgressBar mode="article" status="Writing section 3/13…" />);
  expect(screen.getByRole('status')).toHaveTextContent('Writing sections · 3 / 13 sections');
  expect(screen.getByText('1 of 3 steps done')).toBeInTheDocument();
});

it('keeps the outline pill to one honest step with no step count', () => {
  render(<GenerationProgressBar mode="outline" planningLabel="Loading saved outline" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading saved outline');
  expect(screen.queryByText(/steps done/)).toBeNull();
});
