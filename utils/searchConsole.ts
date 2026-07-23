import { auth, searchconsole_v1 } from '@googleapis/searchconsole';
import Cryptr from 'cryptr';
import { countryAlphaTwoCodes, getCountryCodeFromAlphaThree } from './countries';
import GscAccount from '../database/models/gscAccount';
import db from '../database/database';
import { ensureGscDataTable } from '../lib/ensureGscDataTable';
import { readSettingsBlob } from '../lib/appSettingsStore';

export type SCDomainFetchError = {
   error: boolean,
   errorMsg: string,
}

type SCAPISettings = { client_email: string, private_key: string }
type SCOAuthSettings = { auth_type: 'oauth', refresh_token: string }
type SCAuthSettings = SCAPISettings | SCOAuthSettings
type SearchConsoleQueryOperator = 'contains' | 'equals' | 'notContains' | 'includingRegex' | 'excludingRegex'
type SearchConsoleQueryOptions = {
   startDate?: string,
   endDate?: string,
   country?: string,
   device?: string,
   keywordOperator?: SearchConsoleQueryOperator,
   keywordValue?: string,
}

function isOAuth(s: SCAuthSettings): s is SCOAuthSettings {
   return (s as SCOAuthSettings).auth_type === 'oauth';
}

export function hasValidSCAuth(s: SCAuthSettings): boolean {
   if (isOAuth(s)) return !!s.refresh_token;
   return !!(s.client_email && s.private_key);
}

type fetchConsoleDataResponse = SearchAnalyticsItem[] | SearchAnalyticsStat[] | SCDomainFetchError;

const alphaThreeByAlphaTwo = Object.entries(countryAlphaTwoCodes).reduce((acc, [alphaThree, alphaTwo]) => {
   acc[alphaTwo] = alphaThree;
   return acc;
}, {} as Record<string, string>);

const padDate = (num:number) => String(num).padStart(2, '0');

const toDateString = (value:Date) => `${value.getFullYear()}-${padDate(value.getMonth() + 1)}-${padDate(value.getDate())}`;

const parseDateString = (value:string) => {
   const [year, month, day] = value.split('-').map(Number);
   return new Date(year, month - 1, day, 12);
};

const getDateDaysAgo = (days:number) => {
   const now = new Date();
   return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12);
};

const getPreviousRange = (startDate:string, endDate:string) => {
   const start = parseDateString(startDate);
   const end = parseDateString(endDate);
   const rangeLength = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
   const previousEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 12);
   const previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate() - (rangeLength - 1), 12);

   return {
      previousRangeStart: toDateString(previousStart),
      previousRangeEnd: toDateString(previousEnd),
   };
};

const buildDimensionFilterGroups = (options?: SearchConsoleQueryOptions) => {
   if (!options) return undefined;
   const filters:any[] = [];

   if (options.country && options.country !== 'ALL') {
      const alphaThree = alphaThreeByAlphaTwo[options.country.toUpperCase()];
      if (alphaThree) {
         filters.push({ dimension: 'country', operator: 'equals', expression: alphaThree });
      }
   }

   if (options.device && options.device !== 'all') {
      filters.push({ dimension: 'device', operator: 'equals', expression: options.device.toUpperCase() });
   }

   if (options.keywordOperator && options.keywordValue?.trim()) {
      filters.push({
         dimension: 'query',
         operator: options.keywordOperator,
         expression: options.keywordValue.trim(),
      });
   }

   if (!filters.length) return undefined;

   return [{ groupType: 'and', filters }];
};

/**
 * Retrieves data from the Google Search Console API based on the provided domain name, number of days, and optional type.
 * @param {DomainType} domain - The domain for which you want to fetch search console data.
 * @param {number} days - number of days of data you want to fetch from the Search Console.
 * @param {string} [type] - (optional) specifies the type of data to fetch from the Search Console.
 * @param {SCAPISettings} [api] - (optional) specifies the Seach Console API Information.
 * @returns {Promise<fetchConsoleDataResponse>}
 */
