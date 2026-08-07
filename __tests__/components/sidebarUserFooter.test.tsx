import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SidebarUserFooter from '../../components/koala/shell/SidebarUserFooter';

jest.mock('../../lib/auth/client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: 'Patryk Idzikowski', email: 'boski.idzikowski@gmail.com' } } }),
    signOut: jest.fn(),
  },
}));

jest.mock('../../services/profile', () => ({
  useProfile: () => ({ data: { name: 'Patryk Idzikowski', avatarUrl: '' } }),
}));

jest.mock('../../services/gscAccount', () => ({
  useGscAccount: () => ({ data: undefined }),
}));

function openMenu(variant?: 'sidebar' | 'header') {
  render(<SidebarUserFooter variant={variant} />);
  fireEvent.click(screen.getByRole('button', { name: 'Patryk Idzikowski' }));
}

describe('SidebarUserFooter header menu', () => {
  it('shows the signed-in user and only Settings / Sign out', () => {
    openMenu('header');

    expect(screen.getByText('Patryk Idzikowski')).toBeInTheDocument();
    expect(screen.getByText('@boski.idzikowski')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Profile/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Billing/ })).not.toBeInTheDocument();
  });

  it('puts the avatar in the menu head next to the name', () => {
    const { container } = render(<SidebarUserFooter variant="header" />);
    fireEvent.click(screen.getByRole('button', { name: 'Patryk Idzikowski' }));

    const head = container.querySelector('.koala-sidebar-user__menu-head');
    expect(head).not.toBeNull();
    // Avatar with no photo falls back to the initial.
    expect(head?.textContent).toContain('P');
    expect(head?.querySelector('.koala-sidebar-user__menu-head-meta')).not.toBeNull();
  });

  it('leaves the sidebar variant with its full link list', () => {
    openMenu('sidebar');

    expect(screen.getByRole('menuitem', { name: /Profile/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Billing/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeInTheDocument();
  });
});
