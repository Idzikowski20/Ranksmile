import type { NextApiRequest, NextApiResponse } from 'next';
import Cryptr from 'cryptr';
import db from '../../database/database';
import Domain from '../../database/models/domain';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
import { withOrgPaymentAccess } from '../../lib/requireOrgPaymentAccess';

type DomainGetResponse = {
   domain?: DomainType | null
   error?: string|null,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized === 'authorized' && req.method === 'GET') {
      await db.sync();
      const userId = await getCurrentUserId(req, res);
      return getDomain(req, res, userId);
   }
   return res.status(401).json({ error: authorized });
}

const getDomain = async (req: NextApiRequest, res: NextApiResponse<DomainGetResponse>, userId?: string | null) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') {
       return res.status(400).json({ error: 'Domain Name is Required!' });
   }

   try {
      const domainName = req.query.domain as string;
      const ownership = await verifyDomainOwnership(domainName, userId ?? null);
      if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
      if (ownership === null) return res.status(404).json({ error: 'Domain not found.' });
      const foundDomain: Domain | null = ownership;
      const parsedDomain = foundDomain?.get({ plain: true }) || false;

      if (parsedDomain && parsedDomain.search_console) {
         try {
            const cryptr = new Cryptr(process.env.SECRET as string);
            const scData = JSON.parse(parsedDomain.search_console);
            scData.client_email = scData.client_email ? cryptr.decrypt(scData.client_email) : '';
            scData.private_key = scData.private_key ? cryptr.decrypt(scData.private_key) : '';
            parsedDomain.search_console = JSON.stringify(scData);
         } catch (error) {
            console.log('[Error] Parsing Search Console Keys.');
         }
      }

      return res.status(200).json({ domain: parsedDomain });
   } catch (error) {
      console.log('[ERROR] Getting Domain: ', error);
      return res.status(400).json({ error: 'Error Loading Domain' });
   }
};

export default withOrgPaymentAccess(handler);
