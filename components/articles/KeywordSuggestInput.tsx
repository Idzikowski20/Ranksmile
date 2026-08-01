import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Suggestion {
   keyword: string;
   volume?: number;
   competitionIndex?: number;
   intent?: string;
   cpc?: number;
}

const INTENT: Record<string, { label: string; bg: string; color: string }> = {
   informational: { label: 'Info', bg: 'var(--koala-bg-info-secondary, #EAF2FE)', color: 'var(--koala-text-info, #2563EB)' },
   commercial: { label: 'Comm', bg: 'var(--koala-bg-accent-secondary, #FFF0EB)', color: 'var(--koala-brand, #F84416)' },
   transactional: { label: 'Trans', bg: 'var(--koala-bg-success-secondary, #E4F5EA)', color: 'var(--koala-text-success, #1AB25E)' },
   navigational: { label: 'Nav', bg: 'var(--koala-bg-tertiary, #F4F4F5)', color: 'var(--koala-text-secondary, #52525C)' },
};

interface Props {
   keywords: string[];
   onAdd: (kw: string) => void;
   onRemove: (kw: string) => void;
   country?: string;
   placeholder?: string;
}

function formatVolume(v: number): string {
   if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
   return String(v);
}

function difficultyColor(index: number): string {
   if (index <= 33) return 'var(--koala-text-success, #22c55e)';
   if (index <= 66) return 'var(--koala-text-warning, #f59e0b)';
   return 'var(--koala-text-danger, #ef4444)';
}

const skeletonPulse: React.CSSProperties = {
   background: 'var(--koala-bg-tertiary, #F4F4F5)',
   borderRadius: 4,
   animation: 'skeletonPulse 1.5s ease-in-out infinite',
};

