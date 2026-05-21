import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Toaster } from 'react-hot-toast';
import DashboardLayout from '../../components/common/DashboardLayout';
import Icon from '../../components/common/Icon';
import { useFetchSettings, useUpdateSettings } from '../../services/settings';
import { useFetchDomains } from '../../services/domains';
import ScraperSettings from '../../components/settings/ScraperSettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import IntegrationSettings from '../../components/settings/IntegrationSettings';

type SettingsError = {
  type: string;
  msg: string;
};

export const defaultSettings: SettingsType = {
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
};

const TABS = [
  { key: 'scraper', label: 'Scraper' },
  { key: 'notification', label: 'Notification' },
  { key: 'integrations', label: 'Integrations' },
] as const;

const SettingsPage: NextPage = () => {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<string>('scraper');
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [settingsError, setSettingsError] = useState<SettingsError | null>(null);

  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];
  const { data: appSettings, isLoading } = useFetchSettings();
  const { mutate: updateMutate, isLoading: isUpdating } = useUpdateSettings(() => {});

  useEffect(() => {
    if (appSettings && appSettings.settings) {
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
      scraper_type,
      smtp_port,
      smtp_server,
      scaping_api,
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

    if (scraper_type !== 'proxy' && scraper_type !== 'none' && !scaping_api) {
      error = { type: 'no_api_key', msg: 'Insert a Valid API Key or Token for the Scraper Service.' };
    }

    if (error) {
      setSettingsError(error);
      setTimeout(() => setSettingsError(null), 3000);
    } else {
      updateMutate(settings);
      if (appSettings?.settings === 'none' && scraper_type !== 'none') {
        window.location.reload();
      }
    }
  };

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>Settings — SerpBear</title></Head>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          background: '#fff',
        }}
        className="styled-scrollbar"
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 16px 24px',
          }}
        >
          {/* Page title */}
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: '28px',
              fontWeight: 600,
              color: '#2F2F34',
              fontFamily: 'var(--font-family-primary)',
              letterSpacing: 0,
              paddingBottom: 24,
            }}
          >
            Settings
          </h2>

          {/* Tab bar — SurferSEO style */}
          <div style={{ display: 'flex', gap: 4, paddingBottom: 24 }}>
            {TABS.map((tab) => {
              const isActive = currentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCurrentTab(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? '#2F2F34' : '#F4F4F5',
                    fontSize: 14,
                    lineHeight: '20px',
                    fontWeight: 600,
                    color: isActive ? '#fff' : '#3F3F47',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family-primary)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#E4E4E7';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Settings content card */}
          <div
            style={{
              border: '1px solid #E4E4E7',
              borderRadius: 12,
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content area */}
            <div
              className="styled-scrollbar"
              style={{
                maxHeight: 'calc(100vh - 340px)',
                overflow: 'auto',
                padding: 24,
              }}
            >
              {isLoading && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '64px 0',
                    color: '#9F9FA9',
                    fontSize: 14,
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Loading settings...
                </div>
              )}

              {!isLoading && currentTab === 'scraper' && settings && (
                <ScraperSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />
              )}

              {!isLoading && currentTab === 'notification' && settings && (
                <NotificationSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />
              )}

              {!isLoading && currentTab === 'integrations' && settings && (
                <IntegrationSettings
                  settings={settings}
                  updateSettings={updateSettings}
                  settingsError={settingsError}
                  performUpdate={performUpdate}
                  closeSettings={() => {}}
                  domains={domains}
                />
              )}
            </div>

            {/* Error banner */}
            {settingsError?.msg && (
              <div
                style={{
                  padding: '12px 24px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: 13,
                  lineHeight: '16px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-family-primary)',
                  borderTop: '1px solid #FECACA',
                }}
              >
                {settingsError.msg}
              </div>
            )}

            {/* Update button bar */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E4E4E7',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={performUpdate}
                disabled={isUpdating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: isUpdating ? '#A78BFA' : '#2F2F34',
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  color: '#fff',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-family-primary)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isUpdating) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#783AFB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUpdating) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34';
                  }
                }}
              >
                {isUpdating && <Icon type="loading" size={16} />}
                Update Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toaster position="bottom-center" containerClassName="react_toaster" />
    </DashboardLayout>
  );
};

export default SettingsPage;
