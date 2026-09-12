import { writeFile } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCallerRole } from '@/src/infrastructure/identity/members';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';

type SettingsGetResponse = {
   cleared?: boolean,
   error?: string,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   const userId = await getCurrentUserId(req, res);
   if (!userId) return res.status(401).json({ error: 'Not authorized' });
   const role = await getCallerRole(String(userId)).catch(() => null);
   if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Admin only.' });
   }
   if (req.method === 'PUT') {
      return clearFailedQueue(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const clearFailedQueue = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   try {
      await writeFile(`${process.cwd()}/data/failed_queue.json`, JSON.stringify([]), { encoding: 'utf-8' });
      return res.status(200).json({ cleared: true });
   } catch (error) {
      console.log('[ERROR] Clearing Failed Queue File.', error);
      return res.status(200).json({ error: 'Error Clearing Failed Queue!' });
   }
};

export default withOrgPaymentAccess(handler);