const fetchSearchConsoleData = async (
   domain:DomainType,
   days:number,
   type?:string,
   api?:SCAuthSettings,
   options?: SearchConsoleQueryOptions,
): Promise<fetchConsoleDataResponse> => {
   if (!domain) return { error: true, errorMsg: 'Domain Not Provided!' };
   if (!api) return { error: true, errorMsg: 'Search Console API Data Not Available.' };
   if (!isOAuth(api) && (!api.private_key || !api.client_email)) return { error: true, errorMsg: 'Search Console API Data Not Available.' };
   const domainName = domain.domain;
   const defaultSCSettings = { property_type: 'domain', url: '', client_email: '', private_key: '' };
   const domainSettings = domain.search_console ? JSON.parse(domain.search_console) : defaultSCSettings;

   try {
   let authClient: any;
   if (isOAuth(api)) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const baseUrl = process.env.AUTH0_BASE_URL || 'http://localhost:3000';
      const oauth2 = new auth.OAuth2(clientId, clientSecret, `${baseUrl}/api/gsc/callback`);
      oauth2.setCredentials({ refresh_token: api.refresh_token });
      authClient = oauth2;
   } else {
      const sCPrivateKey = api.private_key || process.env.SEARCH_CONSOLE_PRIVATE_KEY || '';
      const sCClientEmail = api.client_email || process.env.SEARCH_CONSOLE_CLIENT_EMAIL || '';
      authClient = new auth.GoogleAuth({
         credentials: {
           private_key: (sCPrivateKey).replaceAll('\\n', '\n'),
           client_email: (sCClientEmail || '').trim(),
         },
         scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
   }
   const startDate = options?.startDate || toDateString(getDateDaysAgo(days));
   const endDate = options?.endDate || toDateString(getDateDaysAgo(0));
   const dimensionFilterGroups = buildDimensionFilterGroups(options);
   const client = new searchconsole_v1.Searchconsole({ auth: authClient });
   // Params: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
   let requestBody:any = {
      startDate,
      endDate,
      type: 'web',
      rowLimit: 25000,
      dataState: 'all',
      dimensions: ['query', 'device', 'country', 'page'],
      dimensionFilterGroups,
   };
   if (type === 'stat') {
      requestBody = {
         startDate,
         endDate,
         dataState: 'all',
         dimensions: ['date'],
         dimensionFilterGroups,
      };
   }
   if (type === 'dateQuery') {
      requestBody = {
         startDate,
         endDate,
         type: 'web',
         rowLimit: 25000,
         dataState: 'all',
         dimensions: ['date', 'query'],
         dimensionFilterGroups,
      };
   }

      const cleanDomain = domainName.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/+$/, '');
      const siteUrl = domainSettings.property_type === 'url' && domainSettings.url ? domainSettings.url : `sc-domain:${cleanDomain}`;
      const res = client.searchanalytics.query({ siteUrl, requestBody });
      const resData:any = (await res).data;
      let finalRows = resData.rows ? resData.rows.map((item:SearchAnalyticsRawItem) => parseSearchConsoleItem(item, domainName)) : [];

      if (type === 'stat' && resData.rows && resData.rows.length > 0) {
         // console.log(resData.rows);
         finalRows = [];
         resData.rows.forEach((row:SearchAnalyticsRawItem) => {
            finalRows.push({
               date: row.keys[0],
               clicks: row.clicks,
               impressions: row.impressions,
               ctr: row.ctr * 100,
               position: row.position,
            });
         });
      }

      if (type === 'dateQuery' && resData.rows && resData.rows.length > 0) {
         finalRows = resData.rows.map((row: SearchAnalyticsRawItem) => ({
            date: row.keys[0],
            keyword: row.keys[1] || '',
            clicks: row.clicks ?? 0,
            impressions: row.impressions ?? 0,
            ctr: (row.ctr ?? 0) * 100,
            position: row.position ?? 0,
         }));
      }

      return finalRows;
   } catch (err) {
      const e = err as { response?: { status?: number; statusText?: string; data?: { error_description?: string } }; code: string };
      const qType = type === 'stats' ? '(stats)' : `(${days}days)`;
      const errorMsg = e?.response?.status && `${e?.response?.statusText}. ${e?.response?.data?.error_description}`;
      console.log(`[ERROR] Search Console API Error for ${domainName} ${qType} : `, errorMsg || e?.code);
      // console.log('SC ERROR :', err);
      return { error: true, errorMsg: errorMsg || e?.code };
   }
};

