import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import AppShell from '../common/AppShell';
import Icon from '../common/Icon';
import ScraperEnvInfo from './ScraperEnvInfo';
import NotificationSettings from './NotificationSettings';
import SearchConsoleSettings from './SearchConsoleSettings';
import AdWordsSettings from './AdWordsSettings';
import { useFetchSettings, useUpdateSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';

export type SettingsPageSlug =
  | 'general'
  | 'people'
  | 'google_search_console'
  | 'google_ads'
  | 'wordpress'
  | 'api'
  | 'billing_subscription'
  | 'billing_usage'
  | 'billing_invoices'
  | 'billing_details'
  | 'members'
  | 'custom_voices'
  | 'profile'
  | 'notifications'
  | 'masterclass';

type SettingsError = {
  type: string;
  msg: string;
};

const PAGE_ALIASES: Record<string, SettingsPageSlug> = {
  scraper: 'general',
  notification: 'people',
  searchconsole: 'google_search_console',
  adwords: 'google_ads',
  workspace_members: 'members',
  workspace_voices: 'custom_voices',
  account_profile: 'profile',
  account_notifications: 'notifications',
};

const PAGE_TITLES: Record<SettingsPageSlug, string> = {
  general: 'General',
  people: 'People',
  google_search_console: 'Search Console',
  google_ads: 'Google Ads',
  wordpress: 'WordPress',
  api: 'API',
  billing_subscription: 'Your subscription',
  billing_usage: 'Usage',
  billing_invoices: 'Invoices',
  billing_details: 'Billing details',
  members: 'Members',
  custom_voices: 'Custom Voices',
  profile: 'Profile',
  notifications: 'Notifications',
  masterclass: 'Masterclass',
};

const SIDEBAR_SECTIONS: Array<{ label: string; items: Array<{ slug: SettingsPageSlug; label: string }> }> = [
  {
    label: 'Billing',
    items: [
      { slug: 'billing_subscription', label: 'Your subscription' },
      { slug: 'billing_usage', label: 'Usage' },
      { slug: 'billing_invoices', label: 'Invoices' },
      { slug: 'billing_details', label: 'Billing details' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { slug: 'google_search_console', label: 'Search Console' },
      { slug: 'wordpress', label: 'WordPress' },
      { slug: 'api', label: 'API' },
    ],
  },
  {
    label: 'Your account',
    items: [
      { slug: 'profile', label: 'Profile' },
      { slug: 'notifications', label: 'Notifications' },
    ],
  },
];

type SettingsLayoutProps = {
  page: string;
};

export const normalizeSettingsPage = (page?: string): SettingsPageSlug => {
  if (!page) return 'google_search_console';
  if (PAGE_ALIASES[page]) return PAGE_ALIASES[page];
  if (Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    return page as SettingsPageSlug;
  }
  return 'general';
};

const SettingsLayout = ({ page }: SettingsLayoutProps) => {
  const router = useRouter();
  const currentPage = normalizeSettingsPage(page);
  const pageTitle = PAGE_TITLES[currentPage] || 'Settings';

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
    notification_email_from_name: 'SerpBear',
    search_console: true,
    search_console_client_email: '',
    search_console_private_key: '',
    keywordsColumns: ['Best', 'Worst', 'History', 'Volume', 'Search Console'],
  });
  const [settingsError, setSettingsError] = useState<SettingsError | null>(null);

  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];
  const { data: appSettings, isLoading } = useFetchSettings();
  const { mutate: updateMutate, isLoading: isUpdating } = useUpdateSettings(() => {});

  useEffect(() => {
    if (appSettings?.settings) {
      setSettings(appSettings.settings);
    }
  }, [appSettings]);

  const updateSettings = (key: string, value: string | number | boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const performUpdate = () => {
    let error: null | SettingsError = null;
    const {
      notification_interval,
      notification_email,
      notification_email_from,
      smtp_port,
      smtp_server,
    } = settings;

    if (notification_interval !== 'never') {
      if (!settings.notification_email) {
        error = { type: 'no_email', msg: 'Insert a Valid Email address' };
      }
      if (notification_email && (!smtp_port || !smtp_server || !notification_email_from)) {
        let type = 'no_smtp_from';
        if (!smtp_port) type = 'no_smtp_server';
        if (!smtp_server) type = 'no_smtp_server';
        error = { type, msg: 'Insert SMTP Server details that will be used to send the emails.' };
      }
    }

    if (error) {
      setSettingsError(error);
      setTimeout(() => setSettingsError(null), 3000);
      return;
    }

    updateMutate(settings);
    if (appSettings?.settings === 'none' && settings.scraper_type !== 'none') {
      window.location.reload();
    }
  };

  const settingsSidebar = (
    <aside className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden bg-[#09090B] text-white lg:border-r lg:border-white/10">
      <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-[100] bg-[#09090B] px-[8px] py-[24px]">
          <Link href="/dashboard" passHref>
            <a className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[14px] font-normal text-white/70 no-underline transition-colors hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Back to app</span>
            </a>
          </Link>
        </div>

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="flex w-full flex-col gap-[2px]">
            <div className="px-[16px] pb-2 pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">
                {section.label}
              </span>
            </div>

            {section.items.map((item) => {
              const isActive = currentPage === item.slug;
              return (
                <Link key={item.slug} href={`/settings/${item.slug}`} passHref>
                  <a
                    className={`mx-2 flex items-center rounded-md px-4 py-3 text-[14px] font-normal no-underline transition-colors ${
                      isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );

  const renderPageContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-[14px] text-gray-100">
          Loading settings...
        </div>
      );
    }

    if (currentPage === 'general') {
      return <ScraperEnvInfo settings={settings} />;
    }

    if (currentPage === 'people') {
      return <NotificationSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />;
    }

    if (currentPage === 'google_search_console') {
      return <SearchConsoleSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />;
    }

    if (currentPage === 'google_ads') {
      return <AdWordsSettings settings={settings} />;
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <span className="text-[14px] text-gray-100">Coming soon</span>
      </div>
    );
  };

  const showUpdateButton = currentPage === 'people';

  return (
    <AppShell
      domains={domains}
      showAddModal={() => {}}
      showSettings={() => {}}
      showSidebar={false}
      sidebar={settingsSidebar}
    >
      <Head>
        <title>{pageTitle} — SerpBear</title>
      </Head>

      <div className="relative flex-1 overflow-auto rounded-xl bg-white-base text-gray-140 [color-scheme:light] styled-scrollbar">
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '48px 16px',
          }}
        >
          <div
            style={{
              maxWidth: 880,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 48,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="gap-2xs flex flex-col">
                <span className="text-base font-semibold text-gray-140">{pageTitle}</span>
              </div>

              <div role="separator" className="text-gray-20 min-h-[1px] min-w-[1px] self-stretch bg-gray-10" />

              <div className="gap-base flex w-full grow flex-col">
                {renderPageContent()}
              </div>

              {settingsError?.msg && (
                <div className="mt-4 w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium leading-4 text-red-600">
                  {settingsError.msg}
                </div>
              )}

              {showUpdateButton && (
                <div className="pt-lg flex w-full justify-end">
                  <button
                    type="button"
                    onClick={performUpdate}
                    disabled={isUpdating}
                    className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100 disabled:opacity-60"
                  >
                    {isUpdating && <Icon type="loading" size={16} />}
                    Update Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toaster position="bottom-center" containerClassName="react_toaster" />
    </AppShell>
  );
};

export default SettingsLayout;
