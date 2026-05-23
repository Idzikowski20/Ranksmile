import { writeFile, readFile, rename, stat } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import Cryptr from 'cryptr';
import getConfig from 'next/config';
import verifyUser from '../../utils/verifyUser';
import allScrapers from '../../scrapers/index';

type SettingsGetResponse = {
   settings?: object | null,
   error?: string,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'GET') {
      return getSettings(req, res);
   }
   if (req.method === 'PUT') {
      return updateSettings(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getSettings = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   const settings = await getAppSettings();
   if (settings) {
      const { publicRuntimeConfig } = getConfig();
      const version = publicRuntimeConfig?.version;
      return res.status(200).json({ settings: { ...settings, version } });
   }
   return res.status(400).json({ error: 'Error Loading Settings!' });
};

// Fields that live in .env — never written to settings.json
const SCRAPER_FIELDS = ['scraper_type', 'scaping_api', 'proxy', 'scrape_interval', 'scrape_delay',
   'scrape_retry', 'scrape_strategy', 'scrape_pagination_limit', 'scrape_smart_full_fallback'] as const;

// Adwords credential fields live in .env — strip them from settings.json writes.
// (adwords_refresh_token is the only adwords field still stored in settings.json)
const ADWORDS_FIELDS = ['adwords_client_id', 'adwords_client_secret', 'adwords_developer_token', 'adwords_account_id'] as const;

const updateSettings = async (req: NextApiRequest, res: NextApiResponse<SettingsGetResponse>) => {
   const { settings } = req.body || {};
   if (!settings) {
      return res.status(200).json({ error: 'Settings Data not Provided!' });
   }
   try {
      const cryptr = new Cryptr(process.env.SECRET as string);
      const smtp_password = settings.smtp_password ? cryptr.encrypt(settings.smtp_password.trim()) : '';
      const search_console_client_email = settings.search_console_client_email ? cryptr.encrypt(settings.search_console_client_email.trim()) : '';
      const search_console_private_key = settings.search_console_private_key ? cryptr.encrypt(settings.search_console_private_key.trim()) : '';

      // Strip scraper and adwords fields — they live in .env, not settings.json
      const stripped = { ...settings };
      SCRAPER_FIELDS.forEach((f) => { delete stripped[f]; });
      ADWORDS_FIELDS.forEach((f) => { delete (stripped as any)[f]; });

      const securedSettings = {
         ...stripped,
         smtp_password,
         search_console_client_email,
         search_console_private_key,
      };

      await writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(securedSettings), { encoding: 'utf-8' });
      return res.status(200).json({ settings });
   } catch (error) {
      console.log('[ERROR] Updating App Settings. ', error);
      return res.status(200).json({ error: 'Error Updating Settings!' });
   }
};

const safeReadJSON = async (filePath: string, fallback: any): Promise<any> => {
   try {
      const raw = await readFile(filePath, { encoding: 'utf-8' });
      return raw ? JSON.parse(raw) : fallback;
   } catch (error: any) {
      const fileExists = await stat(filePath).then(() => true).catch(() => false);
      if (fileExists) {
         // File exists but is corrupt — back it up instead of silently overwriting
         const backupPath = `${filePath}.${Date.now()}.corrupt`;
         console.log(`[WARN] Corrupt JSON detected in ${filePath}. Backing up to ${backupPath}`);
         await rename(filePath, backupPath).catch(() => {});
      }
      await writeFile(filePath, JSON.stringify(fallback), { encoding: 'utf-8' }).catch(() => {});
      return fallback;
   }
};

// Read scraper config from env vars
const getScraperEnvConfig = () => {
   const scraper_type = process.env.SCRAPER_TYPE || 'none';
   const scaping_api = process.env.SCRAPER_API_KEY
      || (scraper_type === 'serper' ? process.env.SERPER_API_KEY : '')
      || '';

   return {
      scraper_type,
      scaping_api,
      proxy: process.env.SCRAPER_PROXY || '',
      scrape_interval: process.env.SCRAPE_INTERVAL || 'daily',
      scrape_delay: process.env.SCRAPE_DELAY || '0',
      scrape_retry: process.env.SCRAPE_RETRY === 'true',
      scrape_strategy: (process.env.SCRAPE_STRATEGY || 'basic') as SettingsType['scrape_strategy'],
      scrape_pagination_limit: parseInt(process.env.SCRAPE_PAGINATION_LIMIT || '5', 10),
      scrape_smart_full_fallback: process.env.SCRAPE_SMART_FULL_FALLBACK === 'true',
   };
};

export const getAppSettings = async () : Promise<SettingsType> => {
   const screenshotAPIKey = process.env.SCREENSHOT_API || '69408-serpbear';
   const defaultSettings: SettingsType = {
      scraper_type: 'none',
      notification_interval: 'never',
      notification_email: '',
      notification_email_from: '',
      notification_email_from_name: 'SerpBear',
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
      scrape_retry: false,
      screenshot_key: screenshotAPIKey,
      search_console: true,
      search_console_client_email: '',
      search_console_private_key: '',
      keywordsColumns: ['Best', 'Worst', 'History', 'Volume', 'Search Console'],
      scrape_strategy: 'basic',
      scrape_pagination_limit: 5,
      scrape_smart_full_fallback: false,
   };

   const settings: SettingsType = await safeReadJSON(`${process.cwd()}/data/settings.json`, defaultSettings);
   const failedQueue: string[] = await safeReadJSON(`${process.cwd()}/data/failed_queue.json`, []);

   let decryptedSettings = settings;
   try {
      const cryptr = new Cryptr(process.env.SECRET as string);
      const smtp_password = settings.smtp_password ? cryptr.decrypt(settings.smtp_password) : '';
      const search_console_client_email = settings.search_console_client_email ? cryptr.decrypt(settings.search_console_client_email) : '';
      const search_console_private_key = settings.search_console_private_key ? cryptr.decrypt(settings.search_console_private_key) : '';
      // Adwords credentials come from .env; refresh_token may be stored in settings.json via OAuth callback
      let adwords_refresh_token = process.env.ADWORDS_REFRESH_TOKEN || '';
      if (!adwords_refresh_token && settings.adwords_refresh_token) {
         try { adwords_refresh_token = cryptr.decrypt(settings.adwords_refresh_token); } catch (e) { /* ignore */ }
      }

      decryptedSettings = {
         ...settings,
         // Scraper config always comes from .env
         ...getScraperEnvConfig(),
         smtp_password,
         search_console_client_email,
         search_console_private_key,
         search_console_integrated: !!(process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL)
         || !!(search_console_client_email && search_console_private_key),
         available_scrapers: allScrapers.map((scraper) => ({ label: scraper.name, value: scraper.id, allowsCity: !!scraper.allowsCity })),
         failed_queue: failedQueue,
         screenshot_key: screenshotAPIKey,
         // Adwords: expose only status indicators (not actual credential values)
         adwords_client_id: process.env.ADWORDS_CLIENT_ID ? '(set)' : '',
         adwords_client_secret: process.env.ADWORDS_CLIENT_SECRET ? '(set)' : '',
         adwords_developer_token: process.env.ADWORDS_DEVELOPER_TOKEN ? '(set)' : '',
         adwords_account_id: process.env.ADWORDS_ACCOUNT_ID ? '(set)' : '',
         adwords_refresh_token: adwords_refresh_token ? '(connected)' : '',
      };
   } catch (error) {
      console.log('Error Decrypting Settings API Keys!');
   }

   return decryptedSettings;
};
