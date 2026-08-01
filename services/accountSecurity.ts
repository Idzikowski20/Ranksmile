import { useMutation } from 'react-query';
import { mfaAdapter, accountAdapter, isAdapterError } from '../lib/adapters';
import { showToast } from '../lib/toast';

export function useEnrollMfa() {
  return useMutation(() => mfaAdapter.enroll(), {
    onError: (err: unknown) => {
      if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
        showToast({ type: 'default', message: 'Two-factor setup — coming soon' });
        return;
      }
      showToast({ type: 'error', message: 'Could not start 2FA setup' });
    },
  });
}

export function useConfirmMfa() {
  return useMutation((code: string) => mfaAdapter.confirm({ code }), {
    onSuccess: () => {
      showToast({ type: 'success', message: 'Two-factor enabled' });
    },
    onError: (err: unknown) => {
      if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
        showToast({ type: 'default', message: 'Two-factor setup — coming soon' });
        return;
      }
      showToast({ type: 'error', message: 'Invalid code' });
    },
  });
}

export function useDeleteAccount() {
  return useMutation(() => accountAdapter.deleteAccount(), {
    onError: (err: unknown) => {
      if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
        showToast({ type: 'default', message: 'Delete account — coming soon' });
        return;
      }
      showToast({ type: 'error', message: 'Could not delete account' });
    },
  });
}
