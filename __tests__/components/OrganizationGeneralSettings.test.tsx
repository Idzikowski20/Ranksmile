import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrganizationGeneralSettings from '../../components/settings/OrganizationGeneralSettings';
import { useOrganization, useUpdateOrganization } from '../../services/organization';
import { usePeople } from '../../services/people';

jest.mock('../../services/organization', () => ({
  useOrganization: jest.fn(),
  useUpdateOrganization: jest.fn(),
}));
jest.mock('../../services/people', () => ({ usePeople: jest.fn() }));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockOrg = useOrganization as jest.Mock;
const mockPeople = usePeople as jest.Mock;
const mockUpdate = useUpdateOrganization as jest.Mock;

const mutateAsync = jest.fn();

/** Patch the component sent to PUT /api/organization on the last save. */
const lastPatch = (): Record<string, unknown> => mutateAsync.mock.calls.at(-1)?.[0];

const setup = (role: string) => {
  mockPeople.mockReturnValue({ data: { role } });
  mockOrg.mockReturnValue({ data: { name: 'Acme', logoUrl: 'https://cdn/logo.png' } });
  mockUpdate.mockReturnValue({ mutateAsync });
  return render(<OrganizationGeneralSettings />);
};

const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
};

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ name: 'Acme', logoUrl: null });
});

describe('OrganizationGeneralSettings', () => {
  it('sends only the name when the logo is untouched', async () => {
    setup('owner');
    await save();
    expect(lastPatch()).toEqual({ name: 'Acme' });
  });

  it('sends logoDataUrl: null after Remove, so the server actually clears it', async () => {
    // Omitting the key would leave the old logo in place — the bug this branch exists for.
    setup('owner');
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await save();
    expect(lastPatch()).toEqual({ name: 'Acme', logoDataUrl: null });
  });

  it('hides the save control from a plain member and disables the name field', () => {
    setup('member');
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only owners and admins can change/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme')).toBeDisabled();
  });
});
