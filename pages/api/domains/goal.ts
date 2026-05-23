import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../database/database';
import Domain from '../../../database/models/domain';
import verifyUser from '../../../utils/verifyUser';
import { getCurrentUserId } from '../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../utils/verifyDomainOwnership';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });

   await db.sync();
   const userId = await getCurrentUserId(req, res);
   const domainSlug = req.query.domain as string;

   if (!domainSlug) return res.status(400).json({ error: 'Domain is required' });

   if (req.method === 'GET') {
      return getGoal(req, res, domainSlug, userId);
   }
   if (req.method === 'POST') {
      return saveGoal(req, res, domainSlug, userId);
   }
   if (req.method === 'DELETE') {
      return deleteGoal(req, res, domainSlug, userId);
   }

   return res.status(405).json({ error: 'Method not allowed' });
}

async function getGoal(req: NextApiRequest, res: NextApiResponse, domainSlug: string, userId?: string | null) {
   try {
      const ownership = await verifyDomainOwnershipBySlug(domainSlug, userId ?? null);
      if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
      if (ownership === null) return res.status(404).json({ error: 'Domain not found.' });

      const domain = ownership as Domain;
      const goal = domain.traffic_goal ? JSON.parse(domain.traffic_goal) : null;
      return res.status(200).json({ goal });
   } catch (error) {
      console.log('[ERROR] Getting traffic goal:', error);
      return res.status(400).json({ error: 'Error loading goal' });
   }
}

async function saveGoal(req: NextApiRequest, res: NextApiResponse, domainSlug: string, userId?: string | null) {
   try {
      const { percentage, period, baseClicks } = req.body;
      if (typeof percentage !== 'number' || !period) {
         return res.status(400).json({ error: 'percentage and period are required' });
      }

      const ownership = await verifyDomainOwnershipBySlug(domainSlug, userId ?? null);
      if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
      if (ownership === null) return res.status(404).json({ error: 'Domain not found.' });

      const domain = ownership as Domain;
      const goal = {
         percentage,
         period,
         startDate: new Date().toISOString().split('T')[0],
         baseClicks: baseClicks ?? 0,
      };

      await domain.update({ traffic_goal: JSON.stringify(goal) });
      return res.status(200).json({ goal });
   } catch (error) {
      console.log('[ERROR] Saving traffic goal:', error);
      return res.status(400).json({ error: 'Error saving goal' });
   }
}

async function deleteGoal(req: NextApiRequest, res: NextApiResponse, domainSlug: string, userId?: string | null) {
   try {
      const ownership = await verifyDomainOwnershipBySlug(domainSlug, userId ?? null);
      if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
      if (ownership === null) return res.status(404).json({ error: 'Domain not found.' });

      const domain = ownership as Domain;
      await domain.update({ traffic_goal: null });
      return res.status(200).json({ goal: null });
   } catch (error) {
      console.log('[ERROR] Deleting traffic goal:', error);
      return res.status(400).json({ error: 'Error deleting goal' });
   }
}
