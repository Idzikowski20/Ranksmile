import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import { getAppSettings } from './settings';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { verifyDomainOwnership } from '../../utils/verifyDomainOwnership';
import parseKeywords from '../../utils/parseKeywords';
import { integrateKeywordSCData, readLocalSCData } from '../../utils/searchConsole';
import refreshAndUpdateKeywords from '../../utils/refresh';
import { getKeywordsVolume, updateKeywordsVolumeData } from '../../utils/adwords';
import { removeFromRetryQueue } from '../../utils/scraper';

export async function userOwnsAllKeywords(ids: Array<number | string>, userId: string | null): Promise<boolean> {
   if (!ids.length) return false;
   const { Op } = await import('sequelize');
   const kws = await Keyword.findAll({ where: { ID: { [Op.in]: ids } }, attributes: ['domain'] });
   const domains = Array.from(new Set(kws.map((k) => k.domain)));
   for (const d of domains) {
      const owns = await verifyDomainOwnership(d, userId);
      if (owns === false || owns === null) return false;
   }
   return true;
}

type KeywordsGetResponse = {
   keywords?: KeywordType[],
   error?: string|null,
}

type KeywordsDeleteRes = {
   domainRemoved?: number,
   keywordsRemoved?: number,
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   const userId = await getCurrentUserId(req, res);
   if (req.method === 'GET') {
      return getKeywords(req, res, userId);
   }
   if (req.method === 'POST') {
      return addKeywords(req, res, userId);
   }
   if (req.method === 'DELETE') {
      return deleteKeywords(req, res, userId);
   }
   if (req.method === 'PUT') {
      return updateKeywords(req, res, userId);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>, userId?: string | null) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') {
      return res.status(400).json({ error: 'Domain is Required!' });
   }
   const domain = (req.query.domain as string);
   const ownership = await verifyDomainOwnership(domain, userId ?? null);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found.' });
   const settings = await getAppSettings();
   const integratedSC = process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL;
   const { search_console_client_email, search_console_private_key } = settings;
   const domainSCData = integratedSC || (search_console_client_email && search_console_private_key) ? await readLocalSCData(domain) : false;

   try {
      const allKeywords:Keyword[] = await Keyword.findAll({ where: { domain } });
      const keywords: KeywordType[] = parseKeywords(allKeywords.map((e) => e.get({ plain: true })));
      const processedKeywords = keywords.map((keyword) => {
         const historyArray = Object.keys(keyword.history).map((dateKey:string) => ({
            date: new Date(dateKey).getTime(),
            dateRaw: dateKey,
            position: keyword.history[dateKey],
         }));
         const historySorted = historyArray.sort((a, b) => a.date - b.date);
         const lastWeekHistory :KeywordHistory = {};
         historySorted.slice(-7).forEach((x:any) => { lastWeekHistory[x.dateRaw] = x.position; });
         const keywordWithSlimHistory = { ...keyword, lastResult: [], history: lastWeekHistory };
         const finalKeyword = domainSCData ? integrateKeywordSCData(keywordWithSlimHistory, domainSCData) : keywordWithSlimHistory;
         return finalKeyword;
      });
      return res.status(200).json({ keywords: processedKeywords });
   } catch (error) {
      console.log('[ERROR] Getting Domain Keywords for ', domain, error);
      return res.status(400).json({ error: 'Error Loading Keywords for this Domain.' });
   }
};

const addKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>, userId?: string | null) => {
   const { keywords } = req.body;
   if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // Verify ownership of EVERY distinct domain in the payload — not just keywords[0].
      // (A mixed payload [{domain:mine},{domain:victim}] previously injected keywords cross-tenant.)
      const payloadDomains = [...new Set(keywords.map((k: KeywordAddPayload) => k?.domain))];
      if (payloadDomains.some((d) => !d)) return res.status(400).json({ error: 'Each keyword must include a domain.' });
      for (const d of payloadDomains) {
         const ownership = await verifyDomainOwnership(d as string, userId ?? null);
         if (ownership === false || ownership === null) return res.status(403).json({ error: 'Access denied.' });
      }
      // const keywordsArray = keywords.replaceAll('\n', ',').split(',').map((item:string) => item.trim());
      const keywordsToAdd: any = []; // QuickFIX for bug: https://github.com/sequelize/sequelize-typescript/issues/936

      keywords.forEach((kwrd: KeywordAddPayload) => {
         const { keyword, device, country, domain, tags, city } = kwrd;
         const tagsArray = tags ? tags.split(',').map((item:string) => item.trim()) : [];
         const newKeyword = {
            keyword,
            device,
            domain,
            country,
            city,
            position: 0,
            updating: true,
            history: JSON.stringify({}),
            url: '',
            tags: JSON.stringify(tagsArray),
            sticky: false,
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
         };
         keywordsToAdd.push(newKeyword);
      });

      try {
         const newKeywords:Keyword[] = await Keyword.bulkCreate(keywordsToAdd);
         const formattedkeywords = newKeywords.map((el) => el.get({ plain: true }));
         const keywordsParsed: KeywordType[] = parseKeywords(formattedkeywords);

         // Queue the SERP Scraping Process
         const settings = await getAppSettings();
         refreshAndUpdateKeywords(newKeywords, settings);

         // Update the Keyword Volume
         const { adwords_account_id, adwords_client_id, adwords_client_secret, adwords_developer_token } = settings;
         if (adwords_account_id && adwords_client_id && adwords_client_secret && adwords_developer_token) {
            const keywordsVolumeData = await getKeywordsVolume(keywordsParsed);
            if (keywordsVolumeData.volumes !== false) {
               await updateKeywordsVolumeData(keywordsVolumeData.volumes);
            }
         }

         return res.status(201).json({ keywords: keywordsParsed });
      } catch (error) {
         console.log('[ERROR] Adding New Keywords ', error);
         return res.status(400).json({ error: 'Could Not Add New Keyword!' });
      }
   } else {
      return res.status(400).json({ error: 'Necessary Keyword Data Missing' });
   }
};

const deleteKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsDeleteRes>, userId?: string | null) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }

   try {
      const keywordsToRemove = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
      if (!(await userOwnsAllKeywords(keywordsToRemove, userId ?? null))) return res.status(403).json({ error: 'Access denied.' });
      const removeQuery = { where: { ID: { [Op.in]: keywordsToRemove } } };
      const removedKeywordCount: number = await Keyword.destroy(removeQuery);

      // remove keyword from retry queue if exists
      await Promise.all(keywordsToRemove.map((keywordID) => removeFromRetryQueue(keywordID)));

      return res.status(200).json({ keywordsRemoved: removedKeywordCount });
   } catch (error) {
      console.log('[ERROR] Removing Keyword. ', error);
      return res.status(400).json({ error: 'Could Not Remove Keyword!' });
   }
};

const updateKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>, userId?: string | null) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }
   if (req.body.sticky === undefined && !req.body.tags === undefined) {
      return res.status(400).json({ error: 'keyword Payload Missing!' });
   }
   const keywordIDs = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
   const { sticky, tags } = req.body;

   try {
      let keywords: KeywordType[] = [];
      if (sticky !== undefined) {
         if (!(await userOwnsAllKeywords(keywordIDs, userId ?? null))) return res.status(403).json({ error: 'Access denied.' });
         await Keyword.update({ sticky }, { where: { ID: { [Op.in]: keywordIDs } } });
         const updateQuery = { where: { ID: { [Op.in]: keywordIDs } } };
         const updatedKeywords:Keyword[] = await Keyword.findAll(updateQuery);
         const formattedKeywords = updatedKeywords.map((el) => el.get({ plain: true }));
          keywords = parseKeywords(formattedKeywords);
         return res.status(200).json({ keywords });
      }
      if (tags) {
         const tagsKeywordIDs = Object.keys(tags);
         if (!(await userOwnsAllKeywords(tagsKeywordIDs, userId ?? null))) return res.status(403).json({ error: 'Access denied.' });
         const multipleKeywords = tagsKeywordIDs.length > 1;
         for (const keywordID of tagsKeywordIDs) {
            const selectedKeyword = await Keyword.findOne({ where: { ID: keywordID } });
            const currentTags = selectedKeyword && selectedKeyword.tags ? JSON.parse(selectedKeyword.tags) : [];
            const mergedTags = Array.from(new Set([...currentTags, ...tags[keywordID]]));
            if (selectedKeyword) {
               await selectedKeyword.update({ tags: JSON.stringify(multipleKeywords ? mergedTags : tags[keywordID]) });
            }
         }
         return res.status(200).json({ keywords });
      }
      return res.status(400).json({ error: 'Invalid Payload!' });
   } catch (error) {
      console.log('[ERROR] Updating Keyword. ', error);
      return res.status(200).json({ error: 'Error Updating keywords!' });
   }
};
