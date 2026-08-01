/** Browser auth facade — fetch-based session + sign-out. */
import { useAuthSession } from '../../hooks/useAuthSession';
import { signOut as fetchSignOut } from './fetchAuth';

export const authClient = {
  useSession: useAuthSession,
  signOut: async () => {
    await fetchSignOut();
  },
};
