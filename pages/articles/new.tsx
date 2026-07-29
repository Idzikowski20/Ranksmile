import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';
import { WizardNextButton } from '../../components/articles/WizardShell';
import { Button, CompactSelect } from '../../components/core';
import type { SelectOption } from '../../components/core';

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

const NewContentPage: NextPage = () => {
  const router = useRouter();
  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];

  const [domainId, setDomainId] = useState<number>(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('pl');
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(false);

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
    posthog.capture('article_research_started', {
      keyword_count: keywords.length,
      language,
    });
    const q = new URLSearchParams();
    q.set('domainId', String(domainId));
    q.set('keywords', keywords.join(','));
    q.set('country', LANG_TO_COUNTRY[language] || 'US');
    q.set('language', language);
    q.set('flow', 'new');
    router.push(`/articles/deep-analysis?${q.toString()}`);
  };

  const domainOptions: SelectOption[] = domains.map((d) => ({ value: String(d.ID), label: d.domain }));
  const languageOptions: SelectOption[] = LANGUAGES;

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>New Content — Ranksmile</title></Head>

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
                <div>
                  <label style={fieldLabel}>Domain</label>
                  <div style={{ width: '100%', display: 'grid' }}>
                    <CompactSelect
                      size="md"
                      value={String(domainId || '')}
                      options={domainOptions}
                      onChange={(opt) => { setDomainId(Number(opt.value)); setKeywords([]); }}
                      menuWidth="100%"
                      menuMinWidth="100%"
                      triggerLabel={
                        domainOptions.find((o) => o.value === String(domainId))?.label
                        || <span style={{ color: '#6A6772' }}>Select domain...</span>
                      }
                    />
                  </div>
                </div>

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
                        <Button type="button" variant="secondary" size="xs" onClick={selectAllTracked}>Select all</Button>
                      )}
                      {keywords.length > 0 && (
                        <Button type="button" variant="secondary" size="xs" onClick={() => setKeywords([])}>Clear all</Button>
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
                        <Button
                          key={tk.ID}
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => addKeyword(tk.keyword)}
                        >
                          {tk.keyword}
                          {tk.position != null && tk.position > 0 && (
                            <span style={{ fontSize: 11, color: '#9F9FA9', fontWeight: 400 }}>#{tk.position}</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Language */}
                <div>
                  <label style={fieldLabel}>Language</label>
                  <div style={{ width: '100%', display: 'grid' }}>
                    <CompactSelect
                      size="md"
                      value={language}
                      options={languageOptions}
                      onChange={(opt) => setLanguage(String(opt.value))}
                      menuWidth="100%"
                      menuMinWidth="100%"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky bottom action bar */}
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center', width: '100%', borderTop: '1px solid #E4E4E7' }}>
              <div style={{ width: '100%', maxWidth: 512, display: 'flex' }}>
                <WizardNextButton
                  label="Deep research"
                  disabled={!canNext}
                  onClick={goNext}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const mutedNote: React.CSSProperties = {
  margin: 0, fontSize: 13, lineHeight: '20px', color: '#9F9FA9', fontFamily: 'var(--font-family-primary)',
};

export default NewContentPage;
