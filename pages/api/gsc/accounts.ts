import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import {
  deleteAccountForUser,
  getAccountsForUser,
  refreshAccountProfileFromGoogle,
  verifyAccountToken,
  type GscAccountRecord,
} from '../../../lib/gscAccounts';

type GscAccountsResponse = {
  accounts?: ReturnType<typeof normalizeAccount>[];
  deleted?: boolean;
  error?: string;
};

const normalizeAccount = (account: GscAccountRecord & { status?: string }) => ({
  id: account.ID,
  userId: account.userId,
  googleSub: account.google_sub,
  email: account.email,
  picture: account.picture || '',
  connectedAt: account.connected_at || '',
  scopes: account.scopes || '',
  status: account.status || 'connected',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse<GscAccountsResponse>) {
  await db.sync();
  const authorized = await verifyUser(req, res);
  if (authorized !== 'authorized') {
    return res.status(401).json({ error: authorized });
  }

  const userId = await getCurrentUserId(req, res);
  if (!userId) {
    return res.status(401).json({ error: 'Missing Neon Auth user session.' });
  }

  if (req.method === 'GET') {
    const accounts = await getAccountsForUser(userId);
    const hydratedAccounts = await Promise.all(
      accounts.map(async (account) => {
        const [profile, tokenStatus] = await Promise.all([
          refreshAccountProfileFromGoogle(account).catch(() => account),
          verifyAccountToken(account).catch(() => ({ valid: true, expired: false })),
        ]);
        return { ...profile, status: tokenStatus.expired ? 'expired' : 'connected' };
      }),
    );
    return res.status(200).json({ accounts: hydratedAccounts.map(normalizeAccount) });
  }

  if (req.method === 'DELETE') {
    const accountId = Number(req.query.id);
    if (!accountId) {
      return res.status(400).json({ error: 'Missing account id.' });
    }

    const deleted = await deleteAccountForUser(userId, accountId);
    return res.status(200).json({ deleted: deleted > 0 });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
