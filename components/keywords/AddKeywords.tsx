import React, { useCallback, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import SelectField from '../common/SelectField';
import countries from '../../utils/countries';
import { useAddKeywords } from '../../services/keywords';

type AddKeywordsProps = {
   keywords: KeywordType[],
   scraperName: string,
   allowsCity: boolean,
   closeModal: Function,
   domain: string
}

type KeywordsInput = {
   keywords: string,
   device: string,
   country: string,
   domain: string,
   tags: string,
   city?:string,
}

const inputBaseStyle: React.CSSProperties = {
   width: '100%',
   border: '1px solid #D4D4D8',
   borderRadius: 8,
   padding: '8px 12px',
   outline: 'none',
   fontFamily: 'var(--font-family-primary)',
   fontSize: 14,
   lineHeight: '20px',
   color: '#18181B',
   boxSizing: 'border-box',
   transition: 'border-color 0.2s, box-shadow 0.2s',
};

const AddKeywords = ({ closeModal, domain, keywords, scraperName = '', allowsCity = false }: AddKeywordsProps) => {
   const inputRef = useRef(null);
   const defCountry = localStorage.getItem('default_country') || 'US';

   const [error, setError] = useState<string>('');
   const [showTagSuggestions, setShowTagSuggestions] = useState(false);
   const [focusInput, setFocusInput] = useState<string | null>(null);
   const [newKeywordsData, setNewKeywordsData] = useState<KeywordsInput>({ keywords: '', device: 'desktop', country: defCountry, domain, tags: '' });
   const { mutate: addMutate, isLoading: isAdding } = useAddKeywords(() => closeModal(false));

   const existingTags: string[] = useMemo(() => {
      const allTags = keywords.reduce((acc: string[], keyword) => [...acc, ...keyword.tags], []).filter((t) => t && t.trim() !== '');
      return [...new Set(allTags)];
   }, [keywords]);

   const setDeviceType = useCallback((input:string) => {
      let updatedDevice = '';
      if (newKeywordsData.device.includes(input)) {
         updatedDevice = newKeywordsData.device.replace(',', '').replace(input, '');
      } else {
         updatedDevice = newKeywordsData.device ? `${newKeywordsData.device},${input}` : input;
      }
      setNewKeywordsData({ ...newKeywordsData, device: updatedDevice });
   }, [newKeywordsData]);

   const addKeywords = () => {
      const nkwrds = newKeywordsData;
      if (nkwrds.keywords) {
         const devices = nkwrds.device.split(',');
         const multiDevice = nkwrds.device.includes(',') && devices.length > 1;
         const keywordsArray = [...new Set(nkwrds.keywords.split('\n').map((item) => item.trim()).filter((item) => !!item))];
         const currentKeywords = keywords.map((k) => `${k.keyword}-${k.device}-${k.country}${k.city ? `-${k.city}` : ''}`);

         const keywordExist = keywordsArray.filter((k) =>
            devices.some((device) => currentKeywords.includes(`${k}-${device}-${nkwrds.country}${nkwrds.city ? `-${nkwrds.city}` : ''}`)),
         );

         if (!multiDevice && (keywordsArray.length === 1 || currentKeywords.length === keywordExist.length) && keywordExist.length > 0) {
            setError(`Keywords ${keywordExist.join(',')} already Exist`);
            setTimeout(() => { setError(''); }, 3000);
         } else {
            const newKeywords = keywordsArray.flatMap((k) =>
               devices.filter((device) =>
                 !currentKeywords.includes(`${k}-${device}-${nkwrds.country}${nkwrds.city ? `-${nkwrds.city}` : ''}`),
               ).map((device) => ({
                 keyword: k,
                 device,
                 country: nkwrds.country,
                 domain: nkwrds.domain,
                 tags: nkwrds.tags,
                 city: nkwrds.city,
               })),
             );
            addMutate(newKeywords);
         }
      } else {
         setError('Please Insert a Keyword');
         setTimeout(() => { setError(''); }, 3000);
      }
   };

   const deviceActive = newKeywordsData.device.includes('desktop');
   const mobileActive = newKeywordsData.device.includes('mobile');

   const pillBase: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 9999,
      border: '1px solid #D4D4D8',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
   };

   return (
      <Modal closeModal={() => { closeModal(false); }} title="Add New Keywords" verticalCenter>
         <div data-testid="addkeywords_modal">
            <div>
               {/* Keywords textarea */}
               <textarea
                  style={{
                     ...inputBaseStyle,
                     height: 160,
                     resize: 'vertical',
                     borderColor: focusInput === 'keywords' ? '#F5C4A0' : '#D4D4D8',
                     boxShadow: focusInput === 'keywords' ? '0px 1px 2px 0px rgba(26,29,40,0.06), 0 0 0 2px rgba(242,153,100,0.1)' : 'none',
                  }}
                  placeholder="Type or Paste Keywords here. Insert Each keyword in a New line."
                  value={newKeywordsData.keywords}
                  onFocus={() => setFocusInput('keywords')}
                  onBlur={() => setFocusInput(null)}
                  onChange={(e) => setNewKeywordsData({ ...newKeywordsData, keywords: e.target.value })}
               />

               {/* Country + Device row */}
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div>
                     <SelectField
                        multiple={false}
                        selected={[newKeywordsData.country]}
                        options={Object.keys(countries).map((countryISO:string) => { return { label: countries[countryISO][0], value: countryISO }; })}
                        defaultLabel="All Countries"
                        updateField={(updated:string[]) => {
                           setNewKeywordsData({ ...newKeywordsData, country: updated[0] });
                           localStorage.setItem('default_country', updated[0]);
                        }}
                        rounded="rounded"
                        maxHeight={48}
                        flags={true}
                     />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                     <button
                        type="button"
                        style={{
                           ...pillBase,
                           background: deviceActive ? '#2F2F34' : '#FFFFFF',
                           color: deviceActive ? '#FFFFFF' : '#52525C',
                           borderColor: deviceActive ? '#09090B' : '#D4D4D8',
                           boxShadow: deviceActive ? 'inset 0 0 0 1px #09090B' : 'none',
                        }}
                        onClick={() => setDeviceType('desktop')}
                     >
                        <Icon type="desktop" size={15} />
                        <span>Desktop</span>
                        {deviceActive && (
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                           </svg>
                        )}
                     </button>
                     <button
                        type="button"
                        style={{
                           ...pillBase,
                           background: mobileActive ? '#2F2F34' : '#FFFFFF',
                           color: mobileActive ? '#FFFFFF' : '#52525C',
                           borderColor: mobileActive ? '#09090B' : '#D4D4D8',
                           boxShadow: mobileActive ? 'inset 0 0 0 1px #09090B' : 'none',
                        }}
                        onClick={() => setDeviceType('mobile')}
                     >
                        <Icon type="mobile" size={15} />
                        <span>Mobile</span>
                        {mobileActive && (
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                           </svg>
                        )}
                     </button>
                  </div>
               </div>

               {/* Tags input */}
               <div style={{ position: 'relative', marginTop: 12 }}>
                  <input
                     ref={inputRef}
                     style={{
                        ...inputBaseStyle,
                        paddingLeft: 36,
                        borderColor: focusInput === 'tags' ? '#F5C4A0' : '#D4D4D8',
                        boxShadow: focusInput === 'tags' ? '0px 1px 2px 0px rgba(26,29,40,0.06), 0 0 0 2px rgba(242,153,100,0.1)' : 'none',
                     }}
                     placeholder="Insert Tags (Optional)"
                     value={newKeywordsData.tags}
                     onFocus={() => setFocusInput('tags')}
                     onBlur={() => setFocusInput(null)}
                     onChange={(e) => setNewKeywordsData({ ...newKeywordsData, tags: e.target.value })}
                  />
                  <span
                     style={{ position: 'absolute', top: 9, left: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                     onClick={() => setShowTagSuggestions(!showTagSuggestions)}
                  >
                     <Icon type="tags" size={16} color={showTagSuggestions ? '#3F3F47' : '#9F9FA9'} />
                     <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                        style={{ transform: showTagSuggestions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
                     >
                        <path d="M6 9l6 6 6-6" stroke={showTagSuggestions ? '#3F3F47' : '#9F9FA9'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                     </svg>
                  </span>
                  {showTagSuggestions && (
                     <ul style={{
                        position: 'absolute',
                        zIndex: 50,
                        background: '#FFFFFF',
                        border: '1px solid #D4D4D8',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        width: '100%',
                        listStyle: 'none',
                        margin: 0,
                        padding: '4px 0',
                        boxSizing: 'border-box',
                     }}>
                        {existingTags.length > 0 && existingTags.map((tag, index) => {
                           return newKeywordsData.tags.split(',').map((t) => t.trim()).includes(tag) === false && (
                              <li
                                 key={index}
                                 style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    color: '#3F3F47',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    transition: 'color 150ms ease, background 150ms ease',
                                 }}
                                 onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#F29964'; (e.target as HTMLElement).style.background = '#F4F4F5'; }}
                                 onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#3F3F47'; (e.target as HTMLElement).style.background = 'transparent'; }}
                                 onClick={() => {
                                    const tagInput = newKeywordsData.tags;
                                    const tagToInsert = tagInput + (tagInput.trim().slice(-1) === ',' ? '' : (tagInput.trim() ? ', ' : '')) + tag;
                                    setNewKeywordsData({ ...newKeywordsData, tags: tagToInsert });
                                    setShowTagSuggestions(false);
                                    if (inputRef?.current) (inputRef.current as HTMLInputElement).focus();
                                 }}
                              >
                                 <Icon type="tags" size={14} color="#9F9FA9" /> {tag}
                              </li>
                           );
                        })}
                        {existingTags.length === 0 && (
                           <li style={{ padding: '8px 12px', fontSize: 14, color: '#9F9FA9' }}>No Existing Tags Found...</li>
                        )}
                     </ul>
                  )}
               </div>

               {/* City input */}
               <div style={{ position: 'relative', marginTop: 12 }}>
                  <input
                     style={{
                        ...inputBaseStyle,
                        paddingLeft: 32,
                        cursor: !allowsCity ? 'not-allowed' : 'text',
                        opacity: !allowsCity ? 0.5 : 1,
                     }}
                     disabled={!allowsCity}
                     title={!allowsCity ? `Your scraper ${scraperName} doesn't have city level scraping feature.` : ''}
                     placeholder={`City (Optional)${!allowsCity ? `. Not available for ${scraperName}.` : ''}`}
                     value={newKeywordsData.city}
                     onChange={(e) => setNewKeywordsData({ ...newKeywordsData, city: e.target.value })}
                  />
                  <span style={{ position: 'absolute', top: 9, left: 10 }}>
                     <Icon type="city" size={16} color="#9F9FA9" />
                  </span>
               </div>
            </div>

            {/* Error message */}
            {error && (
               <div style={{
                  width: '100%',
                  marginTop: 16,
                  padding: 12,
                  fontSize: 13,
                  background: '#FFF1F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  color: '#B91C1C',
                  boxSizing: 'border-box',
               }}>
                  {error}
               </div>
            )}

            {/* Buttons */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <button
                  type="button"
                  style={{
                     padding: '6px 16px',
                     borderRadius: 6,
                     cursor: 'pointer',
                     background: '#F4F4F5',
                     border: 'none',
                     color: '#2F2F34',
                     fontSize: 14,
                     fontWeight: 600,
                     fontFamily: 'var(--font-family-primary)',
                     transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#E4E4E7'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#F4F4F5'; }}
                  onClick={() => closeModal(false)}
               >
                  Cancel
               </button>
               <button
                  type="button"
                  style={{
                     padding: '6px 16px',
                     borderRadius: 6,
                     cursor: isAdding ? 'wait' : 'pointer',
                     background: isAdding ? '#F29964' : '#2F2F34',
                     border: 'none',
                     color: '#FFFFFF',
                     fontSize: 14,
                     fontWeight: 600,
                     fontFamily: 'var(--font-family-primary)',
                     opacity: isAdding ? 0.7 : 1,
                     transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isAdding) (e.target as HTMLElement).style.background = '#F29964'; }}
                  onMouseLeave={(e) => { if (!isAdding) (e.target as HTMLElement).style.background = '#2F2F34'; }}
                  onClick={() => !isAdding && addKeywords()}
               >
                  {isAdding ? 'Adding...' : 'Add Keywords'}
               </button>
            </div>
         </div>
      </Modal>
   );
};

export default AddKeywords;
