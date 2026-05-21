// POST /api/admin/claim-domains
// Przypisuje wszystkie domeny bez właściciela (userId = NULL) do zalogowanego użytkownika.
// Jednorazowe narzędzie migracyjne.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUserId } from '../../../utils/getUser';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
   }

   const userId = await getCurrentUserId(req, res);
   if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
   }

   try {
      await db.sync();
      const [updatedCount] = await Domain.update(
         { userId },
         { where: { userId: null } },
      );
      return res.status(200).json({
         success: true,
         claimed: updatedCount,
         userId,
         message: `Przypisano ${updatedCount} domenę/domen do konta ${userId}`,
      });
   } catch (error) {
      console.error('[claim-domains]', error);
      return res.status(500).json({ error: 'Database error' });
   }
}