/**
 * The function fetches search console data for a given domain and returns it in a structured format.
 * @param {DomainType} domain - The `domain` parameter is a Domain object that represents the domain for which we
 * want to fetch search console data.
 * @returns The function `fetchDomainSCData` is returning a Promise that resolves to an object of type
 * `SCDomainDataType`.
 */
export const fetchDomainSCData = async (
   domain:DomainType,
   scAPI?: SCAuthSettings,
   options?: SearchConsoleQueryOptions,
): Promise<SCDomainDataType> => {
   const days = [3, 7, 30];
   const scDomainData:SCDomainDataType = {
      threeDays: [],
      sevenDays: [],
      thirtyDays: [],
      selectedRange: [],
      previousRange: [],
      previousStats: [],
      lastFetched: '',
      lastFetchError: '',
      stats: [],
   };
   const hasAuth = scAPI && (isOAuth(scAPI) ? scAPI.refresh_token : (scAPI as SCAPISettings).private_key);
   if (domain.domain && hasAuth) {
      const theDomain = domain;
      const hasCustomQuery = !!(
         options?.startDate
         && options?.endDate
      );

      if (hasCustomQuery) {
         const previousRange = getPreviousRange(options.startDate as string, options.endDate as string);
         const currentOptions = {
            ...options,
            startDate: options.startDate,
            endDate: options.endDate,
         };
         const previousOptions = {
            ...options,
            startDate: previousRange.previousRangeStart,
            endDate: previousRange.previousRangeEnd,
         };

         const [selectedRange, previousSelectedRange, selectedStats, previousStats] = await Promise.all([
            fetchSearchConsoleData(theDomain, 0, undefined, scAPI, currentOptions),
            fetchSearchConsoleData(theDomain, 0, undefined, scAPI, previousOptions),
            fetchSearchConsoleData(theDomain, 0, 'stat', scAPI, currentOptions),
            fetchSearchConsoleData(theDomain, 0, 'stat', scAPI, previousOptions),
         ]);

         scDomainData.lastFetched = new Date().toJSON();
         scDomainData.selectedRangeStart = options.startDate;
         scDomainData.selectedRangeEnd = options.endDate;
         scDomainData.previousRangeStart = previousRange.previousRangeStart;
         scDomainData.previousRangeEnd = previousRange.previousRangeEnd;

         if (Array.isArray(selectedRange)) {
            scDomainData.selectedRange = selectedRange as SearchAnalyticsItem[];
         } else if (selectedRange.error) {
            scDomainData.lastFetchError = selectedRange.errorMsg;
         }

         if (Array.isArray(previousSelectedRange)) {
            scDomainData.previousRange = previousSelectedRange as SearchAnalyticsItem[];
         } else if (previousSelectedRange.error) {
            scDomainData.lastFetchError = previousSelectedRange.errorMsg;
         }

         if (Array.isArray(selectedStats)) {
            scDomainData.stats = selectedStats as SearchAnalyticsStat[];
         } else if (selectedStats.error) {
            scDomainData.lastFetchError = selectedStats.errorMsg;
         }

         if (Array.isArray(previousStats)) {
            scDomainData.previousStats = previousStats as SearchAnalyticsStat[];
         } else if (previousStats.error) {
            scDomainData.lastFetchError = previousStats.errorMsg;
         }

         return scDomainData;
      }

      for (const day of days) {
         const items = await fetchSearchConsoleData(theDomain, day, undefined, scAPI);
          scDomainData.lastFetched = new Date().toJSON();
         if (Array.isArray(items)) {
            if (day === 3) scDomainData.threeDays = items as SearchAnalyticsItem[];
            if (day === 7) scDomainData.sevenDays = items as SearchAnalyticsItem[];
            if (day === 30) scDomainData.thirtyDays = items as SearchAnalyticsItem[];
         } else if (items.error) {
            scDomainData.lastFetchError = items.errorMsg;
         }
      }
      const stats = await fetchSearchConsoleData(theDomain, 90, 'stat', scAPI);
      if (stats && Array.isArray(stats) && stats.length > 0) {
         scDomainData.stats = stats as SearchAnalyticsStat[];
      }
      await updateLocalSCData(domain.domain, scDomainData);
   }

   return scDomainData;
};

