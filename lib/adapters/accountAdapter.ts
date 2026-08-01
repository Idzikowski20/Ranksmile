import { notImplemented } from './types';

/** Delete current user account — stub (do not call GSC deleteAccount). */
export async function deleteAccount(): Promise<{ ok: true }> {
  notImplemented('Delete account');
}

export const accountAdapter = { deleteAccount };
