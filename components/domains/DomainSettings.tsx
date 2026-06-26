import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { useDeleteDomain, useFetchDomain, useUpdateDomain } from '../../services/domains';
import InputField from '../common/InputField';
import SelectField, { SelectionOption } from '../common/SelectField';
import ToggleField from '../common/ToggleField';
import BlogPathsField from './BlogPathsField';

type DomainSettingsProps = {
   domain:DomainType|false,
   closeModal: Function
}

type DomainSettingsError = {
   type: string,
   msg: string,
}

const DomainSettings = ({ domain, closeModal }: DomainSettingsProps) => {
   const router = useRouter();
   const [currentTab, setCurrentTab] = useState<'notification'|'searchconsole'|'scraping'|'brandvoice'|'blogpaths'>('scraping');
   const [blogPaths, setBlogPaths] = useState<string[]>([]);
   const [savingBlogPaths, setSavingBlogPaths] = useState<boolean>(false);
   const domainSlug = domain && domain.slug ? domain.slug : '';
   const [showRemoveDomain, setShowRemoveDomain] = useState<boolean>(false);
   const [settingsError, setSettingsError] = useState<DomainSettingsError>({ type: '', msg: '' });
   const [domainSettings, setDomainSettings] = useState<DomainSettings>(() => ({
      notification_interval: domain && domain.notification_interval ? domain.notification_interval : 'never',
      notification_emails: domain && domain.notification_emails ? domain.notification_emails : '',
      search_console: domain && domain.search_console ? JSON.parse(domain.search_console) : {
         property_type: 'domain', url: '', client_email: '', private_key: '',
      },
      scrape_strategy: (domain && domain.scrape_strategy as ScrapeStrategy | '' | undefined) || '',
      scrape_pagination_limit: (domain && domain.scrape_pagination_limit) || 0,
      scrape_smart_full_fallback: (domain && domain.scrape_smart_full_fallback) || false,
      subdomain_matching: (domain && domain.subdomain_matching) || '',
      brand_voice: (domain && domain.brand_voice) || '',
   }));

   const { mutate: updateMutate, error: domainUpdateError, isLoading: isUpdating } = useUpdateDomain(() => closeModal(false));
   const { mutate: deleteMutate } = useDeleteDomain(() => { closeModal(false); router.push('/domains'); });

   // Get the Full Domain Data along with the Search Console API Data.
   useFetchDomain(router, domain && domain.domain ? domain.domain : '', (domainObj:DomainType) => {
      const currentSearchConsoleSettings = domainObj.search_console && JSON.parse(domainObj.search_console);
      setDomainSettings({ ...domainSettings, search_console: currentSearchConsoleSettings || domainSettings.search_console });
   });

   // Load the domain's blog paths on mount / slug change.
   useEffect(() => {
      if (!domainSlug) return;
      fetch(`/api/domains/blog-paths?slug=${encodeURIComponent(domainSlug)}`)
         .then((r) => (r.ok ? r.json() : { blogPaths: [] }))
         .then((d) => setBlogPaths(Array.isArray(d.blogPaths) ? d.blogPaths : []))
         .catch(() => setBlogPaths([]));
   }, [domainSlug]);

   const saveBlogPaths = async () => {
      if (!domainSlug || savingBlogPaths) return;
      setSavingBlogPaths(true);
      try {
         const r = await fetch('/api/domains/blog-paths', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: domainSlug, blogPaths }),
         });
         const d = r.ok ? await r.json() : null;
         if (d && Array.isArray(d.blogPaths)) setBlogPaths(d.blogPaths);
      } catch {
         // non-fatal — leave current state, user can retry
      } finally {
         setSavingBlogPaths(false);
      }
   };

   const updateDomain = () => {
      let error: DomainSettingsError | null = null;
      if (domainSettings.notification_emails) {
         const notification_emails = domainSettings.notification_emails.split(',');
         const invalidEmails = notification_emails.find((x) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,15})+$/.test(x) === false);
         console.log('invalidEmails: ', invalidEmails);
         if (invalidEmails) {
            error = { type: 'email', msg: 'Invalid Email' };
         }
      }
      if (error && error.type) {
         console.log('Error!!!!!');
         setSettingsError(error);
         setTimeout(() => {
            setSettingsError({ type: '', msg: '' });
         }, 3000);
      } else if (domain) {
            updateMutate({ domainSettings, domain });
         }
   };

   const tabStyle = `inline-block px-4 py-2 rounded-md mr-3 cursor-pointer text-sm select-none z-10
                     text-gray-600 border border-b-0 relative top-[1px] rounded-b-none`;
   const strategyOptions: SelectionOption[] = [
      { label: 'Use Global Setting', value: '' },
      { label: 'Basic (First page only — 10 results)', value: 'basic' },
      { label: 'Custom (Set number of pages)', value: 'custom' },
      { label: 'Smart (Based on last known position)', value: 'smart' },
   ];
   const paginationLimitOptions: SelectionOption[] = Array.from({ length: 10 }, (_, i) => (
      { label: `${i + 1} Page${i > 0 ? 's' : ''}`, value: String(i + 1) }
   ));
   return (
      <div>
         <Modal closeModal={() => closeModal(false)} title={'Domain Settings'} maxWidth={500} verticalCenter={currentTab === 'searchconsole'} >
            <div data-testid="domain_settings" className=" text-sm">
               <div className=' mt-3 mb-5 border  border-slate-200 px-2 py-4 pb-0
               relative left-[-20px] w-[calc(100%+40px)] border-l-0 border-r-0 bg-[#f8f9ff]'>
                  <ul>
                     <li
                     className={`${tabStyle} ${currentTab === 'scraping' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'}`}
                     onClick={() => setCurrentTab('scraping')}>
                        <Icon type='scraper' /> Scraping
                     </li>
                     <li
                     className={`${tabStyle} ${currentTab === 'notification' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'} `}
                     onClick={() => setCurrentTab('notification')}>
                       <Icon type='email' /> Notification
                     </li>
                     <li
                     className={`${tabStyle} ${currentTab === 'searchconsole' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'}`}
                     onClick={() => setCurrentTab('searchconsole')}>
                        <Icon type='google' /> Search Console
                     </li>
                     <li
                     className={`${tabStyle} ${currentTab === 'brandvoice' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'}`}
                     onClick={() => setCurrentTab('brandvoice')}>
                        ✍️ Brand Voice
                     </li>
                     <li
                     className={`${tabStyle} ${currentTab === 'blogpaths' ? ' bg-white text-blue-600 border-slate-200' : 'border-transparent'}`}
                     onClick={() => setCurrentTab('blogpaths')}>
                        📝 Blog Paths
                     </li>
                  </ul>
               </div>

               <div>
                  {currentTab === 'notification' && (
                     <div className="mb-4 flex justify-between items-center w-full">
                        <InputField
                        label='Notification Emails'
                        onChange={(emails:string) => setDomainSettings({ ...domainSettings, notification_emails: emails })}
                        value={domainSettings.notification_emails || ''}
                        placeholder='Your Emails'
                        />
                     </div>
                  )}
                  {currentTab === 'searchconsole' && (
                     <>
                        {/* OAuth2 connected state */}
                        {domainSettings.search_console?.auth_type === 'oauth' ? (
                           <div className="mb-6">
                              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                                 <span className="text-green-600 text-xl">✓</span>
                                 <div className="flex-1">
                                    <p className="font-semibold text-green-700 text-sm">Connected via Google OAuth</p>
                                    <p className="text-xs text-green-600">Search Console data is being fetched automatically.</p>
                                 </div>
                              </div>
                              <button
                                 className="text-sm text-red-500 font-semibold hover:text-red-700"
                                 onClick={() => setDomainSettings({
                                    ...domainSettings,
                                    search_console: {
                                       ...(domainSettings.search_console as DomainSearchConsole),
                                       auth_type: undefined,
                                       oauth_refresh_token: '',
                                    },
                                 })}
                              >
                                 Disconnect Google Account
                              </button>
                           </div>
                        ) : (
                           <>
                              {/* Connect with Google button */}
                              {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'false' && (
                                 <div className="mb-5">
                                    <a
                                       href={`/api/gsc/connect?domain=${encodeURIComponent((domain && domain.domain) || '')}`}
                                       className="flex items-center justify-center gap-2 w-full py-2 px-4 border border-gray-300 rounded-lg
                                       bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
                                    >
                                       <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                                          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                                          <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                                          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                                       </svg>
                                       Connect with Google Search Console
                                    </a>
                                 </div>
                              )}

                              {/* Divider */}
                              <div className="flex items-center gap-2 mb-4">
                                 <div className="flex-1 h-px bg-gray-200" />
                                 <span className="text-xs text-gray-400">or use Service Account</span>
                                 <div className="flex-1 h-px bg-gray-200" />
                              </div>

                              {/* Service Account fields */}
                              <div className="mb-4 flex justify-between items-center w-full">
                                 <label className='mb-2 font-semibold inline-block text-sm text-gray-700 capitalize'>Property Type</label>
                                 <SelectField
                                 options={[{ label: 'Domain', value: 'domain' }, { label: 'URL', value: 'url' }]}
                                 selected={[domainSettings.search_console?.property_type || 'domain']}
                                 defaultLabel="Select Search Console Property Type"
                                 updateField={(updated:['domain'|'url']) => setDomainSettings({
                                    ...domainSettings,
                                    search_console: { ...(domainSettings.search_console as DomainSearchConsole), property_type: updated[0] || 'domain' },
                                 })}
                                 multiple={false}
                                 rounded={'rounded'}
                                 />
                              </div>
                              {domainSettings?.search_console?.property_type === 'url' && (
                                 <div className="mb-4 flex justify-between items-center w-full">
                                    <InputField
                                    label='Property URL (Required)'
                                    onChange={(url:string) => setDomainSettings({
                                       ...domainSettings,
                                       search_console: { ...(domainSettings.search_console as DomainSearchConsole), url },
                                    })}
                                    value={domainSettings?.search_console?.url || ''}
                                    placeholder='Search Console Property URL. eg: https://mywebsite.com/'
                                    />
                                 </div>
                              )}
                              <div className="mb-4 flex justify-between items-center w-full">
                                 <InputField
                                 label='Client Email'
                                 onChange={(client_email:string) => setDomainSettings({
                                    ...domainSettings,
                                    search_console: { ...(domainSettings.search_console as DomainSearchConsole), client_email },
                                 })}
                                 value={domainSettings?.search_console?.client_email || ''}
                                 placeholder='myapp@appspot.gserviceaccount.com'
                                 />
                              </div>
                              <div className="mb-4 flex flex-col justify-between items-center w-full">
                                 <label className='mb-2 font-semibold block text-sm text-gray-700 capitalize w-full'>Private Key</label>
                                 <textarea
                                    className={`w-full p-2 border border-gray-200 rounded mb-3 text-xs
                                    focus:outline-none h-[100px] focus:border-blue-200`}
                                    value={domainSettings?.search_console?.private_key || ''}
                                    placeholder={'-----BEGIN PRIVATE KEY-----/ssssaswdkihad....'}
                                    onChange={(event) => setDomainSettings({
                                       ...domainSettings,
                                       search_console: { ...(domainSettings.search_console as DomainSearchConsole), private_key: event.target.value },
                                    })}
                                 />
                              </div>
                           </>
                        )}
                     </>
                  )}
                  {currentTab === 'scraping' && (
                     <div className="mb-4">
                        <div className="mb-4">
                           <InputField
                              label='Subdomain Matching'
                              onChange={(val:string) => setDomainSettings({ ...domainSettings, subdomain_matching: val })}
                              value={domainSettings.subdomain_matching || ''}
                              placeholder='amp, blog, * (comma separated)'
                           />
                        </div>
                        <div className="mb-5">
                           <SelectField
                              label='Scrape Strategy Override'
                              options={strategyOptions}
                              selected={[domainSettings.scrape_strategy || '']}
                              defaultLabel="Use Global Setting"
                              updateField={(updated:string[]) => {
                                 setDomainSettings({ ...domainSettings, scrape_strategy: (updated[0] || '') as ScrapeStrategy | '' });
                              }}
                              multiple={false}
                              rounded={'rounded'}
                              minWidth={220}
                           />
                        </div>
                        {domainSettings.scrape_strategy === 'custom' && (
                           <div className="mb-4">
                              <SelectField
                                 label='Number of Pages to Scrape'
                                 options={paginationLimitOptions}
                                 selected={[String(domainSettings.scrape_pagination_limit || 5)]}
                                 defaultLabel="Select Page Count"
                                 updateField={(updated:string[]) => {
                                    setDomainSettings({ ...domainSettings, scrape_pagination_limit: parseInt(updated[0] || '5', 10) });
                                 }}
                                 multiple={false}
                                 rounded={'rounded'}
                                 minWidth={220}
                              />
                              <small className='text-gray-500 pt-2 block'>Each page returns up to 10 results.</small>
                           </div>
                        )}
                        {domainSettings.scrape_strategy === 'smart' && (
                           <div className="mb-5">
                              <ToggleField
                                 label='Full Fallback: Scrape all pages if not found on nearby pages'
                                 value={!!domainSettings.scrape_smart_full_fallback}
                                 onChange={(val: boolean) => {
                                    setDomainSettings({ ...domainSettings, scrape_smart_full_fallback: val });
                                 }}
                              />
                              <small className='text-gray-500 pt-2 block'>
                                 When enabled, all 10 pages are scraped if the keyword is missing from its nearby pages.
                              </small>
                           </div>
                        )}
                     </div>
                  )}
                  {currentTab === 'brandvoice' && (
                     <div className="mb-4">
                        <label className='mb-1 font-semibold inline-block text-sm text-gray-700'>
                           Brand Voice
                        </label>
                        <p className='text-xs text-gray-400 mb-2'>
                           Describe your writing style, tone, target audience, and any rules the AI must follow.
                           This is injected into every AI prompt during auto-optimize.
                        </p>
                        <textarea
                           className='w-full border border-gray-200 rounded-md p-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 resize-none'
                           rows={5}
                           maxLength={2000}
                           placeholder='e.g. "Friendly but authoritative tone, targeting Polish small business owners. Avoid jargon. Use short sentences. Always recommend consulting a professional."'
                           value={domainSettings.brand_voice || ''}
                           onChange={(e) => setDomainSettings({ ...domainSettings, brand_voice: e.target.value })}
                        />
                        <p className='text-xs text-gray-400 text-right mt-1'>
                           {(domainSettings.brand_voice || '').length} / 2000
                        </p>
                     </div>
                  )}
                  {currentTab === 'blogpaths' && (
                     <div className="mb-4">
                        <label
                           className='mb-1 font-semibold inline-block text-sm'
                           style={{ color: '#18181B', fontFamily: 'var(--font-family-primary)' }}
                        >
                           Blog Paths
                        </label>
                        <p className='text-xs mb-3' style={{ color: '#52525C' }}>
                           Posts under these paths are audited for content quality. Add a path and press Enter.
                        </p>
                        <BlogPathsField value={blogPaths} onChange={setBlogPaths} />
                        <div className="mt-4">
                           <button
                              type="button"
                              className={`text-sm font-semibold py-2 px-5 rounded cursor-pointer bg-blue-700 text-white ${savingBlogPaths ? 'cursor-not-allowed opacity-70' : ''}`}
                              onClick={() => !savingBlogPaths && saveBlogPaths()}
                           >
                              {savingBlogPaths && <Icon type='loading' />} Save Blog Paths
                           </button>
                        </div>
                     </div>
                  )}
               </div>
               {!isUpdating && (domainUpdateError as Error)?.message && (
                  <div className='w-full mt-4 p-3 text-sm bg-red-50 text-red-700'>{(domainUpdateError as Error).message}</div>
               )}
               {!isUpdating && settingsError?.msg && (
                  <div className='w-full mt-4 p-3 text-sm bg-red-50 text-red-700'>{settingsError.msg}</div>
               )}
            </div>

            <div className="flex justify-between border-t-[1px] border-gray-100 mt-8 pt-4 pb-0">
               <button
               className="text-sm font-semibold text-red-500"
               onClick={() => setShowRemoveDomain(true)}>
                  <Icon type="trash" /> Remove Domain
               </button>
               <button
               className={`text-sm font-semibold py-2 px-5 rounded cursor-pointer bg-blue-700 text-white ${isUpdating ? 'cursor-not-allowed' : ''}`}
               onClick={() => !isUpdating && updateDomain()}>
                  {isUpdating && <Icon type='loading' />} Update Settings
               </button>
            </div>
         </Modal>
         {showRemoveDomain && domain && (
            <Modal closeModal={() => setShowRemoveDomain(false) } title={`Remove Domain ${domain.domain}`}>
               <div className='text-sm'>
                  <p>Are you sure you want to remove this Domain? Removing this domain will remove all its keywords.</p>
                  <div className='mt-6 text-right font-semibold'>
                     <button
                     className=' py-1 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3'
                     onClick={() => setShowRemoveDomain(false)}>
                        Cancel
                     </button>
                     <button
                     className=' py-1 px-5 rounded cursor-pointer bg-red-400 text-white'
                     onClick={() => deleteMutate(domain)}>
                        Remove

                     </button>
                  </div>
               </div>
            </Modal>
         )}
      </div>
   );
};

export default DomainSettings;