/**
 * The function takes a raw search console item and a domain name as input and returns a parsed search analytics item.
 * @param {SearchAnalyticsRawItem} SCItem - The SCItem parameter is an object that represents a raw item from the Search Console API.
 * @param {string} domainName - The `domainName` parameter is a string that represents the domain name of the website.
 * @returns {SearchAnalyticsItem}.
 */
export const parseSearchConsoleItem = (SCItem: SearchAnalyticsRawItem, domainName: string): SearchAnalyticsItem => {
   const { clicks = 0, impressions = 0, ctr = 0, position = 0 } = SCItem;
   const keyword = SCItem.keys[0];
   const device = SCItem.keys[1] ? SCItem.keys[1].toLowerCase() : 'desktop';
   const country = SCItem.keys[2] ? (getCountryCodeFromAlphaThree(SCItem.keys[2].toUpperCase()) || SCItem.keys[2]) : 'ZZ';
   const page = SCItem.keys[3] ? SCItem.keys[3].replace('https://', '').replace('http://', '').replace('www', '').replace(domainName, '') : '';
   const uid = `${country.toLowerCase()}:${device}:${keyword.replaceAll(' ', '_')}`;

   return { keyword, uid, device, country, clicks, impressions, ctr: ctr * 100, position, page };
};

/**
 * The function integrates search console data with a keyword object and returns the updated keyword object with the search console data.
 * @param {KeywordType} keyword - The `keyword` parameter is of type `KeywordType`, which is a custom type representing a keyword.
 * @param {SCDomainDataType} SCData - SCData is an object that contains search analytics data for different time periods
 * @returns {KeywordType}
 */
