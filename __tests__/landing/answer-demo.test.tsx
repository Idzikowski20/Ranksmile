import { render, screen } from '@testing-library/react';
import { AnswerDemo } from '../../components/landing/sections/AnswerDemo';

// The demo toggle drives conditional copy in the simulated AI answer. Cover both states.
describe('AnswerDemo toggle', () => {
  it('starts invisible and flips to visible when toggled', () => {
    render(<AnswerDemo />);
    const toggle = screen.getByRole('checkbox', { name: /toggle ranksmile/i }) as HTMLInputElement;

    // Off: brand is invisible and not the answer.
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/invisible without ranksmile/i)).toBeInTheDocument();
    expect(screen.getByText(/yourcompetitor\.com — mentioned as #1/i)).toBeInTheDocument();
    expect(screen.queryByText(/yourdomain\.com — mentioned as #1/i)).not.toBeInTheDocument();

    toggle.click();

    // On: brand is visible and cited #1.
    expect(toggle).toBeChecked();
    expect(screen.getByText(/visible with ranksmile/i)).toBeInTheDocument();
    expect(screen.getByText(/yourdomain\.com — mentioned as #1/i)).toBeInTheDocument();
    expect(screen.queryByText(/you are not the answer/i)).not.toBeInTheDocument();
  });
});
