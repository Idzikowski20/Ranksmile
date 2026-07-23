import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Suggestion {
   keyword: string;
   volume?: number;
   competitionIndex?: number;
   intent?: string;
   cpc?: number;
}

const INTENT: Record<string, { label: string; bg: string; color: string }> = {
   informational: { label: 'Info', bg: '#EAF2FE', color: '#2563EB' },
   commercial: { label: 'Comm', bg: '#F3EEFF', color: '#F29964' },
   transactional: { label: 'Trans', bg: '#E4F5EA', color: '#1AB25E' },
   navigational: { label: 'Nav', bg: '#F4F4F5', color: '#52525C' },
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
   if (index <= 33) return '#22c55e';
   if (index <= 66) return '#f59e0b';
   return '#ef4444';
}

const KeywordSuggestInput = ({ keywords, onAdd, onRemove, country = 'US', placeholder }: Props) => {
   const [inputValue, setInputValue] = useState('');
   const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
   const [hasVolumeData, setHasVolumeData] = useState(false);
   const [isOpen, setIsOpen] = useState(false);
   const [focusedIndex, setFocusedIndex] = useState(-1);
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const reqSeqRef = useRef(0); // ignore out-of-order (stale) responses

   const fetchSuggestions = useCallback(async (q: string) => {
      const seq = ++reqSeqRef.current;
      try {
         const res = await fetch(`/api/articles/keyword-suggest?q=${encodeURIComponent(q)}&country=${country}`);
         if (seq !== reqSeqRef.current || !res.ok) return; // a newer query superseded this one
         const data = await res.json();
         if (seq !== reqSeqRef.current) return;
         setSuggestions(data.suggestions || []);
         setHasVolumeData(data.hasVolumeData || false);
         setIsOpen(true);
         setFocusedIndex(-1);
      } catch {
         // network offline — keep dropdown closed
      }
   }, [country]);

   useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (inputValue.length < 3) {
         setSuggestions([]);
         setIsOpen(false);
         return;
      }
      debounceRef.current = setTimeout(() => fetchSuggestions(inputValue), 350);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
   }, [inputValue, fetchSuggestions]);

   // Close on outside click
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
      inputRef.current?.focus();
   };

   const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const total = suggestions.length + 1; // +1 for "Add X" row
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
      background: focusedIndex === index ? '#FFF7ED' : 'transparent',
      gap: 8,
   });

   return (
      <div ref={containerRef} style={{ position: 'relative' }}>
         {/* Input container with pills */}
         <div
            style={{
               minHeight: 40,
               border: '1px solid #DAD9DE',
               borderRadius: 8,
               padding: '4px 12px',
               display: 'flex',
               flexWrap: 'wrap',
               alignItems: 'center',
               gap: 4,
               background: '#fff',
               boxShadow: '0px 2px 0px 0px #DAD9DE',
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
                     background: '#F4F4F5',
                     borderRadius: 4,
                     padding: '1px 6px',
                     fontSize: 13,
                     lineHeight: '20px',
                     color: '#09090B',
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
                        color: '#52525C', fontSize: 14, lineHeight: 1,
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
                  // short delay so click on suggestion registers first
                  setTimeout(() => {
                     if (!containerRef.current?.contains(document.activeElement)) {
                        setIsOpen(false);
                     }
                  }, 150);
               }}
               placeholder={keywords.length === 0 ? (placeholder || 'Enter keyword...') : ''}
               style={{
                  flex: 1,
                  minWidth: 120,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  lineHeight: '20px',
                  color: '#09090B',
                  background: 'transparent',
                  fontFamily: 'var(--font-family-primary)',
                  padding: '4px 0',
               }}
            />
         </div>

         {/* Dropdown */}
         {isOpen && (
            <div
               style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid #E4E4E7',
                  borderRadius: 8,
                  boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                  zIndex: 50,
                  maxHeight: 450,
                  overflowY: 'auto',
               }}
            >
               {/* Header row (only with volume data) */}
               {hasVolumeData && suggestions.length > 0 && (
                  <div
                     style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: 32,
                        padding: '0 12px',
                        borderBottom: '1px solid #F4F4F5',
                        gap: 8,
                     }}
                  >
                     <span style={{ flex: 1, fontSize: 13, color: '#9F9FA9', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                        Keyword
                     </span>
                     <span style={{ width: 72, fontSize: 13, color: '#9F9FA9', fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                        Difficulty
                     </span>
                     <span style={{ width: 72, fontSize: 13, color: '#9F9FA9', fontWeight: 500, textAlign: 'right', fontFamily: 'var(--font-family-primary)' }}>
                        Volume
                     </span>
                  </div>
               )}

               {/* Suggestions */}
               {suggestions.map((s, i) => (
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
                           color: '#2F2F34',
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
                           {/* Difficulty bar */}
                           <div style={{ width: 72, display: 'flex', alignItems: 'center' }}>
                              <div
                                 style={{
                                    width: 24,
                                    height: 6,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    background: '#E4E4E7',
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
                           {/* Volume */}
                           <span
                              style={{
                                 width: 72,
                                 fontSize: 14,
                                 color: '#2F2F34',
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

               {/* "Add X" row — always shown when there's input */}
               {inputValue.trim().length > 0 && (
                  <div
                     style={{
                        ...rowHoverStyle(suggestions.length),
                        borderTop: suggestions.length > 0 ? '1px solid #F4F4F5' : undefined,
                     }}
                     onMouseEnter={() => setFocusedIndex(suggestions.length)}
                     onMouseLeave={() => setFocusedIndex(-1)}
                     onMouseDown={(e) => { e.preventDefault(); addKeyword(inputValue); }}
                  >
                     <span
                        style={{
                           fontSize: 14,
                           color: '#2F2F34',
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
