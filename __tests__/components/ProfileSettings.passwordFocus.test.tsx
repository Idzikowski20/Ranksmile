import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/src/infrastructure/auth/fetchAuth', () => ({ changePassword: jest.fn() }));
jest.mock('@/src/infrastructure/auth/client', () => ({ authClient: { useSession: () => ({ data: null }) } }));
jest.mock('../../services/gscAccount', () => ({ useGscAccount: () => ({ data: null }) }));
jest.mock('../../services/profile', () => ({
  useProfile: () => ({ data: { name: 'Ada', avatarUrl: '' } }),
  useUpdateProfile: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../services/accountSecurity', () => ({
  useDeleteAccount: () => ({ mutate: jest.fn(), isPending: false }),
}));
// Renders unconditionally and calls react-query hooks; irrelevant to focus.
jest.mock('../../components/koala/product/Enable2FADialog', () => ({ Enable2FADialog: () => null }));

import ProfileSettings from '../../components/settings/ProfileSettings';

/**
 * Opening and closing the password section swaps which control exists. A removed
 * element hands focus back to <body>, which drops a keyboard user out of the section
 * they just opened and leaves a screen reader with nothing to announce.
 */
describe('ProfileSettings — password section focus', () => {
  it('moves focus into the first field on open and back to the button on cancel', () => {
    render(<ProfileSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByLabelText(/Current password/i)).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Change password' })).toHaveFocus();
  });
});
