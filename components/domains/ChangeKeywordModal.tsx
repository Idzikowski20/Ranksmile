import React, { useEffect, useMemo, useState } from 'react';
import { SearchBar } from '../ui';
import { XIcon } from '../core';

export type GscKeyword = { keyword: string; position: number; clicks: number; impressions: number };

const KW_FONT = 'var(--font-family-primary)';

function compactNum(n: number): string {
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
   return String(Math.round(n));
}

const KwValueCell = ({ children }: { children: React.ReactNode }) => (
   <div style={{ width: 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', borderLeft: '1px solid #F4F4F5', fontSize: 14, color: '#3F3F47', fontFamily: KW_FONT }}>
      {children}
   </div>
);

function KwRow({ keyword, position, clicks, impr, selected, onSelect, suggest, addNew }: {
   keyword: string; position?: number; clicks?: number; impr?: number;
   selected: boolean; onSelect: () => void; suggest?: boolean; addNew?: boolean;
}) {
   return (
      <div onClick={onSelect} className="kw-row" style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #F4F4F5', cursor: 'pointer', background: selected ? '#F8F8F9' : '#fff', transition: 'background 100ms ease' }}>
         <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}>
            <input type="radio" checked={selected} readOnly style={{ accentColor: '#18181B', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
            <span style={{ minWidth: 0, fontSize: 14, fontWeight: addNew ? 500 : 400, color: addNew ? '#783AFB' : '#18181B', fontFamily: KW_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{keyword}</span>
            {suggest && (
               <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 8, background: 'rgba(120,58,251,0.08)', color: '#783AFB', fontSize: 12, fontWeight: 600, fontFamily: KW_FONT }}>suggest</span>
            )}
         </label>
         {!addNew && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
               <KwValueCell>{position && position > 0 ? position.toFixed(1) : '—'}</KwValueCell>
               <KwValueCell>{clicks ? compactNum(clicks) : '0'}</KwValueCell>
               <KwValueCell>{impr ? compactNum(impr) : '0'}</KwValueCell>
            </div>
         )}
      </div>
   );
}

function ChangeKeywordModal({ article, allKeywords, onClose, onSave }: {
   article: { id: string | number; title: string; url: string; keyword: string };
   allKeywords: GscKeyword[];
   onClose: () => void;
   onSave: (keyword: string) => Promise<void>;
}) {
   const [search, setSearch] = useState('');
   const [selected, setSelected] = useState(article.keyword);
   const [saving, setSaving] = useState(false);
   const [suggestions, setSuggestions] = useState<Array<{ keyword: string; volume?: number }>>([]);
   const [suggestLoading, setSuggestLoading] = useState(false);

   // Fetch Google Suggest / Ads keyword ideas for the current keyword
   useEffect(() => {
      if (!article.keyword) return;
      setSuggestLoading(true);
      fetch(`/api/articles/keyword-suggest?q=${encodeURIComponent(article.keyword)}`)
         .then((r) => r.json())
         .then((d) => setSuggestions((d.suggestions || []).slice(0, 8)))
         .catch(() => {})
         .finally(() => setSuggestLoading(false));
   }, [article.keyword]);

   const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return allKeywords;
      return allKeywords.filter((k) => k.keyword.toLowerCase().includes(q));
   }, [allKeywords, search]);

   // If search term is new (not in list), show it as "add new" option
   const searchIsNew = search.trim() && !allKeywords.some((k) => k.keyword.toLowerCase() === search.trim().toLowerCase());

   const handleSave = async () => {
      if (!selected) return;
      setSaving(true);
      await onSave(selected);
      setSaving(false);
      onClose();
   };

   const canSave = !!selected && selected !== article.keyword && !saving;

   return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
         <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: 840, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', boxShadow: '0px 24px 64px rgba(0,0,0,0.2)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'center', fontFamily: KW_FONT }}
         >
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#18181B', fontFamily: KW_FONT }}>Change main keyword</h2>
                  <button
                     type="button"
                     onClick={onClose}
                     aria-label="Close"
                     style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: '#52525C', cursor: 'pointer', padding: 0, transition: 'opacity 150ms ease' }}
                     onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                     <XIcon size={22} />
                  </button>
               </div>
               <p style={{ margin: 0, fontSize: 14, color: '#3F3F47', fontFamily: KW_FONT, lineHeight: '20px' }}>
                  Select a keyword you are targeting with this page:{' '}
                  <strong style={{ color: '#18181B' }}>{article.title}{article.url ? ` (${article.url})` : ''}</strong>
               </p>
            </div>

            {/* Search */}
            <div style={{ padding: '0 24px 12px' }}>
               <SearchBar value={search} onChange={setSearch} placeholder="Search or add new" width="100%" />
            </div>

            {/* Keyword list */}
            <div style={{ flexShrink: 1, overflowY: 'auto', padding: '0 24px', maxHeight: 312 }}>
               <div style={{ borderRadius: 8, border: '1px solid #F4F4F5', overflow: 'hidden' }}>
                  {/* Sticky header */}
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'stretch', background: '#fff', borderBottom: '1px solid #F4F4F5' }}>
                     <div style={{ flex: 1, minWidth: 0, padding: '12px 16px', fontSize: 14, color: '#3F3F47', fontFamily: KW_FONT }}>Keyword</div>
                     {['Position', 'Clicks', 'Impr.'].map((h) => (
                        <div key={h} style={{ width: 92, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid #F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, color: '#3F3F47', fontFamily: KW_FONT }}>{h}</div>
                     ))}
                  </div>

                  {/* Suggested — only when not searching */}
                  {!search.trim() && (suggestions.length > 0 || suggestLoading) && (
                     <>
                        <div style={{ padding: '12px 16px 6px', fontSize: 11, fontWeight: 600, color: '#52525C', fontFamily: KW_FONT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                           Suggested{suggestLoading && <span style={{ fontWeight: 400, color: '#9F9FA9', textTransform: 'none', letterSpacing: 0 }}> loading…</span>}
                        </div>
                        {suggestions.map((s) => {
                           const gsc = allKeywords.find((k) => k.keyword.toLowerCase() === s.keyword.toLowerCase());
                           return (
                              <KwRow key={`sug_${s.keyword}`} keyword={s.keyword} position={gsc?.position} clicks={gsc?.clicks} impr={gsc?.impressions} selected={selected === s.keyword} onSelect={() => setSelected(s.keyword)} suggest />
                           );
                        })}
                     </>
                  )}

                  {/* Add new keyword */}
                  {searchIsNew && (
                     <KwRow keyword={`Add "${search.trim()}"`} selected={selected === search.trim()} onSelect={() => setSelected(search.trim())} addNew />
                  )}

                  {/* GSC keyword rows */}
                  {filtered.length === 0 && !searchIsNew ? (
                     <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#9F9FA9', fontFamily: KW_FONT }}>
                        No keywords found for this domain.
                     </div>
                  ) : filtered.map((kw) => (
                     <KwRow key={kw.keyword} keyword={kw.keyword} position={kw.position} clicks={kw.clicks} impr={kw.impressions} selected={selected === kw.keyword} onSelect={() => setSelected(kw.keyword)} />
                  ))}
               </div>
            </div>

            {/* Warning */}
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '16px 24px 0' }}>
               <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0, color: '#18181B' }}>
                  <path fill="currentColor" fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5m0 9a1 1 0 1 0 0-2a1 1 0 0 0 0 2" clipRule="evenodd" />
               </svg>
               <div style={{ fontSize: 14, color: '#18181B', fontFamily: KW_FONT, lineHeight: '20px' }}>
                  <span style={{ fontWeight: 600 }}>Important:</span> changing the keyword will replace your Content Editor with a new one.
                  <div>- This page might no longer be recommended. You can still find it in the Content Audit view.</div>
                  <div>- Your previous document remains accessible on the Content Editors list.</div>
               </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, padding: 24 }}>
               <button
                  type="button"
                  onClick={onClose}
                  style={{ border: 'none', background: 'transparent', color: '#3F3F47', fontSize: 16, fontWeight: 600, fontFamily: KW_FONT, cursor: 'pointer', padding: 0, transition: 'color 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3F3F47'; }}
               >
                  Cancel
               </button>
               <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: canSave ? '#18181B' : '#F4F4F5', color: canSave ? '#fff' : '#9F9FA9', fontSize: 16, fontWeight: 600, fontFamily: KW_FONT, cursor: canSave ? 'pointer' : 'default', transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { if (canSave) e.currentTarget.style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { if (canSave) e.currentTarget.style.background = '#18181B'; }}
               >
                  {saving ? 'Saving…' : 'Save'}
               </button>
            </div>
         </div>
      </div>
   );
}

export default ChangeKeywordModal;
