/**
 * Browser auth facade — fetch-based only.
 * Do NOT import @neondatabase/auth here: its Zod schemas crash Next 12 client bundles
 * ("Cannot set properties of undefined (setting 'def')").
 */
import { useAuthSession } from '../../hooks/useAuthSession';
import { signOut as fetchSignOut } from './fetchAuth';

export const authClient = {
  useSession: useAuthSession,
  signOut: async () => {
    await fetchSignOut();
  },
};
