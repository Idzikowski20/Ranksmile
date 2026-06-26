import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';

const LANGUAGES = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
];

// Language → country for the keyword-suggest autocomplete (DataForSEO location).
const LANG_TO_COUNTRY: Record<string, string> = { pl: 'PL', en: 'US', de: 'DE', fr: 'FR', es: 'ES', it: 'IT' };

interface TrackedKeyword { ID: number; keyword: string; position?: number; }

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 14, lineHeight: '20px', fontWeight: 500,
  color: '#3F3F47', paddingBottom: 6, fontFamily: 'var(--font-family-primary)',
};

/** Shared select used for both Domain and Language. */
function Dropdown({ label, value, options, onSelect, open, setOpen, placeholder }: {
  label: string; value: string; options: { value: string; label: string }[];
  onSelect: (v: string) => void; open: boolean; setOpen: (o: boolean) => void; placeholder?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div className="nc-dropdown" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            width: '100%', height: 40, padding: '0 12px', border: '1px solid #D4D4D8',
            borderRadius: 8, background: '#fff', fontSize: 14, lineHeight: '20px',
            color: current ? '#2F2F34' : '#52525C', cursor: 'pointer',
            fontFamily: 'var(--font-family-primary)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)', textAlign: 'left',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {current?.label || placeholder || 'Select...'}
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#9F9FA9', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0px 4px 16px rgba(0,0,0,0.08)', zIndex: 60, maxHeight: 220, overflowY: 'auto' }}>
            {options.map((o) => (
              <div
                key={o.value}
                onClick={() => { onSelect(o.value); setOpen(false); }}
                style={{
                  height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14,
                  color: o.value === value ? '#783AFB' : '#2F2F34', fontWeight: o.value === value ? 600 : 400,
                  fontFamily: 'var(--font-family-primary)', cursor: 'pointer',
                  background: o.value === value ? '#F8F5FF' : 'transparent',
                }}
                onMouseEnter={(e) => { if (o.value !== value) (e.currentTarget as HTMLDivElement).style.background = '#F4F4F5'; }}
                onMouseLeave={(e) => { if (o.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {o.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const NewContentPage: NextPage = () => {
  const router = useRouter();
  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];

  const [domainId, setDomainId] = useState<number>(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('pl');
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Default to the first domain once loaded.
  useEffect(() => {
    if (!domainId && domains[0]?.ID) setDomainId(domains[0].ID);
  }, [domains, domainId]);

  const selectedDomain = domains.find((d) => d.ID === domainId);
  const selectedDomainStr = selectedDomain?.domain || '';

  // Load tracked keywords for the selected domain.
  useEffect(() => {
    if (!selectedDomainStr) { setTrackedKeywords([]); return; }
    setIsLoadingTracked(true);
    fetch(`/api/keywords?domain=${encodeURIComponent(selectedDomainStr)}`)
      .then((r) => r.json())
      .then((d) => setTrackedKeywords(d.keywords || []))
      .catch(() => setTrackedKeywords([]))
      .finally(() => setIsLoadingTracked(false));
  }, [selectedDomainStr]);

  // Close dropdowns on outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.nc-dropdown')) { setDomainOpen(false); setLangOpen(false); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const country = LANG_TO_COUNTRY[language] || 'US';
  const selectedSet = new Set(keywords);
  const filteredTracked = trackedKeywords.filter((tk) => !selectedSet.has(tk.keyword));
  const hasTracked = trackedKeywords.length > 0;
  const canNext = keywords.length > 0 && !!domainId;

  const addKeyword = (kw: string) => setKeywords((prev) => (prev.includes(kw) ? prev : [...prev, kw]));
  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw));
  const selectAllTracked = () => setKeywords((prev) => {
    const next = [...prev];
    for (const tk of trackedKeywords) if (!next.includes(tk.keyword)) next.push(tk.keyword);
    return next;
  });

  // Step 1 of the New-Content wizard → deep analysis (step 2), which gathers the
  // ranking content (SERP) for the keyword and creates the draft article.
  const goNext = () => {
    if (!canNext) return;
    const q = new URLSearchParams();
    q.set('domainId', String(domainId));
    q.set('keywords', keywords.join(','));
    q.set('country', LANG_TO_COUNTRY[language] || 'US');
    q.set('language', language);
    router.push(`/articles/deep-analysis?${q.toString()}`);
  };

  const domainOptions = domains.map((d) => ({ value: String(d.ID), label: d.domain }));

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>New Content — SerpBear</title></Head>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8f9ff' }}>
        <div style={{ padding: 4, display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ border: '1px solid #E4E4E7', background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 12, overflow: 'hidden' }}>
            {/* Scrollable content */}
            <div style={{ padding: '48px 24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', width: '100%' }} className="styled-scrollbar">
              <div style={{ width: '100%', maxWidth: 576, display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 600, color: '#000', fontFamily: 'var(--font-family-primary)', letterSpacing: 0 }}>
                    Enter target keyword
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: '16px', color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                    Generate a high-scoring article from your target keywords
                  </p>
                </div>

                {/* Domain */}
                <Dropdown
                  label="Domain"
                  value={String(domainId || '')}
                  options={domainOptions}
                  onSelect={(v) => { setDomainId(Number(v)); setKeywords([]); }}
                  open={domainOpen}
                  setOpen={(o) => { setDomainOpen(o); setLangOpen(false); }}
                  placeholder="Select domain..."
                />

                {/* Target keywords */}
                <div>
                  <label style={fieldLabel}>
                    Target Keywords
                    {keywords.length > 0 && (
                      <span style={{ fontWeight: 400, color: '#9F9FA9', marginLeft: 4 }}>({keywords.length} selected)</span>
                    )}
                  </label>
                  <KeywordSuggestInput
                    keywords={keywords}
                    onAdd={addKeyword}
                    onRemove={removeKeyword}
                    country={country}
                    placeholder={keywords.length === 0 ? 'Type a keyword or select from tracked below...' : 'Add more keywords...'}
                  />
                </div>

                {/* Tracked keywords */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                      Tracked Keywords for {selectedDomainStr || '...'}
                      {!isLoadingTracked && hasTracked && <span style={{ fontWeight: 400, color: '#9F9FA9' }}> ({trackedKeywords.length})</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {hasTracked && filteredTracked.length > 0 && (
                        <button type="button" onClick={selectAllTracked} style={chipBtn}>Select all</button>
                      )}
                      {keywords.length > 0 && (
                        <button type="button" onClick={() => setKeywords([])} style={chipBtn}>Clear all</button>
                      )}
                    </div>
                  </div>
                  {isLoadingTracked && <p style={mutedNote}>Loading tracked keywords...</p>}
                  {!isLoadingTracked && trackedKeywords.length === 0 && (
                    <p style={mutedNote}>No tracked keywords for this domain. Add keywords in the Tracker first.</p>
                  )}
                  {!isLoadingTracked && hasTracked && filteredTracked.length === 0 && (
                    <p style={{ ...mutedNote, color: '#16A34A', fontWeight: 500 }}>All tracked keywords selected.</p>
                  )}
                  {filteredTracked.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 144, overflowY: 'auto', padding: '6px 0' }}>
                      {filteredTracked.map((tk) => (
                        <button
                          key={tk.ID}
                          type="button"
                          onClick={() => addKeyword(tk.keyword)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', fontSize: 13, lineHeight: '18px', color: '#2F2F34', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', transition: 'background 0.15s, border-color 0.15s, color 0.15s' }}
                          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#F8F5FF'; b.style.borderColor = '#AA93FD'; b.style.color = '#783AFB'; }}
                          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fff'; b.style.borderColor = '#E4E4E7'; b.style.color = '#2F2F34'; }}
                        >
                          {tk.keyword}
                          {tk.position != null && tk.position > 0 && (
                            <span style={{ fontSize: 11, color: '#9F9FA9', fontWeight: 400 }}>#{tk.position}</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Language */}
                <Dropdown
                  label="Language"
                  value={language}
                  options={LANGUAGES}
                  onSelect={setLanguage}
                  open={langOpen}
                  setOpen={(o) => { setLangOpen(o); setDomainOpen(false); }}
                />
              </div>
            </div>

            {/* Sticky bottom action bar */}
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center', width: '100%', borderTop: '1px solid #E4E4E7' }}>
              <div style={{ width: '100%', maxWidth: 512 }}>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={goNext}
                  style={{
                    width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 8, fontSize: 16, lineHeight: '24px', fontWeight: 600,
                    border: 'none', fontFamily: 'var(--font-family-primary)',
                    background: canNext ? '#2F2F34' : '#9F9FA9', color: '#fff',
                    cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.6,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (canNext) (e.currentTarget as HTMLButtonElement).style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { if (canNext) (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34'; }}
                >
                  <span className="line-clamp-1">Next<span style={{ fontWeight: 400 }}>—Deep research</span></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const chipBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 6,
  border: '1px solid #E4E4E7', background: '#fff', fontSize: 12, lineHeight: '18px',
  color: '#52525C', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-family-primary)',
};

const mutedNote: React.CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: '20px', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)',
};

export default NewContentPage;
