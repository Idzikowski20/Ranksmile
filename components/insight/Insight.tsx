import React, { useState } from 'react';
import { sortInsightItems } from '../../utils/insight';
import SelectField from '../common/SelectField';
import InsightItem from './InsightItem';
import InsightStats from './InsightStats';

type SCInsightProps = {
   domain: DomainType | null,
   insight: InsightDataType,
   isLoading: boolean,
   isConsoleIntegrated: boolean,
}

const DATE_BUTTONS: { label: string; value: number; display: string }[] = [
   { label: '24h', value: 1, display: 'Last 24 Hours' },
   { label: '7 days', value: 7, display: 'Last 7 Days' },
   { label: '28 days', value: 28, display: 'Last 28 Days' },
   { label: '3 months', value: 90, display: 'Last 3 Months' },
];

const SCInsight = ({ insight, isLoading = true, isConsoleIntegrated = true, domain }: SCInsightProps) => {
   const [activeTab, setActiveTab] = useState<string>('stats');
   const [dateRange, setDateRange] = useState<number>(90);

   const insightItems = insight[activeTab as keyof InsightDataType];
   const allStats = insight?.stats || [];
   const visibleStats = allStats.slice(-dateRange);
   const startDate = visibleStats.length > 0 ? new Date(visibleStats[0].date) : null;
   const endDate = visibleStats.length > 0 ? new Date(visibleStats[visibleStats.length - 1].date) : null;
   const dateLabel = DATE_BUTTONS.find(b => b.value === dateRange)?.display || 'Last 30 Days';

   const switchTab = (tab: string) => {
      setActiveTab(tab);
   };

   const renderTableHeader = () => {
      const headerNames: {[key:string]: string[]} = {
         stats: ['Date', 'Avg Position', 'Visits', 'Impressions', 'CTR'],
         keywords: ['Keyword', 'Avg Position', 'Visits ↑', 'Impressions', 'CTR', 'Countries'],
         countries: ['Country', 'Avg Position', 'Visits ↑', 'Impressions', 'CTR', 'Keywords'],
         pages: ['Page', 'Avg Position', 'Visits ↑', 'Impressions', 'CTR', 'Countries', 'Keywords'],
      };

      return (
         <div className={`domKeywords_head hidden lg:flex p-3 px-6 bg-[#FCFCFF]
            text-gray-600 justify-between items-center font-semibold border-y`}>
            <span className='domKeywords_head_keyword flex-1 basis-20 w-auto '>{headerNames[activeTab][0]}</span>
            <span className='domKeywords_head_position flex-1 basis-40 grow-0 text-center'>{headerNames[activeTab][1]}</span>
            <span className='domKeywords_head_imp flex-1 text-center'>{headerNames[activeTab][2]}</span>
            <span className='domKeywords_head_visits flex-1 text-center'>{headerNames[activeTab][3]}</span>
            <span className='domKeywords_head_ctr flex-1 text-center'>{headerNames[activeTab][4]}</span>
            {headerNames[activeTab][5] && <span className='domKeywords_head_ctr flex-1 text-center'>{headerNames[activeTab][5]}</span>}
            {headerNames[activeTab][6] && <span className='domKeywords_head_ctr flex-1 text-center'>{headerNames[activeTab][6]}</span>}
         </div>
      );
   };

   const deviceTabStyle = 'select-none cursor-pointer px-3 py-2 rounded-3xl mr-2';
   const deviceTabCountStyle = 'px-2 py-0 rounded-3xl bg-[#DEE1FC] text-[0.7rem] font-bold ml-1';

   return (
      <div>
         <div className='domKeywords flex flex-col bg-[white] rounded-md text-sm border mb-5'>
            <div className='domKeywords_filters py-4 px-6 flex flex-col justify-between
            text-sm text-gray-500 font-semibold border-b-[1px] lg:border-0 lg:flex-row'>
               <div>
                  <ul className='text-xs hidden lg:flex'>
                     {['stats', 'keywords', 'countries', 'pages'].map((tabItem) => {
                        const tabInsightItem = insight[tabItem as keyof InsightDataType];
                        return <li
                        key={`tab-${tabItem}`}
                        className={`${deviceTabStyle} ${activeTab === tabItem ? ' bg-[#F8F9FF] text-gray-700' : ''}`}
                        onClick={() => switchTab(tabItem)}>
                              <i className='hidden not-italic lg:inline-block ml-1 capitalize'>{tabItem}</i>
                              {tabItem !== 'stats' && (
                                 <span className={`${deviceTabCountStyle}`}>
                                    {tabInsightItem && tabInsightItem.length ? tabInsightItem.length : 0}
                                 </span>
                              )}
                        </li>;
                     })}
                  </ul>
                  <div className='insight_selector lg:hidden'>
                     <SelectField
                     options={['stats', 'keywords', 'countries', 'pages'].map((d) => { return { label: d, value: d }; })}
                     selected={[activeTab]}
                     defaultLabel="Select Tab"
                     updateField={(updatedTab:[string]) => switchTab(updatedTab[0])}
                     multiple={false}
                     rounded={'rounded'}
                     />
                  </div>
               </div>
               {isConsoleIntegrated && (
                  <div className='flex flex-col lg:flex-row items-end lg:items-center gap-3 mt-2 lg:mt-0'>
                     {/* GSC-style connected pill group */}
                     <div className="inline-flex rounded-full border border-gray-200 overflow-hidden" style={{ height: 32 }}>
                        {DATE_BUTTONS.map((btn, idx) => {
                           const isActive = dateRange === btn.value;
                           return (
                              <button
                                 key={btn.value}
                                 onClick={() => setDateRange(btn.value)}
                                 className="relative flex items-center gap-1 px-4 text-xs font-medium transition-colors focus:outline-none select-none"
                                 style={{
                                    backgroundColor: isActive ? '#c2e7ff' : 'white',
                                    color: isActive ? '#004a77' : '#444746',
                                    borderRight: idx < DATE_BUTTONS.length - 1 ? '1px solid #e0e0e0' : 'none',
                                 }}
                              >
                                 {isActive && (
                                    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                                       <path d="M3 9.23529L6.84 13L15 5" stroke="#004a77" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                 )}
                                 {btn.label}
                              </button>
                           );
                        })}
                     </div>
                     {/* Dynamic date range display */}
                     <div className='py-1 text-xs text-gray-500'>
                        {startDate && new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(startDate)}
                        <span className='px-1 inline-block'>–</span>
                        {endDate && new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(endDate)}
                        <span className='ml-1 text-gray-400'>({dateLabel})</span>
                     </div>
                  </div>
               )}
            </div>
            {isConsoleIntegrated && activeTab === 'stats' && (
               <InsightStats
               stats={insight?.stats ? insight.stats : []}
               totalKeywords={insight?.keywords?.length || 0}
               totalCountries={insight?.countries?.length || 0}
               totalPages={insight?.pages?.length || 0}
               dateRange={dateRange}
               />
            )}

            <div className='domkeywordsTable domkeywordsTable--sckeywords styled-scrollbar w-full overflow-auto min-h-[60vh]'>
               <div className=' lg:min-w-[800px]'>
                  {renderTableHeader()}
                  <div className='domKeywords_keywords border-gray-200 min-h-[55vh] relative'>
                     {['keywords', 'pages', 'countries', 'stats'].includes(activeTab) && insight && insightItems
                           && (activeTab === 'stats' ? [...insightItems].reverse() : sortInsightItems(insightItems)).map(
                              (item:SCInsightItem, index: number) => {
                              const insightItemCount = insight ? insightItems : [];
                              const lastItem = !!(insightItemCount && (index === insightItemCount.length));
                              return <InsightItem key={index} item={item} type={activeTab} lastItem={lastItem} domain={domain?.domain || ''} />;
                           },
                        )
                     }
                     {isConsoleIntegrated && isLoading && (
                        <p className=' p-9 pt-[10%] text-center text-gray-500'>Loading Insight...</p>
                     )}
                     {!isConsoleIntegrated && (
                        <p className=' p-9 pt-[10%] text-center text-gray-500'>
                        Google Search Console has not been Integrated yet. Please follow <a className='text-indigo-600 underline' href='https://docs.serpbear.com/miscellaneous/integrate-google-search-console' target="_blank" rel='noreferrer'>These Steps</a> to integrate Google Search Data for this Domain.
                        </p>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
 };

 export default SCInsight;
