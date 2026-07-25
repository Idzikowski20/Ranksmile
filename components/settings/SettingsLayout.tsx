import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppShell from '../common/AppShell';
import { SentryPage, SentryPageHeader } from '../sentry-pages';
import AccountNotificationSettings from './AccountNotificationSettings';
import OrganizationGeneralSettings from './OrganizationGeneralSettings';
import PeopleSettings from './PeopleSettings';
import SearchConsoleSettings from './SearchConsoleSettings';
import SubscriptionSettings from './SubscriptionSettings';
import UsageSettings from './UsageSettings';
import BillingDetailsSettings from './BillingDetailsSettings';
import WordPressSettings from './WordPressSettings';
import ApiSettings from './ApiSettings';
import ProfileSettings from './ProfileSettings';
import BrandKnowledgeSettings from './BrandKnowledgeSettings';
import CustomVoicesSettings from './CustomVoicesSettings';
import WorkspaceGeneralSettings from './WorkspaceGeneralSettings';
import WorkspaceMembersSettings from './WorkspaceMembersSettings';
import { useFetchSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';

export type SettingsPageSlug =
  | 'general'
  | 'people'
  | 'brand_knowledge'
  | 'google_search_console'
  | 'wordpress'
  | 'api'
  | 'billing_subscription'
  | 'billing_usage'
  | 'billing_invoices'
  | 'billing_details'
  | 'members'
  | 'workspace_general'
  | 'custom_voices'
  | 'profile'
  | 'notifications'
  | 'masterclass';

type SettingsError = {
  type: string;
  msg: string;
};

const PAGE_ALIASES: Record<string, SettingsPageSlug> = {
  scraper: 'google_search_console',
  notification: 'people',
  searchconsole: 'google_search_console',
  workspace_members: 'members',
  workspace_voices: 'custom_voices',
  account_profile: 'profile',
  account_notifications: 'notifications',
};

const PAGE_TITLES: Record<SettingsPageSlug, string> = {
  general: 'General',
  people: 'People',
  brand_knowledge: 'Brand Knowledge',
  google_search_console: 'Search Console',
  wordpress: 'WordPress',
  api: 'API',
  billing_subscription: 'Your subscription',
  billing_usage: 'Usage',
  billing_invoices: 'Invoices',
  billing_details: 'Billing details',
  members: 'Members',
  workspace_general: 'General',
  custom_voices: 'Custom Voices',
  profile: 'Profile',
  notifications: 'Notifications',
  masterclass: 'Masterclass',
};

const PAGE_SUBTITLES: Partial<Record<SettingsPageSlug, string>> = {
  notifications: 'Manage notifications from Ranksmile or other organization members',
  brand_knowledge: 'Manage what we know about your brand',
  custom_voices: 'Manage Custom Voices to be used in Content Editor, Humanizer, and Ranksmile AI',
  billing_details: 'Manage your billing information',
  wordpress: 'Interact with your WordPress domains straight from Ranksmile',
  api: 'Scale your workflows with powerful API access',
  profile: 'Manage your Ranksmile profile',
};

type SettingsLayoutProps = {
  page: string;
};

export const normalizeSettingsPage = (page?: string): SettingsPageSlug => {
  if (!page) return 'google_search_console';
  if (PAGE_ALIASES[page]) return PAGE_ALIASES[page];
  if (Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    return page as SettingsPageSlug;
  }
  return 'google_search_console';
};

const SettingsLayout = ({ page }: SettingsLayoutProps) => {
  const router = useRouter();
  const currentPage = normalizeSettingsPage(page);
  const pageTitle = PAGE_TITLES[currentPage] || 'Settings';
  const pageSubtitle = PAGE_SUBTITLES[currentPage];

  const [settings, setSettings] = useState<SettingsType>({
    scraper_type: 'none',
    scrape_delay: 'none',
    scrape_retry: false,
    notification_interval: 'daily',
    notification_email: '',
    smtp_server: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    notification_email_from: '',
    notification_email_from_name: 'Ranksmile',
    search_console: true,
    search_console_client_email: '',
    search_console_private_key: '',
    keywordsColumns: ['Best', 'Worst', 'History', 'Volume', 'Search Console'],
  });
  const [settingsError, setSettingsError] = useState<SettingsError | null>(null);

  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];
  const { data: appSettings, isLoading } = useFetchSettings();

  useEffect(() => {
    if (appSettings?.settings) {
      setSettings(appSettings.settings);
    }
  }, [appSettings]);

  const updateSettings = (key: string, value: string | number | boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const renderPageContent = () => {
    if (isLoading) {
      return (
        <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: '#6a6772' }}>
          Loading settings…
        </div>
      );
    }

    if (currentPage === 'general') return <OrganizationGeneralSettings />;
    if (currentPage === 'people') return <PeopleSettings />;
    if (currentPage === 'workspace_general') return <WorkspaceGeneralSettings />;
    if (currentPage === 'members') return <WorkspaceMembersSettings />;
    if (currentPage === 'brand_knowledge') return <BrandKnowledgeSettings />;
    if (currentPage === 'custom_voices') return <CustomVoicesSettings />;
    if (currentPage === 'notifications') return <AccountNotificationSettings />;
    if (currentPage === 'google_search_console') {
      return (
        <SearchConsoleSettings
          settings={settings}
          updateSettings={updateSettings}
          settingsError={settingsError}
        />
      );
    }
    if (currentPage === 'billing_subscription') return <SubscriptionSettings />;
    if (currentPage === 'billing_usage') return <UsageSettings />;
    if (currentPage === 'billing_details') return <BillingDetailsSettings />;
    if (currentPage === 'wordpress') return <WordPressSettings />;
    if (currentPage === 'api') return <ApiSettings />;
    if (currentPage === 'profile') return <ProfileSettings />;

    return (
      <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 14, color: '#6a6772' }}>
        Coming soon
      </div>
    );
  };

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{`${pageTitle} — Ranksmile`}</title>
      </Head>

      <SentryPage maxWidth={880} className="sentry-page--settings">
        <SentryPageHeader title={pageTitle} subtitle={pageSubtitle} borderless />
        <div className="sentry-settings-content">
          {renderPageContent()}
          {settingsError?.msg && (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #f5c6cb',
                background: '#fdf0f0',
                fontSize: 13,
                color: '#c62828',
              }}
            >
              {settingsError.msg}
            </div>
          )}
        </div>
      </SentryPage>
    </AppShell>
  );
};

export default SettingsLayout;
