import React, { useEffect, useState } from 'react';

type SearchConsoleSettingsProps = {
  settings?: SettingsType;
  settingsError?: null | {
    type: string;
    msg: string;
  };
  updateSettings?: Function;
};

type GscAccount = {
  id: number;
  userId: string;
  googleSub: string;
  email: string;
  picture: string;
  connectedAt: string;
  scopes: string;
};

const SearchConsoleSettings = (_props: SearchConsoleSettingsProps) => {
  const [accounts, setAccounts] = useState<GscAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const formatTimeAgo = (dateStr: string) => {
    const then = new Date(dateStr).getTime();
    if (!then) return '';
    const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Integrated today';
    if (diffDays === 1) return 'Integrated 1 day ago';
    return `Integrated ${diffDays} days ago`;
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gsc/accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch {
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/gsc/connect?redirect=/settings/google_search_console';
  };

  const handleDisconnect = async (accountId: number) => {
    setDisconnectingId(accountId);
    try {
      await fetch(`/api/gsc/accounts?id=${accountId}`, { method: 'DELETE' });
      await loadAccounts();
    } finally {
      setDisconnectingId(null);
    }
  };

  const addAccountLabel = accounts.length > 0 ? 'Add another Google Account' : 'Add Google Account';

  return (
    <div className="flex w-full flex-col items-start">
      <div className="gap-2xs flex flex-col">
        <span className="text-base font-semibold text-gray-140">Connect Google Search Console</span>
        <span className="text-md font-normal text-gray-140">
          Connect your Google Search Console with SerpBear to get accurate data about your domains
        </span>
      </div>

      <div role="separator" className="text-gray-20 min-h-[1px] min-w-[1px] self-stretch bg-gray-10 my-lg" />

      <div className="gap-base flex w-full grow flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[14px] text-gray-120">Loading accounts...</div>
        ) : (
          <div className="gap-base flex flex-col">
            {accounts.map((account) => (
              <div key={account.id} className="gap-base flex flex-col">
                <div className="flex items-center justify-between gap-base">
                  <div className="flex items-center">
                    <div className="mr-sm inline-block size-[36px] shrink-0 overflow-hidden rounded-full bg-gray-10">
                      <img
                        alt="Google Avatar"
                        className="max-h-full max-w-full rounded-[50%] object-cover"
                        src={account.picture || 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png'}
                      />
                    </div>
                    <div className="flex flex-col items-baseline">
                      <div className="notranslate pr-md text-md truncate font-medium text-gray-140">
                        {account.email || account.googleSub || 'Google Account'}
                      </div>
                      <span className="text-sm text-gray-100" suppressHydrationWarning>
                        {mounted ? formatTimeAgo(account.connectedAt) : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnectingId === account.id}
                    className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md rounded-none bg-transparent p-0 text-gray-140 hover:text-gray-120 active:text-gray-160 disabled:opacity-60"
                  >
                    <svg viewBox="0 0 20 20" width="1.2em" height="1.2em" className="inline-block shrink-0 align-sub text-inherit size-[20px]">
                      <path fill="currentColor" d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94z" />
                    </svg>
                    <span>{disconnectingId === account.id ? 'Disconnecting' : 'Disconnect'}</span>
                  </button>
                </div>

                <div role="separator" className="text-gray-20 min-h-[1px] min-w-[1px] self-stretch bg-gray-10" />
              </div>
            ))}
          </div>
        )}

        <div className="pt-lg flex w-full">
          <button
            type="button"
            onClick={handleConnect}
            className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100"
          >
            <svg width="1.2em" height="1.2em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block shrink-0 align-sub text-inherit size-[20px]">
              <g clipPath="url(#clip0)">
                <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
                <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
                <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
                <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
              </g>
              <defs>
                <clipPath id="clip0">
                  <rect width="15.6825" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span>{addAccountLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchConsoleSettings;