const KeywordSuggestInput = ({ keywords, onAdd, onRemove, country = 'US', placeholder }: Props) => {
   const [inputValue, setInputValue] = useState('');
   const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
   const [hasVolumeData, setHasVolumeData] = useState(false);
   const [isOpen, setIsOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [focusedIndex, setFocusedIndex] = useState(-1);
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const reqSeqRef = useRef(0);

   const fetchSuggestions = useCallback(async (q: string) => {
      const seq = ++reqSeqRef.current;
      setIsLoading(true);
      setIsOpen(true);
      try {
         const res = await fetch(`/api/articles/keyword-suggest?q=${encodeURIComponent(q)}&country=${country}`);
         if (seq !== reqSeqRef.current) return;
         if (!res.ok) {
            setSuggestions([]);
            setHasVolumeData(false);
            return;
         }
         const data = await res.json();
         if (seq !== reqSeqRef.current) return;
         setSuggestions(data.suggestions || []);
         setHasVolumeData(data.hasVolumeData || false);
         setFocusedIndex(-1);
      } catch {
         if (seq !== reqSeqRef.current) return;
         setSuggestions([]);
         setHasVolumeData(false);
      } finally {
         if (seq === reqSeqRef.current) setIsLoading(false);
      }
   }, [country]);

   useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (inputValue.length < 3) {
         setSuggestions([]);
         setIsOpen(false);
         setIsLoading(false);
         return;
      }
      // Show popover immediately so volume/difficulty loading is visible while waiting.
      setIsLoading(true);
      setIsOpen(true);
      debounceRef.current = setTimeout(() => fetchSuggestions(inputValue), 350);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
   }, [inputValue, fetchSuggestions]);

   useEffect(() => {
      const handler = (e: MouseEvent) => {
         if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
   }, []);

   const addKeyword = (kw: string) => {
      const trimmed = kw.trim();
      if (!trimmed) return;
      onAdd(trimmed);
      setInputValue('');
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      inputRef.current?.focus();
   };

   const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isLoading) {
         if (e.key === 'Escape') {
            setIsOpen(false);
            setFocusedIndex(-1);
         } else if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addKeyword(inputValue);
         }
         return;
      }
      const total = suggestions.length + 1;
      if (e.key === 'ArrowDown') {
         e.preventDefault();
         setFocusedIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === 'ArrowUp') {
         e.preventDefault();
         setFocusedIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Escape') {
         setIsOpen(false);
         setFocusedIndex(-1);
      } else if (e.key === 'Enter' || e.key === ',') {
         e.preventDefault();
         if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
            addKeyword(suggestions[focusedIndex].keyword);
         } else {
            addKeyword(inputValue);
         }
      }
   };

   const rowHoverStyle = (index: number): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      height: 36,
      padding: '0 12px',
      cursor: 'pointer',
      background: focusedIndex === index ? 'var(--koala-bg-accent-secondary, #FFF7ED)' : 'transparent',
      gap: 8,
   });

   const showVolumeCols = isLoading || hasVolumeData;

   return (
      <div ref={containerRef} style={{ position: 'relative' }}>
         <div
            style={{
               minHeight: 40,
               border: '1px solid var(--koala-border-primary, #dbded4)',
               borderRadius: 8,
               padding: '4px 12px',
               display: 'flex',
               flexWrap: 'wrap',
               alignItems: 'center',
               gap: 4,
               background: 'var(--koala-bg-primary, #fff)',
               boxShadow: 'none',
               cursor: 'text',
            }}
            onClick={() => inputRef.current?.focus()}
         >
            {keywords.map((kw) => (
               <span
                  key={kw}
                  style={{
                     display: 'inline-flex',
                     alignItems: 'center',
                     gap: 4,
                     background: 'var(--koala-bg-tertiary, #F4F4F5)',
                     borderRadius: 4,
                     padding: '1px 6px',
                     fontSize: 13,
                     lineHeight: '20px',
                     color: 'var(--koala-text-primary, #09090B)',
                     fontFamily: 'var(--font-family-primary)',
                  }}
               >
                  {kw}
                  <button
                     type="button"
                     onClick={(e) => { e.stopPropagation(); onRemove(kw); }}
                     style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center',
                        color: 'var(--koala-text-secondary, #52525C)', fontSize: 14, lineHeight: 1,
                     }}
                  >
                     ×
                  </button>
               </span>
            ))}
            <input
               ref={inputRef}
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={handleKeyDown}
               onBlur={() => {
                  setTimeout(() => {
                     if (!containerRef.current?.contains(document.activeElement)) {
                        setIsOpen(false);
                     }
                  }, 150);
               }}
               placeholder={keywords.length === 0 ? (placeholder || 'Enter keyword...') : ''}
               aria-busy={isLoading}
               style={{
                  flex: 1,
                  minWidth: 120,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  lineHeight: '20px',
                  color: 'var(--koala-text-primary, #09090B)',
                  background: 'transparent',
                  fontFamily: 'var(--font-family-primary)',
                  padding: '4px 0',
               }}
            />
            {isLoading && (
               <span
                  aria-hidden="true"
                  style={{
                     width: 14,
                     height: 14,
                     borderRadius: '50%',
                     border: '2px solid var(--koala-border-primary, #E4E4E7)',
                     borderTopColor: 'var(--koala-brand, #F84416)',
                     animation: 'spin 0.7s linear infinite',
                     flexShrink: 0,
                  }}
               />
            )}
         </div>

         {isOpen && (
            <div
               role="listbox"
               aria-busy={isLoading}
               style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: 'var(--koala-bg-primary, #fff)',
                  border: '1px solid var(--koala-border-primary, #E4E4E7)',
                  borderRadius: 8,
                  boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                  zIndex: 50,
                  maxHeight: 450,
                  overflowY: 'auto',
               }}
            >
               {showVolumeCols && (
                  <div
                     style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: 32,
                        padding: '0 12px',
                        borderBottom: '1px solid var(--koala-border-secondary, #F4F4F5)',
                        gap: 8,
                     }}
                  >
                     <span style={{ flex: 1, fontSize: 13, color: 'var(--koala-text-tertiary, #9F9FA9)', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                        Keyword
                     </span>
                     <span style={{ width: 72, fontSize: 13, color: 'var(--koala-text-tertiary, #9F9FA9)', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                        Difficulty
                     </span>
                     <span style={{ width: 72, fontSize: 13, color: 'var(--koala-text-tertiary, #9F9FA9)', fontWeight: 500, textAlign: 'right', fontFamily: 'var(--font-family-primary)' }}>
                        Volume
                     </span>
                  </div>
               )}

               {isLoading && (
                  <>
                     {[0, 1, 2, 3, 4].map((i) => (
                        <div
                           key={`skel-${i}`}
                           style={{
                              display: 'flex',
                              alignItems: 'center',
                              height: 36,
                              padding: '0 12px',
                              gap: 8,
                           }}
                        >
                           <div style={{ ...skeletonPulse, flex: 1, height: 12, animationDelay: `${i * 0.08}s` }} />
                           <div style={{ ...skeletonPulse, width: 24, height: 6, animationDelay: `${i * 0.08}s` }} />
                           <div style={{ ...skeletonPulse, width: 40, height: 12, marginLeft: 'auto', animationDelay: `${i * 0.08}s` }} />
                        </div>
                     ))}
                     <div
                        style={{
                           padding: '8px 12px',
                           fontSize: 12,
                           color: 'var(--koala-text-tertiary, #9F9FA9)',
                           fontFamily: 'var(--font-family-primary)',
                           borderTop: '1px solid var(--koala-border-secondary, #F4F4F5)',
                        }}
                     >
                        Loading volume &amp; difficulty…
                     </div>
                  </>
               )}

               {!isLoading && suggestions.map((s, i) => (
                  <div
                     key={s.keyword}
                     style={rowHoverStyle(i)}
                     onMouseEnter={() => setFocusedIndex(i)}
                     onMouseLeave={() => setFocusedIndex(-1)}
                     onMouseDown={(e) => { e.preventDefault(); addKeyword(s.keyword); }}
                  >
                     <span
                        style={{
                           flex: 1,
                           fontSize: 14,
                           color: 'var(--koala-text-primary, #2F2F34)',
                           fontWeight: 500,
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap',
                           fontFamily: 'var(--font-family-primary)',
                        }}
                     >
                        {s.keyword}
                     </span>
                     {s.intent && INTENT[s.intent] && (
                        <span title={`Search intent: ${s.intent}`} style={{ flexShrink: 0, marginRight: 6, padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: INTENT[s.intent].bg, color: INTENT[s.intent].color, fontFamily: 'var(--font-family-primary)' }}>
                           {INTENT[s.intent].label}
                        </span>
                     )}
                     {hasVolumeData && (
                        <>
                           <div style={{ width: 72, display: 'flex', alignItems: 'center' }}>
                              <div
                                 style={{
                                    width: 24,
                                    height: 6,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    background: 'var(--koala-bg-tertiary, #E4E4E7)',
                                    borderRadius: 2,
                                 }}
                              >
                                 <div
                                    style={{
                                       position: 'absolute',
                                       top: 0,
                                       left: 0,
                                       height: 6,
                                       width: `${s.competitionIndex ?? 0}%`,
                                       background: difficultyColor(s.competitionIndex ?? 0),
                                       borderRadius: 2,
                                    }}
                                 />
                              </div>
                           </div>
                           <span
                              style={{
                                 width: 72,
                                 fontSize: 14,
                                 color: 'var(--koala-text-primary, #2F2F34)',
                                 textAlign: 'right',
                                 fontFamily: 'var(--font-family-primary)',
                              }}
                           >
                              {s.volume != null ? formatVolume(s.volume) : '—'}
                           </span>
                        </>
                     )}
                  </div>
               ))}

               {!isLoading && inputValue.trim().length > 0 && (
                  <div
                     style={{
                        ...rowHoverStyle(suggestions.length),
                        borderTop: suggestions.length > 0 ? '1px solid var(--koala-border-secondary, #F4F4F5)' : undefined,
                     }}
                     onMouseEnter={() => setFocusedIndex(suggestions.length)}
                     onMouseLeave={() => setFocusedIndex(-1)}
                     onMouseDown={(e) => { e.preventDefault(); addKeyword(inputValue); }}
                  >
                     <span
                        style={{
                           fontSize: 14,
                           color: 'var(--koala-text-primary, #2F2F34)',
                           fontWeight: 500,
                           fontFamily: 'var(--font-family-primary)',
                        }}
                     >
                        Add &ldquo;{inputValue.trim()}&rdquo;
                     </span>
                  </div>
               )}
            </div>
         )}
      </div>
   );
};

export default KeywordSuggestInput;
