import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useFetchDomains } from '../../services/domains';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
import { Button, CompactSelect } from '../../components/koala/core';
import type { SelectOption } from '../../components/koala/core';
import { Flag } from '../../components/koala';

const LANGUAGES = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
] as const;

const LANG_TO_COUNTRY: Record<string, string> = {
  pl: 'PL', en: 'US', de: 'DE', fr: 'FR', es: 'ES', it: 'IT',
};

interface TrackedKeyword { ID: number; keyword: string; position?: number; }

const NewContentPage: NextPage = () => {
  const router = useRouter();
  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];

  const [domainId, setDomainId] = useState<number>(0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('pl');
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(false);

  useEffect(() => {
    if (!domainId && domains[0]?.ID) setDomainId(domains[0].ID);
  }, [domains, domainId]);

  const selectedDomain = domains.find((d) => d.ID === domainId);
  const selectedDomainStr = selectedDomain?.domain || '';

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

  const goNext = () => {
    if (!canNext) return;
    const q = new URLSearchParams();
    q.set('domainId', String(domainId));
    q.set('keywords', keywords.join(','));
    q.set('country', LANG_TO_COUNTRY[language] || 'US');
    q.set('language', language);
    q.set('flow', 'new');
    router.push(`/articles/deep-analysis?${q.toString()}`);
  };

  const domainOptions: SelectOption[] = domains.map((d) => ({ value: String(d.ID), label: d.domain }));
  const languageOptions: SelectOption[] = LANGUAGES.map((l) => ({
    value: l.value,
    label: l.label,
    textValue: l.label,
    leadingItems: <Flag code={LANG_TO_COUNTRY[l.value]} size={18} />,
  }));

  return (
    <WizardShell
      title="New Content"
      footer={(
        <WizardNextButton
          label="Deep research"
          disabled={!canNext}
          onClick={goNext}
        />
      )}
    >
      <div>
        <h2 className="koala-wizard-title">Enter target keyword</h2>
        <p className="koala-wizard-subtitle">
          Generate a high-scoring article from your target keywords
        </p>
      </div>

      <div>
        <label className="koala-wizard-label">Domain</label>
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
              || <span style={{ color: 'var(--koala-text-tertiary)' }}>Select domain...</span>
            }
          />
        </div>
      </div>

      <div>
        <label className="koala-wizard-label">
          Target Keywords
          {keywords.length > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--koala-text-tertiary)', marginLeft: 4 }}>
              ({keywords.length} selected)
            </span>
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

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
            Tracked Keywords for {selectedDomainStr || '...'}
            {!isLoadingTracked && hasTracked && (
              <span style={{ fontWeight: 400, color: 'var(--koala-text-tertiary)' }}> ({trackedKeywords.length})</span>
            )}
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
        {isLoadingTracked && <p className="koala-wizard-muted">Loading tracked keywords...</p>}
        {!isLoadingTracked && trackedKeywords.length === 0 && (
          <p className="koala-wizard-muted">No tracked keywords for this domain. Add keywords in the Tracker first.</p>
        )}
        {!isLoadingTracked && hasTracked && filteredTracked.length === 0 && (
          <p className="koala-wizard-muted" style={{ color: 'var(--koala-text-success, #16A34A)', fontWeight: 500 }}>
            All tracked keywords selected.
          </p>
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
                  <span style={{ fontSize: 11, color: 'var(--koala-text-tertiary)', fontWeight: 400 }}>#{tk.position}</span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="koala-wizard-label">Language</label>
        <div style={{ width: '100%', display: 'grid' }}>
          <CompactSelect
            size="md"
            value={language}
            options={languageOptions}
            onChange={(opt) => setLanguage(String(opt.value))}
            menuWidth="100%"
            menuMinWidth="100%"
            prefix={<Flag code={country} size={18} />}
          />
        </div>
      </div>
    </WizardShell>
  );
};

export default NewContentPage;
