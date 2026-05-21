import { useRouter } from 'next/router';
import React, { useState, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { useAddKeywords, useFetchKeywords } from '../../services/keywords';
import { SCfilterKeywords, SCkeywordsByDevice, SCsortKeywords } from '../../utils/client/SCsortFilter';
import Icon from '../common/Icon';
import KeywordFilters from './KeywordFilter';
import SCKeyword from './SCKeyword';
import useWindowResize from '../../hooks/useWindowResize';
import useIsMobile from '../../hooks/useIsMobile';
import { formattedNum } from '../../utils/client/helpers';

type SCKeywordsTableProps = {
   domain: DomainType | null,
   keywords: SearchAnalyticsItem[],
   isLoading: boolean,
   isConsoleIntegrated: boolean,
}

type SCCountryDataType = {
   keywords: number,
   impressions: number,
   visits: number
}

const SCKeywordsTable = ({ domain, keywords = [], isLoading = true, isConsoleIntegrated = true }: SCKeywordsTableProps) => {
   const router = useRouter();
   const [device, setDevice] = useState<string>('desktop');
   const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
   const [filterParams, setFilterParams] = useState<KeywordFilters>({ countries: [], tags: [], search: '' });
   const [sortBy, setSortBy] = useState<string>('imp_desc');
   const [SCListHeight, setSCListHeight] = useState(500);
   const { keywordsData } = useFetchKeywords(router, domain?.domain || '');
   const addedkeywords: string[] = keywordsData?.keywords?.map((key: KeywordType) => `${key.keyword}:${key.country}:${key.device}`) || [];
   const { mutate: addKeywords } = useAddKeywords(() => { if (domain && domain.slug) router.push(`/domain/${domain.slug}`); });
   const [isMobile] = useIsMobile();
   useWindowResize(() => setSCListHeight(window.innerHeight - (isMobile ? 200 : 400)));

   const finalKeywords: {[key:string] : SCKeywordType[] } = useMemo(() => {
      const procKeywords = keywords.filter((x) => x.device === device);
      const filteredKeywords = SCfilterKeywords(procKeywords, filterParams);
      const sortedKeywords = SCsortKeywords(filteredKeywords, sortBy);
      return SCkeywordsByDevice(sortedKeywords, device);
   }, [keywords, device, filterParams, sortBy]);

   const SCCountryData: {[key:string] : SCCountryDataType } = useMemo(() => {
      const countryData:{[key:string] : SCCountryDataType } = {};

      Object.keys(finalKeywords).forEach((dateKey) => {
         finalKeywords[dateKey].forEach((keyword) => {
            const kCountry = keyword.country;
            if (!countryData[kCountry]) { countryData[kCountry] = { keywords: 0, impressions: 0, visits: 0 }; }
            countryData[kCountry].keywords += 1;
            countryData[kCountry].visits += (keyword.clicks || 0);
            countryData[kCountry].impressions += (keyword.impressions || 0);
         });
      });

      return countryData;
   }, [finalKeywords]);

   const viewSummary: {[key:string] : number } = useMemo(() => {
         const keyCount = finalKeywords[device].length;
         const kwSummary = { position: 0, impressions: 0, visits: 0, ctr: 0 };
         finalKeywords[device].forEach((k) => {
            kwSummary.position += k.position;
            kwSummary.impressions += k.impressions;
            kwSummary.visits += k.clicks;
            kwSummary.ctr += k.ctr;
         });
         return {
            ...kwSummary,
            position: Math.round(kwSummary.position / keyCount),
            ctr: kwSummary.ctr / keyCount,
         };
   }, [finalKeywords, device]);

   const selectKeyword = (keywordID: string) => {
      console.log('Select Keyword: ', keywordID);
      let updatedSelectd = [...selectedKeywords, keywordID];
      if (selectedKeywords.includes(keywordID)) {
         updatedSelectd = selectedKeywords.filter((keyID) => keyID !== keywordID);
      }
      setSelectedKeywords(updatedSelectd);
   };

   const addSCKeywordsToTracker = () => {
      const selectedkeywords:KeywordAddPayload[] = [];
      keywords.forEach((kitem:SCKeywordType) => {
         if (selectedKeywords.includes(kitem.uid)) {
            const { keyword, country } = kitem;
            selectedkeywords.push({ keyword, device, country, domain: domain?.domain || '', tags: '' });
         }
      });
      addKeywords(selectedkeywords);
      setSelectedKeywords([]);
   };

   const selectedAllItems = selectedKeywords.length === finalKeywords[device].length;

   const Row = ({ data, index, style }:ListChildComponentProps) => {
      const keyword = data[index];
      return (
         <SCKeyword
         key={keyword.uid}
         style={style}
         selected={selectedKeywords.includes(keyword.uid)}
         selectKeyword={selectKeyword}
         keywordData={keyword}
         isTracked={addedkeywords.includes(`${keyword.keyword}:${keyword.country}:${keyword.device}`)}
         lastItem={index === (finalKeywords[device].length - 1)}
         />
   );
};

   return (
      <div>
         <div className='domKeywords flex flex-col bg-[white] rounded-md text-sm border mb-4'>
            {selectedKeywords.length > 0 && (
               <div className='font-semibold text-sm py-4 px-8 text-gray-500 '>
                  <ul className=''>
                     <li className='inline-block mr-4'>
                        <a
                        className='block px-2 py-2 cursor-pointer hover:text-indigo-600'
                        onClick={() => addSCKeywordsToTracker()}
                        >
                           <span className=' bg-indigo-100 text-blue-700 px-1 rounded font-black'>+</span> Add Keywords to Tracker
                        </a>
                     </li>
                  </ul>
               </div>
            )}
            {selectedKeywords.length === 0 && (
               <KeywordFilters
                  allTags={[]}
                  filterParams={filterParams}
                  filterKeywords={(params:KeywordFilters) => setFilterParams(params)}
                  updateSort={(sorted:string) => setSortBy(sorted)}
                  sortBy={sortBy}
                  keywords={keywords}
                  device={device}
                  setDevice={setDevice}
                  isConsole={true}
                  integratedConsole={isConsoleIntegrated}
                  SCcountries={Object.keys(SCCountryData)}
               />
            )}
            <div className='domkeywordsTable domkeywordsTable--sckeywords styled-scrollbar w-full overflow-auto min-h-[60vh]'>
               <div className=' lg:min-w-[800px]'>
                  <div className={`domKeywords_head domKeywords_head--${sortBy} hidden lg:flex p-3 px-6 bg-[#FCFCFF]
                   text-gray-600 justify-between items-center font-semibold border-y`}>
                     <span className='domKeywords_head_keyword flex-1 basis-20 w-auto '>
                     {finalKeywords[device].length > 0 && (
                        <button
                           className={`inline-flex items-center justify-center p-0 mr-2 rounded-sm w-[18px] h-[18px] border border-slate-300
                           ${selectedAllItems ? ' bg-black border-black text-white' : 'text-transparent'}`}
                           onClick={() => setSelectedKeywords(selectedAllItems ? [] : finalKeywords[device].map((k: SearchAnalyticsItem) => k.uid))}
                           >
                              <Icon type="check" size={10} />
                        </button>
                     )}
                        Keyword
                     </span>
                     <span className='domKeywords_head_position flex-1 basis-40 grow-0 text-center'>Position</span>
                     <span className='domKeywords_head_imp flex-1 text-center'>Impressions</span>
                     <span className='domKeywords_head_visits flex-1 text-center'>Visits</span>
                     <span className='domKeywords_head_ctr flex-1 text-center'>CTR</span>
                  </div>
                  <div className='domKeywords_keywords border-gray-200 min-h-[55vh] relative' data-domain={domain?.domain}>
                     {!isLoading && finalKeywords[device] && finalKeywords[device].length > 0 && (
                        <List
                        innerElementType="div"
                        itemData={finalKeywords[device]}
                        itemCount={finalKeywords[device].length}
                        itemSize={isMobile ? 100 : 57}
                        height={SCListHeight}
                        width={'100%'}
                        className={'styled-scrollbar'}
                        >
                           {Row}
                        </List>
                     )}
                     {!isLoading && finalKeywords[device] && finalKeywords[device].length > 0 && (
                        <div className={`domKeywords_head hidden lg:flex p-3 px-6 bg-[#FCFCFF]
                           text-gray-600 justify-between items-center font-semibold border-y`}>
                              <span className='domKeywords_head_keyword flex-1 basis-20 w-auto font-semibold'>
                                 {finalKeywords[device].length} {device} Keywords
                              </span>
                              <span className='domKeywords_head_position flex-1 basis-40 grow-0 text-center'>{viewSummary.position}</span>
                              <span className='domKeywords_head_imp flex-1 text-center'>
                                 {formattedNum(viewSummary.impressions)}
                              </span>
                              <span className='domKeywords_head_visits flex-1 text-center'>
                                 {formattedNum(viewSummary.visits)}
                              </span>
                              <span className='domKeywords_head_ctr flex-1 text-center'>
                                 {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(viewSummary.ctr)}%
                              </span>
                        </div>
                     )}
                     {isConsoleIntegrated && !isLoading && finalKeywords[device].length === 0 && (
                        <div className='p-9 pt-[10%] text-center text-gray-500'>
                           <p className='mb-4'>Could Not fetch Keyword Data for this Domain from Google Search Console.</p>
                           <a
                              href={`/api/gsc/connect?domain=${encodeURIComponent(domain?.domain || '')}`}
                              className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg
                              bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
                           >
                              <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                 <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                                 <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                                 <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                                 <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                              </svg>
                              Reconnect Google Search Console
                           </a>
                        </div>
                     )}
                     {isConsoleIntegrated && isLoading && (
                        <p className=' p-9 pt-[10%] text-center text-gray-500'>Loading Keywords...</p>
                     )}
                     {!isConsoleIntegrated && (
                        <div className='p-9 pt-[10%] text-center text-gray-500'>
                           <p className='mb-4'>Google Search Console has not been connected yet.</p>
                           <a
                              href={`/api/gsc/connect?domain=${encodeURIComponent(domain?.domain || '')}`}
                              className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg
                              bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
                           >
                              <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                 <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                                 <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                                 <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                                 <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                              </svg>
                              Connect with Google Search Console
                           </a>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
         <Toaster position='bottom-center' containerClassName="react_toaster" />
      </div>
   );
 };

 export default SCKeywordsTable;
