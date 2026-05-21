import React from 'react';
import SearchConsoleSettings from './SearchConsoleSettings';
import AdWordsSettings from './AdWordsSettings';
import Icon from '../common/Icon';

type IntegrationSettingsProps = {
   settings: SettingsType,
   settingsError: null | {
      type: string,
      msg: string
   },
   updateSettings: Function,
   performUpdate: Function,
   closeSettings: Function,
   activeTab?: string,
}

const IntegrationSettings = ({ settings, settingsError, updateSettings, performUpdate, closeSettings, activeTab }: IntegrationSettingsProps) => {
   const currentTab = activeTab || 'searchconsole';

   // Only show tab switching when embedded in slide-out (no activeTab from sidebar)
   const showTabs = !activeTab;

   return (
      <div className='settings__content styled-scrollbar text-sm' style={{ padding: 0 }}>
         {showTabs && (
            <div className='mb-4'>
               <ul>
                  <li
                     className={`inline-block px-4 py-1 rounded-full mr-3 cursor-pointer text-sm ${currentTab === 'searchconsole' ? ' bg-blue-50 text-blue-600' : ''}`}
                     onClick={() => {}}>
                     <Icon type='google' size={14} /> Search Console
                  </li>
                  <li
                     className={`inline-block px-4 py-1 rounded-full mr-3 cursor-pointer text-sm ${currentTab === 'adwords' ? ' bg-blue-50 text-blue-600' : ''}`}
                     onClick={() => {}}>
                     <Icon type='adwords' size={14} /> Google Ads
                  </li>
               </ul>
            </div>
         )}
         <div>
            {currentTab === 'searchconsole' && settings && (
               <SearchConsoleSettings settings={settings} updateSettings={updateSettings} settingsError={settingsError} />
            )}
            {currentTab === 'adwords' && settings && (
               <AdWordsSettings
                  settings={settings}
                  updateSettings={updateSettings}
                  settingsError={settingsError}
                  performUpdate={performUpdate}
                  closeSettings={closeSettings}
               />
            )}
         </div>
      </div>
   );
};

export default IntegrationSettings;
