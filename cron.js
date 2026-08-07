/* eslint-disable no-new */
const Cryptr = require('cryptr');
const { promises } = require('fs');
const { readFile } = require('fs');
const { Cron } = require('croner');
require('dotenv').config({ path: './.env.local' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function cronBearer() {
   const current = (process.env.CRON_SECRET_CURRENT || process.env.CRON_SECRET || '').trim();
   return current || null;
}

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

const cronOpts = (method) => {
   const bearer = cronBearer();
   if (!bearer) return null;
   return {
      method,
      headers: { Authorization: `Bearer ${bearer}` },
   };
};

const scheduleHttpJob = (expr, name, path, method = 'GET') => {
   new Cron(expr, () => {
      const fetchOpts = cronOpts(method);
      if (!fetchOpts) return;
      fetchWithRetry(`${INTERNAL_BASE_URL}${path}`, fetchOpts)
         .then((res) => res.json())
         .then((data) => console.log(`[cron] ${name}`, data))
         .catch((err) => {
            console.log(`ERROR Making ${name} Cron Request (after retries)..`);
            console.log(err);
         });
   }, { scheduled: true });
};

const runAppCronJobs = () => {
   const bearer = cronBearer();
   if (!bearer) {
      console.error('[cron] FATAL: CRON_SECRET or CRON_SECRET_CURRENT required');
      if (process.env.RAILWAY_ENVIRONMENT) process.exit(1);
      return;
   }

   // ── Platform jobs (SSOT) ───────────────────────────────────────────────
   scheduleHttpJob('0 0 8 * * *', 'daily', '/api/cron/daily');
   // Autopilot follow-up: daily seeds topic + deep-analysis, this tick writes the
   // article once the analysis lands (and restarts stalled/failed analyses).
   scheduleHttpJob('0 */10 * * * *', 'autopilot', '/api/cron/autopilot');
   scheduleHttpJob('0 0 9 * * *', 'rank-tracking', '/api/cron/rank-tracking');
   scheduleHttpJob('0 0 3 1 * *', 'rank-snapshots-retention', '/api/cron/rank-snapshots-retention');
   scheduleHttpJob('*/5 * * * *', 'plan-reservations', '/api/cron/plan-reservations');
   scheduleHttpJob('0 0 * * * *', 'stripe-billing-reconcile', '/api/cron/stripe-billing-reconcile');
   scheduleHttpJob('0 0 3 * * *', 'starter-nudge', '/api/cron/starter-nudge');
   scheduleHttpJob('0 30 */6 * * *', 'ccm-compile', '/api/cron/ccm-compile');

   // ── Legacy scrape / notify / failed_queue / GSC (now CRON_SECRET) ──────
   getAppSettings().then((settings) => {
      const scrape_interval = settings.scrape_interval || 'daily';
      if (scrape_interval !== 'never') {
         const scrapeCronTime = generateCronTime(scrape_interval);
         new Cron(scrapeCronTime, () => {
            const fetchOpts = cronOpts('POST');
            if (!fetchOpts) return;
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
               const fetchOpts = cronOpts('POST');
               if (!fetchOpts) return;
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
                  const fetchOpts = cronOpts('POST');
                  if (!fetchOpts) return;
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
         const fetchOpts = cronOpts('POST');
         if (!fetchOpts) return;
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
