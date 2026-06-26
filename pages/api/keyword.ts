import type { NextApiRequest, NextApiResponse } from 'next';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import parseKeywords from '../../utils/parseKeywords';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';

type KeywordGetResponse = {
   keyword?: KeywordType | null
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized === 'authorized' && req.method === 'GET') {
      await db.sync();
      const userId = await getCurrentUserId(req, res);
      return getKeyword(req, res, userId);
   }
   return res.status(401).json({ error: authorized });
}

const getKeyword = async (req: NextApiRequest, res: NextApiResponse<KeywordGetResponse>, userId?: string | null) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
       return res.status(400).json({ error: 'Keyword ID is Required!' });
   }

   try {
      const query = { ID: parseInt((req.query.id as string), 10) };
      const foundKeyword:Keyword| null = await Keyword.findOne({ where: query });
      if (!foundKeyword) return res.status(200).json({ keyword: null });

      const ownership = await verifyDomainOwnership(foundKeyword.domain, userId ?? null);
      if (ownership === false || ownership === null) return res.status(403).json({ error: 'Access denied.' });

      const parsedKeyword = parseKeywords([foundKeyword.get({ plain: true })]);
      const keywords = parsedKeyword && parsedKeyword[0] ? parsedKeyword[0] : null;
      return res.status(200).json({ keyword: keywords });
   } catch (error) {
      console.log('[ERROR] Getting Keyword: ', error);
      return res.status(400).json({ error: 'Error Loading Keyword' });
   }
};
