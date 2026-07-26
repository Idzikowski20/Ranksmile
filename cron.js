/* eslint-disable no-new */
const Cryptr = require('cryptr');
const { promises } = require('fs');
const { readFile } = require('fs');
const { Cron } = require('croner');
require('dotenv').config({ path: './.env.local' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build the internal base URL for cron→server requests.
// On Railway, NEXTJS_URL / APP_BASE_URL is required (no localhost fallback).
const getInternalBaseURL = () => {
   const explicit = (process.env.NEXTJS_URL || process.env.APP_BASE_URL || '').trim();
   if (explicit) return explicit.replace(/\/$/, '');

   if (process.env.RAILWAY_ENVIRONMENT) {
      console.error(
         '[cron] FATAL: NEXTJS_URL or APP_BASE_URL required on Railway (refusing localhost fallback)',
      );
      process.exit(1);
   }

   const serverPort = process.env.PORT || 3000;
   return `http://127.0.0.1:${serverPort}`;
};

const INTERNAL_BASE_URL = getInternalBaseURL();
console.log(`[cron] INTERNAL_BASE_URL=${INTERNAL_BASE_URL}`);

async function fetchWithRetry(url, fetchOpts, { attempts = 3, baseDelayMs = 1000 } = {}) {
   let lastErr;
   for (let i = 0; i < attempts; i++) {
      try {
         const res = await fetch(url, fetchOpts);
         if (res.status >= 500) {
            throw new Error(`HTTP ${res.status}`);
         }
         return res;
      } catch (err) {
         lastErr = err;
         if (i < attempts - 1) await sleep(baseDelayMs * (2 ** i));
      }
   }
   throw lastErr;
}

const getAppSettings = async () => {
   const defaultSettings = {
      scraper_type: 'none',
      notification_interval: 'never',
      notification_email: '',
      smtp_server: '',
      smtp_port: '',
      smtp_username: '',
      smtp_password: '',
   };
   try {
      let decryptedSettings = {};
      const exists = await promises.stat(`${process.cwd()}/data/settings.json`).then(() => true).catch(() => false);
      if (exists) {
         const settingsRaw = await promises.readFile(`${process.cwd()}/data/settings.json`, { encoding: 'utf-8' });
         let settings;
         try {
            settings = settingsRaw ? JSON.parse(settingsRaw) : {};
         } catch (parseError) {
            const backupPath = `${process.cwd()}/data/settings.json.${Date.now()}.corrupt`;
            console.log(`[WARN] Corrupt settings.json detected. Backing up to ${backupPath}`);
            await promises.rename(`${process.cwd()}/data/settings.json`, backupPath).catch(() => {});
            await promises.writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(defaultSettings), { encoding: 'utf-8' }).catch(() => {});
            return defaultSettings;
         }

         try {
            const cryptr = new Cryptr(process.env.SECRET);
            const scaping_api = settings.scaping_api ? cryptr.decrypt(settings.scaping_api) : '';
            const smtp_password = settings.smtp_password ? cryptr.decrypt(settings.smtp_password) : '';
            decryptedSettings = { ...settings, scaping_api, smtp_password };
         } catch (error) {
            console.log('Error Decrypting Settings API Keys!');
         }
      } else {
         throw Error('Settings file don\'t exist.');
      }
      return decryptedSettings;
   } catch (error) {
      await promises.mkdir(`${process.cwd()}/data`, { recursive: true }).catch(() => {});
      await promises.writeFile(`${process.cwd()}/data/settings.json`, JSON.stringify(defaultSettings), { encoding: 'utf-8' }).catch(() => {});
      return defaultSettings;
   }
};

const generateCronTime = (interval) => {
   let cronTime = false;
   if (interval === 'hourly') {
      cronTime = '0 0 */1 * * *';
   }
   if (interval === 'daily') {
      cronTime = '0 0 0 * * *';
   }
   if (interval === 'other_day') {
      cronTime = '0 0 2-30/2 * *';
   }
   if (interval === 'daily_morning') {
      cronTime = '0 0 3 * * *';
   }
   if (interval === 'weekly') {
      cronTime = '0 0 * * 1';
   }
   if (interval === 'monthly') {
      cronTime = '0 0 1 * *';
   }

   return cronTime;
};

const runAppCronJobs = () => {
   if (!process.env.APIKEY) {
      console.error('[cron] APIKEY missing — cron HTTP calls will fail auth');
   }

   getAppSettings().then((settings) => {
      const scrape_interval = settings.scrape_interval || 'daily';
      if (scrape_interval !== 'never') {
         const scrapeCronTime = generateCronTime(scrape_interval);
         new Cron(scrapeCronTime, () => {
            const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
            fetchWithRetry(`${INTERNAL_BASE_URL}/api/cron`, fetchOpts)
            .then((res) => res.json())
            .catch((err) => {
               console.log('ERROR Making SERP Scraper Cron Request (after retries)..');
               console.log(err);
            });
         }, { scheduled: true });
      }

      const notif_interval = (!settings.notification_interval || settings.notification_interval === 'never') ? false : settings.notification_interval;
      if (notif_interval) {
         const cronTime = generateCronTime(notif_interval === 'daily' ? 'daily_morning' : notif_interval);
         if (cronTime) {
            new Cron(cronTime, () => {
               const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
               fetchWithRetry(`${INTERNAL_BASE_URL}/api/notify`, fetchOpts)
               .then((res) => res.json())
               .then((data) => console.log(data))
               .catch((err) => {
                  console.log('ERROR Making Cron Email Notification Request (after retries)..');
                  console.log(err);
               });
            }, { scheduled: true });
         }
      }
   });

   const failedCronTime = generateCronTime('hourly');
   new Cron(failedCronTime, () => {
      readFile(`${process.cwd()}/data/failed_queue.json`, { encoding: 'utf-8' }, (err, data) => {
         if (data) {
            try {
               const keywordsToRetry = data ? JSON.parse(data) : [];
               if (keywordsToRetry.length > 0) {
                  const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
                  fetchWithRetry(`${INTERNAL_BASE_URL}/api/refresh?id=${keywordsToRetry.join(',')}`, fetchOpts)
                  .then((res) => res.json())
                  .then((refreshedData) => console.log(refreshedData))
                  .catch((fetchErr) => {
                     console.log('ERROR Making failed_queue Cron Request (after retries)..');
                     console.log(fetchErr);
                  });
               }
            } catch (error) {
               console.log('ERROR Reading Failed Scrapes Queue File..', error);
            }
         } else {
            console.log('ERROR Reading Failed Scrapes Queue File..', err);
         }
      });
   }, { scheduled: true });

   if (process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL) {
      const searchConsoleCRONTime = generateCronTime('daily');
      new Cron(searchConsoleCRONTime, () => {
         const fetchOpts = { method: 'POST', headers: { Authorization: `Bearer ${process.env.APIKEY}` } };
         fetchWithRetry(`${INTERNAL_BASE_URL}/api/searchconsole`, fetchOpts)
         .then((res) => res.json())
         .then((data) => console.log(data))
         .catch((err) => {
            console.log('ERROR Making Google Search Console Scraper Cron Request (after retries)..');
            console.log(err);
         });
      }, { scheduled: true });
   }
};

runAppCronJobs();
