import React from 'react';

type ScraperEnvInfoProps = {
   settings: SettingsType;
};

type EnvRow = {
   key: string;
   label: string;
   value: string;
   secret?: boolean;
};

const EnvBadge = ({ value }: { value: string }) => (
   <span
      style={{
         display: 'inline-block',
         padding: '1px 8px',
         borderRadius: 6,
         fontSize: 12,
         fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
         background: '#f4f4f5',
         color: '#18181b',
         border: '1px solid #e4e4e7',
      }}
   >
      {value || <em style={{ color: '#9f9fa9', fontStyle: 'normal' }}>not set</em>}
   </span>
);

const ScraperEnvInfo = ({ settings }: ScraperEnvInfoProps) => {
   const rows: EnvRow[] = [
      { key: 'SCRAPER_TYPE', label: 'Scraper Type', value: settings.scraper_type || 'none' },
      { key: 'SCRAPER_API_KEY', label: 'API Key / Token', value: settings.scaping_api || '', secret: true },
      { key: 'SCRAPE_INTERVAL', label: 'Scrape Frequency', value: settings.scrape_interval || 'daily' },
      { key: 'SCRAPE_DELAY', label: 'Keyword Delay (ms)', value: settings.scrape_delay || '0' },
      { key: 'SCRAPE_RETRY', label: 'Auto Retry Failed', value: settings.scrape_retry ? 'true' : 'false' },
      { key: 'SCRAPE_STRATEGY', label: 'Scrape Strategy', value: settings.scrape_strategy || 'basic' },
      { key: 'SCRAPE_PAGINATION_LIMIT', label: 'Pagination Limit', value: String(settings.scrape_pagination_limit ?? 5) },
      { key: 'SCRAPE_SMART_FULL_FALLBACK', label: 'Smart Full Fallback', value: settings.scrape_smart_full_fallback ? 'true' : 'false' },
   ];

   if (settings.scraper_type === 'proxy') {
      rows.splice(2, 0, { key: 'SCRAPER_PROXY', label: 'Proxy List', value: settings.proxy ? '(set)' : '', secret: true });
   }

   return (
      <div className="flex flex-col gap-base">
         <div
            style={{
               padding: '12px 16px',
               borderRadius: 10,
               background: '#fffbeb',
               border: '1px solid #fde68a',
               fontSize: 13,
               color: '#92400e',
               lineHeight: 1.5,
            }}
         >
            Scraper settings are now configured via environment variables in your <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>.env</code> file.
            Restart the server after any changes.
         </div>

         <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
               <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>
                     Variable
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>
                     Description
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9f9fa9', paddingBottom: 8, borderBottom: '1px solid #e4e4e7' }}>
                     Current value
                  </th>
               </tr>
            </thead>
            <tbody>
               {rows.map((row) => (
                  <tr key={row.key} style={{ borderBottom: '1px solid #f4f4f5' }}>
                     <td style={{ padding: '10px 0', fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#3f3f47', verticalAlign: 'middle', paddingRight: 16 }}>
                        {row.key}
                     </td>
                     <td style={{ padding: '10px 0', fontSize: 13, color: '#71717a', verticalAlign: 'middle', paddingRight: 16 }}>
                        {row.label}
                     </td>
                     <td style={{ padding: '10px 0', verticalAlign: 'middle' }}>
                        {row.secret && row.value
                           ? <EnvBadge value="••••••••" />
                           : <EnvBadge value={row.value} />
                        }
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
   );
};

export default ScraperEnvInfo;
