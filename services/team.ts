import { useMutation } from 'react-query';
import { teamAdapter, type CreateTeamInput, isAdapterError } from '../lib/adapters';
import { showToast } from '../lib/toast';

export function useCreateTeam() {
  return useMutation((input: CreateTeamInput) => teamAdapter.create(input), {
    onSuccess: () => {
      showToast({ type: 'success', message: 'Team created' });
    },
    onError: (err: unknown) => {
      if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
        showToast({ type: 'default', message: 'Create team — coming soon' });
        return;
      }
      showToast({ type: 'error', message: 'Could not create team' });
    },
  });
}