export const integrateKeywordSCData = (keyword: KeywordType, SCData:SCDomainDataType) : KeywordType => {
   const kuid = `${keyword.country.toLowerCase()}:${keyword.device}:${keyword.keyword.replaceAll(' ', '_')}`;
   const impressions:any = { yesterday: 0, threeDays: 0, sevenDays: 0, thirtyDays: 0, avgSevenDays: 0, avgThreeDays: 0, avgThirtyDays: 0 };
   const visits :any = { yesterday: 0, threeDays: 0, sevenDays: 0, thirtyDays: 0, avgSevenDays: 0, avgThreeDays: 0, avgThirtyDays: 0 };
   const ctr:any = { yesterday: 0, threeDays: 0, sevenDays: 0, thirtyDays: 0, avgSevenDays: 0, avgThreeDays: 0, avgThirtyDays: 0 };
   const position:any = { yesterday: 0, threeDays: 0, sevenDays: 0, thirtyDays: 0, avgSevenDays: 0, avgThreeDays: 0, avgThirtyDays: 0 };

   const threeDaysData = SCData?.threeDays?.find((item:SearchAnalyticsItem) => item.uid === kuid) || {};
   const SevenDaysData = SCData?.sevenDays?.find((item:SearchAnalyticsItem) => item.uid === kuid) || {};
   const ThirdyDaysData = SCData?.thirtyDays?.find((item:SearchAnalyticsItem) => item.uid === kuid) || {};
   const totalData:any = { threeDays: threeDaysData, sevenDays: SevenDaysData, thirtyDays: ThirdyDaysData };

   Object.keys(totalData).forEach((dataKey) => {
      let avgDataKey = 'avgThreeDays'; let divideBy = 3;
      if (dataKey === 'sevenDays') { avgDataKey = 'avgSevenDays'; divideBy = 7; }
      if (dataKey === 'thirtyDays') { avgDataKey = 'avgThirtyDays'; divideBy = 30; }
      // Actual Data
      impressions[dataKey] = totalData[dataKey].impressions || 0;
      visits[dataKey] = totalData[dataKey].clicks || 0;
      ctr[dataKey] = Math.round((totalData[dataKey].ctr || 0) * 100) / 100;
      position[dataKey] = totalData[dataKey].position ? Math.round(totalData[dataKey].position) : 0;
      // Average Data
      impressions[avgDataKey] = Math.round(impressions[dataKey] / divideBy);
      ctr[avgDataKey] = Math.round((ctr[dataKey] / divideBy) * 100) / 100;
      visits[avgDataKey] = Math.round(visits[dataKey] / divideBy);
      position[avgDataKey] = Math.round(position[dataKey] / divideBy);
   });
   const finalSCData = { impressions, visits, ctr, position };

   return { ...keyword, scData: finalSCData };
};

/**
 * Retrieves the Search Console API information for a given domain.
 * @param {DomainType} domain - The `domain` parameter is of type `DomainType`, which represents a
 * domain object. It likely contains information about a specific domain, such as its name, search
 * console settings, etc.
 * @returns an object of type `SCAPISettings`.
 */
export const getSearchConsoleApiInfo = async (domain: DomainType, userId?: string | null): Promise<SCAuthSettings> => {
   const cryptr = new Cryptr(process.env.SECRET as string);
   const domainSCSettings = domain.search_console && JSON.parse(domain.search_console);

   // 1. Per-user Neon Auth GSC account
   if (userId) {
      try {
         const account = await GscAccount.findOne({ where: { userId }, order: [['connected_at', 'DESC'], ['ID', 'DESC']] });
         if (account?.get) {
            const plain = account.get({ plain: true }) as { refresh_token?: string };
            if (plain.refresh_token) {
               return { auth_type: 'oauth', refresh_token: cryptr.decrypt(plain.refresh_token) };
            }
         }
      } catch { /* fall through */ }
   }

   // 2. Domain-level OAuth2 refresh token (legacy per-domain)
   if (domainSCSettings?.auth_type === 'oauth' && domainSCSettings?.oauth_refresh_token) {
      try {
         const refresh_token = cryptr.decrypt(domainSCSettings.oauth_refresh_token);
         return { auth_type: 'oauth', refresh_token };
      } catch { /* fall through to service account */ }
   }

   // 3. Service account — domain-level
   const scAPIData: SCAPISettings = { client_email: '', private_key: '' };
   if (domainSCSettings?.private_key) {
      if (!domainSCSettings.private_key.includes('BEGIN PRIVATE KEY')) {
         scAPIData.client_email = domainSCSettings.client_email ? cryptr.decrypt(domainSCSettings.client_email) : '';
         scAPIData.private_key = domainSCSettings.private_key ? cryptr.decrypt(domainSCSettings.private_key) : '';
      } else {
         scAPIData.client_email = domainSCSettings.client_email;
         scAPIData.private_key = domainSCSettings.private_key;
      }
   }

   // 4. Service account — global settings
   if (!scAPIData.private_key) {
      const settings = ((await readSettingsBlob()) as SettingsType | null) || ({} as SettingsType);
      scAPIData.client_email = settings.search_console_client_email ? cryptr.decrypt(settings.search_console_client_email) : '';
      scAPIData.private_key = settings.search_console_private_key ? cryptr.decrypt(settings.search_console_private_key) : '';
   }

   // 5. Service account — environment variables
   if (!scAPIData.private_key && process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL) {
      scAPIData.client_email = process.env.SEARCH_CONSOLE_CLIENT_EMAIL;
      scAPIData.private_key = process.env.SEARCH_CONSOLE_PRIVATE_KEY;
   }

   return scAPIData;
};

