/* eslint-disable no-unused-vars */
type ScrapeStrategy = 'basic' | 'custom' | 'smart'

type DomainType = {
   ID: number,
   domain: string,
   slug: string,
   // Present on every row returned by GET /api/domains (Domain.workspace_id via
   // `.get({plain:true})`) — just wasn't declared here. Null for legacy domains
   // created before workspaces existed.
   workspace_id?: number | null,
   tags?: string,
   notification: boolean,
   notification_interval: string,
   notification_emails: string,
   lastUpdated: string,
   added: string,
   keywordCount?: number,
   keywordsUpdated?: string,
   avgPosition?: number,
   scVisits?: number,
   scImpressions?: number,
   scPosition?: number,
   search_console?: string,
   ideas_settings?: string,
   scrape_strategy?: ScrapeStrategy | '',
   scrape_pagination_limit?: number,
   scrape_smart_full_fallback?: boolean,
   subdomain_matching?: string,
   brand_voice?: string,
}

type KeywordHistory = {
   [date:string] : number
}

type KeywordType = {
   ID: number,
   keyword: string,
   device: string,
   country: string,
   domain: string,
   lastUpdated: string,
   added: string,
   position: number,
   volume: number,
   sticky: boolean,
   history: KeywordHistory,
   lastResult: KeywordLastResult[],
   url: string,
   tags: string[],
   updating: boolean,
   lastUpdateError: {date: string, error: string, scraper: string} | false,
   scData?: KeywordSCData,
   uid?: string
   city?: string
}

type KeywordLastResult = {
   position: number,
   url: string,
   title: string,
   skipped?: boolean
}

type KeywordFilters = {
   countries: string[],
   tags: string[],
   search: string,
}

type countryData = {
   [ISO:string] : [countryName:string, cityName:string, language:string, AdWordsID: number]
}

type countryCodeData = {
   [ISO:string] : string
}

type DomainSearchConsole = {
   property_type: 'domain' | 'url',
   url: string,
   client_email:string,
   private_key:string,
   auth_type?: 'oauth' | 'service_account',
   oauth_refresh_token?: string,
}

type DomainSettings = {
   notification_interval: string,
   notification_emails: string,
   search_console?: DomainSearchConsole,
   scrape_strategy?: ScrapeStrategy | '',
   scrape_pagination_limit?: number,
   scrape_smart_full_fallback?: boolean,
   subdomain_matching?: string,
   brand_voice?: string,
}

type SettingsType = {
   scraper_type: string,
   scaping_api?: string,
   proxy?: string,
   notification_interval: string,
   notification_email: string,
   notification_email_from: string,
   notification_email_from_name: string,
   smtp_server: string,
   smtp_port: string,
   smtp_username?: string,
   smtp_password?: string,
   available_scrapers?: { label: string, value: string, allowsCity?: boolean }[],
   scrape_interval?: string,
   scrape_delay?: string,
   scrape_retry?: boolean,
   scrape_strategy?: ScrapeStrategy,
   scrape_pagination_limit?: number,
   scrape_smart_full_fallback?: boolean,
   failed_queue?: string[]
   version?: string,
   screenshot_key?: string,
   search_console: boolean,
   search_console_client_email: string,
   search_console_private_key: string,
   search_console_integrated?: boolean,
   adwords_client_id?: string,
   adwords_client_secret?: string,
   adwords_refresh_token?: string,
   adwords_developer_token?: string,
   adwords_account_id?: string,
   keywordsColumns: string[]
}

type KeywordSCDataChild = {
   yesterday: number,
   threeDays: number,
   sevenDays: number,
   thirtyDays: number,
   avgSevenDays: number,
   avgThreeDays: number,
   avgThirtyDays: number,
}
type KeywordSCData = {
   impressions: KeywordSCDataChild,
   visits: KeywordSCDataChild,
   ctr: KeywordSCDataChild,
   position:KeywordSCDataChild
}

type KeywordAddPayload = {
   keyword: string,
   device: string,
   country: string,
   domain: string,
   tags?: string,
   city?:string
}

type SearchAnalyticsRawItem = {
   keys: string[],
   clicks: number,
   impressions: number,
   ctr: number,
   position: number,
}

type SearchAnalyticsStat = {
   date: string,
   clicks: number,
   impressions: number,
   ctr: number,
   position: number,
}

type InsightDataType = {
   stats: SearchAnalyticsStat[]|null,
   keywords: SCInsightItem[],
   countries: SCInsightItem[],
   pages: SCInsightItem[],
}

type SCInsightItem = {
   clicks: number,
   impressions: number,
   ctr: number,
   position: number,
   countries?: number,
   country?: string,
   keyword?: string,
   keywords?: number,
   page?: string,
   date?: string
}

