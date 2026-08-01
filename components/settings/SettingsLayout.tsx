import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppShell from '../common/AppShell';
import SettingsNav, { type SettingsPageSlug } from './SettingsNav';
import AccountNotificationSettings from './AccountNotificationSettings';
import OrganizationGeneralSettings from './OrganizationGeneralSettings';
import PeopleSettings from './PeopleSettings';
import SearchConsoleSettings from './SearchConsoleSettings';
import SubscriptionSettings from './SubscriptionSettings';
import UsageSettings from './UsageSettings';
import BillingDetailsSettings from './BillingDetailsSettings';
import BillingHistorySettings from './BillingHistorySettings';
import WordPressSettings from './WordPressSettings';
import ApiSettings from './ApiSettings';
import ProfileSettings from './ProfileSettings';
import BrandKnowledgeSettings from './BrandKnowledgeSettings';
import CustomVoicesSettings from './CustomVoicesSettings';
import WorkspaceGeneralSettings from './WorkspaceGeneralSettings';
import WorkspaceMembersSettings from './WorkspaceMembersSettings';
import { useFetchSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';

export type { SettingsPageSlug } from './SettingsNav';

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
  billing_history: 'billing_invoices',
  invoices: 'billing_invoices',
};

const PAGE_TITLES: Record<SettingsPageSlug, string> = {
  general: 'General',
  people: 'People',
  brand_knowledge: 'Brand Knowledge',
  google_search_console: 'Search Console',
  wordpress: 'WordPress',
  api: 'API',
  billing_subscription: 'Subscription',
  billing_usage: 'Usage',
  billing_invoices: 'Billing History',
  billing_details: 'Payment methods',
  members: 'Members',
  workspace_general: 'Workspace',
  custom_voices: 'Custom Voices',
  profile: 'Account',
  notifications: 'Notifications',
  masterclass: 'Masterclass',
};

const PAGE_SUBTITLES: Partial<Record<SettingsPageSlug, string>> = {
  notifications: 'Manage notifications from Ranksmile or other organization members.',
  brand_knowledge: 'Manage what we know about your brand.',
  custom_voices: 'Manage Custom Voices for Content Editor, Humanizer, and Ranksmile AI.',
  billing_details: 'Manage your billing information and payment methods.',
  billing_subscription: 'View and change your Ranksmile plan.',
  billing_usage: 'See how your workspace is using plan limits.',
  billing_invoices: 'Track and manage your past invoices.',
  wordpress: 'Connect WordPress sites to publish from Ranksmile.',
  api: 'Scale your workflows with API access.',
  profile: 'Manage your Ranksmile profile and security.',
  general: 'Organization name and defaults.',
  people: 'Invite and manage organization members.',
  members: 'Manage workspace members and roles.',
  workspace_general: 'Workspace defaults for this project.',
  google_search_console: 'Connect Google Search Console for traffic data.',
};

type SettingsLayoutProps = {
  page: string;
};

export const normalizeSettingsPage = (page?: string): SettingsPageSlug => {
  if (!page) return 'profile';
  if (PAGE_ALIASES[page]) return PAGE_ALIASES[page];
  if (Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    return page as SettingsPageSlug;
  }
  return 'profile';
};

/**
 * Koala Settings shell — Figma `6343:27909`:
 * primary AppShell sidebar + secondary Settings nav + main content.
 */
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
        <div className="koala-settings-loading">Loading settings…</div>
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
    if (currentPage === 'billing_invoices') return <BillingHistorySettings />;
    if (currentPage === 'billing_details') return <BillingDetailsSettings />;
    if (currentPage === 'wordpress') return <WordPressSettings />;
    if (currentPage === 'api') return <ApiSettings />;
    if (currentPage === 'profile') return <ProfileSettings />;

    return <div className="koala-settings-loading">Coming soon</div>;
  };

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head>
        <title>{`${pageTitle} — Ranksmile`}</title>
      </Head>

      <div className="koala-settings-shell">
        <SettingsNav current={currentPage} />
        <div className="koala-settings-main styled-scrollbar">
          <header className="koala-settings-header">
            <h1 className="koala-settings-header__title">{pageTitle}</h1>
            {pageSubtitle ? (
              <p className="koala-settings-header__subtitle">{pageSubtitle}</p>
            ) : null}
          </header>
          <div className="koala-settings-body">
            {renderPageContent()}
            {settingsError?.msg ? (
              <div className="koala-settings-alert" role="alert">
                {settingsError.msg}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default SettingsLayout;
