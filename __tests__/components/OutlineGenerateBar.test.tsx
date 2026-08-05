import { render, screen } from '@testing-library/react';
import OutlineGenerateBar from '../../components/articles/OutlineGenerateBar';

jest.mock('../../lib/motion/useEntrance', () => ({ useEntrance: () => null }));

it('keeps Cancel available while generation is busy', () => {
  render(<OutlineGenerateBar busy headingCount={1} onGenerate={() => undefined} onCancel={() => undefined} />);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});