/**
 * Checks if the provided domain level Google Search Console API info is valid.
 * @param {DomainType} domain - The domain that represents the domain for which the SC API info is being checked.
 * @returns an object of type `{ isValid: boolean, error: string }`.
 */
export const checkSerchConsoleIntegration = async (domain: DomainType): Promise<{ isValid: boolean, error: string }> => {
   const res = { isValid: false, error: '' };
   const apiInfo = await getSearchConsoleApiInfo(domain);
   const response = await fetchSearchConsoleData(domain, 3, undefined, apiInfo);
   if (Array.isArray(response)) { res.isValid = true; }
   if ((response as SCDomainFetchError)?.errorMsg) { res.error = (response as SCDomainFetchError).errorMsg; }
   return res;
};

/**
 * The function reads and returns the domain-specific data stored in a local JSON file.
 * @param {string} domain - The `domain` parameter is a string that represents the domain for which the SC data is being read.
 * @returns {Promise<SCDomainDataType>}
 */
export const readLocalSCData = async (domain:string): Promise<SCDomainDataType|false> => {
   try {
      await ensureGscDataTable();
      const [rows] = await db.query('SELECT data FROM gsc_domain_data WHERE domain = ?', { replacements: [domain] });
      const row = (rows as Array<{ data: string }>)[0];
      if (!row) return { threeDays: [], sevenDays: [], thirtyDays: [], lastFetched: '', lastFetchError: '' };
      return JSON.parse(row.data);
   } catch (error) {
      return false;
   }
};

/**
 * The function reads and returns the domain-specific data stored in a local JSON file.
 * @param {string} domain - The `domain` parameter is a string that represents the domain for which the SC data will be written.
 * @param {SCDomainDataType} scDomainData - an object that contains search analytics data for different time periods.
 * @returns {Promise<SCDomainDataType|false>}
 */
export const updateLocalSCData = async (domain:string, scDomainData?:SCDomainDataType): Promise<SCDomainDataType|false> => {
   try {
      await ensureGscDataTable();
      const emptyData:SCDomainDataType = { threeDays: [], sevenDays: [], thirtyDays: [], lastFetched: '', lastFetchError: '' };
      const data = scDomainData || emptyData;
      // Upsert via delete+insert (dialect-agnostic; mirrors lib/gscSnapshots.ts).
      await db.query('DELETE FROM gsc_domain_data WHERE domain = ?', { replacements: [domain] });
      await db.query('INSERT INTO gsc_domain_data (domain, data) VALUES (?, ?)', { replacements: [domain, JSON.stringify(data)] });
      return data;
   } catch (error) {
      return false;
   }
};

/**
 * The function removes the domain-specific Seach Console data stored in a local JSON file.
 * @param {string} domain - The `domain` parameter is a string that represents the domain for which the SC data file will be removed.
 * @returns {Promise<boolean>} - Returns true if file was removed, else returns false.
 */
export const removeLocalSCData = async (domain:string): Promise<boolean> => {
   try {
      await ensureGscDataTable();
      await db.query('DELETE FROM gsc_domain_data WHERE domain = ?', { replacements: [domain] });
      return true;
   } catch (error) {
      return false;
   }
};

export { fetchSearchConsoleData };
export default fetchSearchConsoleData;