type SearchAnalyticsItem = {
   keyword: string,
   uid: string,
   device: string,
   page: string,
   country: string,
   clicks: number,
   impressions: number,
   ctr: number,
   position: number,
   date?: string
}

type SCDomainDataType = {
   threeDays : SearchAnalyticsItem[],
   sevenDays : SearchAnalyticsItem[],
   thirtyDays : SearchAnalyticsItem[],
   selectedRange?: SearchAnalyticsItem[],
   previousRange?: SearchAnalyticsItem[],
   previousStats?: SearchAnalyticsStat[],
   selectedRangeStart?: string,
   selectedRangeEnd?: string,
   previousRangeStart?: string,
   previousRangeEnd?: string,
   lastFetched?: string,
   lastFetchError?: string,
   stats? : SearchAnalyticsStat[],
}

type SCKeywordType = SearchAnalyticsItem;

type DomainIdeasSettings = {
   seedSCKeywords: boolean,
   seedCurrentKeywords: boolean,
   seedDomain: boolean,
   language: string,
   countries: string[],
   keywords: string
}

type AdwordsCredentials = {
   client_id: string,
   client_secret: string,
   developer_token: string,
   account_id: string,
   refresh_token: string,
}

type IdeaKeyword = {
   uid: string,
   keyword: string,
   competition: 'UNSPECIFIED' | 'UNKNOWN' | 'HIGH' | 'LOW' | 'MEDIUM',
   country: string,
   domain: string,
   competitionIndex : number,
   monthlySearchVolumes: Record<string, string>,
   avgMonthlySearches: number,
   added: number,
   updated: number,
   position:number
}

type scraperExtractedItem = {
   title: string,
   url: string,
   position: number,
}
type ScraperPagination = {
   start: number,
   num: number,
   page: number,
}

interface ScraperSettings {
   /** A Unique ID for the Scraper. eg: myScraper */
   id:string,
   /** The Name of the Scraper */
   name:string,
   /** The Website address of the Scraper */
   website:string,
   /** The result object's key that contains the results of the scraped data. For example,
    * if your scraper API the data like this `{scraped:[item1,item2..]}` the resultObjectKey should be "scraped" */
   resultObjectKey: string,
   /** If the Scraper allows setting a precise location or allows city level scraping set this to true. */
   allowsCity?: boolean,
   /** Whether this scraper API handles its own pagination (e.g. num=100) and should bypass the app's pagination logic */
   nativePagination?: boolean,
   /** Set your own custom HTTP header properties when making the scraper API request.
    * The function should return an object that contains all the header properties you want to pass to API request's header.
    * Example: `{'Cache-Control': 'max-age=0', 'Content-Type': 'application/json'}` */
   headers?(keyword:KeywordType, settings: SettingsType): Object,
   /** Construct the API URL for scraping the data through your Scraper's API */
   scrapeURL?(keyword:KeywordType, settings:SettingsType, countries:countryData, pagination?: ScraperPagination): string,
   /** Custom function to extract the serp result from the scraped data. The extracted data should be @return {scraperExtractedItem[]} */
   serpExtractor?(content:string): scraperExtractedItem[],
}

// Neon Auth subpath declarations (needed because TypeScript 4.x doesn't resolve package exports)
declare module '@neondatabase/auth/next' {
   export function createAuthClient(): any;
}

declare module '@neondatabase/auth/next/server' {
   export function createNeonAuth(config: any): any;
   export function authApiHandler(config: any): any;
}

declare module '@neondatabase/auth/react' {
   import * as React from 'react';
   export const NeonAuthUIProvider: React.FC<any>;
   export const AuthView: React.FC<any>;
   export const AuthUIProvider: React.FC<any>;
   export function useAuthenticate(): any;
   export function useAuthData(): any;
   export const SignedIn: React.FC<any>;
   export const SignedOut: React.FC<any>;
   export const SignOut: React.FC<any>;
   export const UserButton: React.FC<any>;
   export const RedirectToSignIn: React.FC<any>;
   export const RedirectToSignUp: React.FC<any>;
}

// @tiptap/react exposes its menu components only under the "./menus" subpath of
// its package "exports" map, which TS node10 resolution can't read (same reason
// as the Neon shims above). Re-export the real types from the physical dist path
// so <BubbleMenu> stays fully typed. Webpack resolves the real subpath at runtime.
declare module '@tiptap/react/menus' {
   export { BubbleMenu, FloatingMenu } from '@tiptap/react/dist/menus';
   export type { BubbleMenuProps, FloatingMenuProps } from '@tiptap/react/dist/menus';
}

// react-date-range's package "exports" map exposes "./dist/locale" for the named
// locale objects (e.g. enUS) used by <DateRange locale={enUS} />, but @types/react-date-range
// doesn't declare that subpath — same node10-resolution gap as the shims above.
declare module 'react-date-range/dist/locale' {
   const locales: Record<string, any>;
   export default locales;
   export const enUS: any;
}
