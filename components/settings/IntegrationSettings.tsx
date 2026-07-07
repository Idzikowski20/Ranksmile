import React from 'react';
import SearchConsoleSettings from './SearchConsoleSettings';

type IntegrationSettingsProps = {
  settings: SettingsType;
  settingsError: null | {
    type: string;
    msg: string;
  };
  updateSettings: Function;
  performUpdate: Function;
  closeSettings: Function;
  activeTab?: string;
};

const IntegrationSettings = ({ settings, settingsError, updateSettings, activeTab }: IntegrationSettingsProps) => {
  const currentTab = activeTab || 'searchconsole';

  return (
    <div style={{ width: '100%' }}>
      {currentTab === 'searchconsole' && settings && (
        <SearchConsoleSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />
      )}
    </div>
  );
};

export default IntegrationSettings;
