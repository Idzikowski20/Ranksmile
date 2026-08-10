import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InviteTeamStep, type PendingInvite } from '../../components/onboarding/InviteTeamStep';

/** Controlled in the test the way OnboardingSurvey controls it. */
function Harness({ initial = [] as PendingInvite[] }) {
  const [invites, setInvites] = useState<PendingInvite[]>(initial);
  return <InviteTeamStep invites={invites} onChange={setInvites} />;
}

describe('InviteTeamStep', () => {
  it('lists each pending invite with its own role control', () => {
    render(<Harness initial={[
      { email: 'alex@example.com', role: 'member' },
      { email: 'smith@example.com', role: 'admin' },
    ]}
    />);

    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('2 to invite')).toBeInTheDocument();

    // One role control per person, each showing that person's own role. Scoped by row
    // rather than by accessible name: CompactSelect does not forward aria-label, so the
    // triggers have no name of their own — a gap in the Koala component, not here.
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Member');
    expect(rows[1]).toHaveTextContent('Admin');
  });

  it('removes an invite without touching the others', () => {
    render(<Harness initial={[
      { email: 'alex@example.com', role: 'member' },
      { email: 'smith@example.com', role: 'admin' },
    ]}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove alex@example.com' }));

    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 to invite')).toBeInTheDocument();
  });

  // The two rows the Figma shows but this product cannot back: an organisation has
  // no public mode and no invite links, so neither control is rendered.
  it('offers no public-access toggle and no invite link', () => {
    render(<Harness initial={[{ email: 'alex@example.com', role: 'member' }]} />);

    expect(screen.queryByText(/People with access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Copy link/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private link/i)).not.toBeInTheDocument();
  });

  it('renders nothing but the form until something is typed', () => {
    render(<Harness />);

    expect(screen.getByText(/Invite others/)).toBeInTheDocument();
    expect(screen.queryByText(/to invite$/)).not.toBeInTheDocument();
  });
});
