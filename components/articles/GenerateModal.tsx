import React, { useState, useEffect } from 'react';
import { Select } from '../koala/core';
import { ShellPortal, overlayZ } from '../koala/overlay/ShellPortal';
import KeywordSuggestInput from './KeywordSuggestInput';

interface Domain {
  ID: number;
  domain: string;
}

interface TrackedKeyword {
  ID: number;
  keyword: string;
  tags?: string[];
  position?: number;
  volume?: number;
}

interface Props {
  domains: Domain[];
  onGenerate: (domainId: number, keywords: string[], language: string) => void;
  onClose: () => void;
  isGenerating: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  color: '#3F3F47',
  fontFamily: 'var(--font-family-primary)',
  display: 'block',
  paddingBottom: 6,
};

const fieldGroup: React.CSSProperties = {
  marginBottom: 20,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const LANGUAGES = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
];

const GenerateModal = ({ domains, onGenerate, onClose, isGenerating }: Props) => {
  const [domainId, setDomainId] = useState<number>(domains[0]?.ID || 0);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('pl');
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(false);
  const selectedDomain = domains.find((d) => d.ID === domainId);
  const selectedDomainStr = selectedDomain?.domain || '';

  useEffect(() => {
    if (!selectedDomainStr) {
      setTrackedKeywords([]);
      return;
    }
    setIsLoadingTracked(true);
    fetch(`/api/keywords?domain=${encodeURIComponent(selectedDomainStr)}`)
      .then((res) => res.json())
      .then((data) => {
        setTrackedKeywords(data.keywords || []);
      })
      .catch(() => setTrackedKeywords([]))
      .finally(() => setIsLoadingTracked(false));
  }, [selectedDomainStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.length === 0 || !domainId) return;
    onGenerate(domainId, keywords, language);
  };

  const handleTrackedKeywordClick = (kw: string) => {
    setKeywords((prev) => {
      if (prev.includes(kw)) return prev;
      return [...prev, kw];
    });
  };

  const handleSelectAll = () => {
    setKeywords((prev) => {
      const trackedNames = trackedKeywords.map((tk) => tk.keyword);
      const newKeywords = [...prev];
      for (const kw of trackedNames) {
        if (!newKeywords.includes(kw)) {
          newKeywords.push(kw);
        }
      }
      return newKeywords;
    });
  };

  const handleClearAll = () => {
    setKeywords([]);
  };

  const selectedSet = new Set(keywords);
  const filteredTracked = trackedKeywords.filter((tk) => !selectedSet.has(tk.keyword));
  const hasTracked = trackedKeywords.length > 0;

  return (
    <ShellPortal>
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZ.modal,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--koala-bg-primary)',
          borderRadius: 12,
          boxShadow: '0px 4px 24px rgba(0,0,0,0.12), 0px 1px 4px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--koala-border-primary)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: '24px',
              fontWeight: 600,
              color: '#2F2F34',
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            New Content
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#9F9FA9',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5';
              (e.currentTarget as HTMLButtonElement).style.color = '#2F2F34';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#9F9FA9';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflow: 'auto' }}>
          {/* Domain selector */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Domain</label>
            <Select
              size="md"
              width="100%"
              placeholder="Select domain..."
              value={domainId ? String(domainId) : ''}
              options={domains.map((d) => ({ value: String(d.ID), label: d.domain }))}
              onChange={(v) => {
                setDomainId(Number(v));
                setKeywords([]);
              }}
            />
          </div>

          {/* Target keywords */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              Target Keywords
              {keywords.length > 0 && (
                <span style={{ fontWeight: 400, color: '#9F9FA9', marginLeft: 4 }}>
                  ({keywords.length} selected)
                </span>
              )}
            </label>
            <KeywordSuggestInput
              keywords={keywords}
              onAdd={(kw) => {
                if (!keywords.includes(kw)) {
                  setKeywords((prev) => [...prev, kw]);
                }
              }}
              onRemove={(kw) => setKeywords((prev) => prev.filter((k) => k !== kw))}
              placeholder={keywords.length === 0 ? 'Type a keyword or select from tracked below...' : 'Add more keywords...'}
            />
          </div>

          {/* Tracked keywords */}
          <div style={fieldGroup}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
              <label
                style={{
                  ...labelStyle,
                  paddingBottom: 0,
                  fontSize: 13,
                  color: '#52525C',
                }}
              >
                Tracked Keywords for {selectedDomainStr || '...'}
                {!isLoadingTracked && hasTracked && (
                  <span style={{ fontWeight: 400, color: '#9F9FA9' }}> ({trackedKeywords.length})</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {hasTracked && filteredTracked.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--koala-border-primary)',
                      background: 'var(--koala-bg-primary)',
                      fontSize: 12,
                      lineHeight: '18px',
                      color: '#52525C',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                  >
                    Select all
                  </button>
                )}
                {keywords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--koala-border-primary)',
                      background: 'var(--koala-bg-primary)',
                      fontSize: 12,
                      lineHeight: '18px',
                      color: '#52525C',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            {isLoadingTracked && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: '20px',
                  color: '#9F9FA9',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                Loading tracked keywords...
              </p>
            )}
            {!isLoadingTracked && trackedKeywords.length === 0 && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: '20px',
                  color: '#9F9FA9',
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                No tracked keywords for this domain. Add keywords in the Tracker first.
              </p>
            )}
            {!isLoadingTracked && trackedKeywords.length > 0 && filteredTracked.length === 0 && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: '20px',
                  color: '#16A34A',
                  fontWeight: 500,
                  fontFamily: 'var(--font-family-primary)',
                }}
              >
                All tracked keywords selected.
              </p>
            )}
            {filteredTracked.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  maxHeight: 144,
                  overflowY: 'auto',
                  padding: '6px 0',
                }}
              >
                {filteredTracked.map((tk) => (
                  <button
                    key={tk.ID}
                    type="button"
                    onClick={() => handleTrackedKeywordClick(tk.keyword)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--koala-border-primary)',
                      background: 'var(--koala-bg-primary)',
                      fontSize: 13,
                      lineHeight: '18px',
                      color: '#2F2F34',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family-primary)',
                      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#FFF5EE';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#F5C4A0';
                      (e.currentTarget as HTMLButtonElement).style.color = '#F84416';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4E4E7';
                      (e.currentTarget as HTMLButtonElement).style.color = '#2F2F34';
                    }}
                  >
                    {tk.keyword}
                    {tk.position != null && tk.position > 0 && (
                      <span style={{ fontSize: 11, color: '#9F9FA9', fontWeight: 400 }}>
                        #{tk.position}
                      </span>
                    )}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language selector */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Language</label>
            <Select
              size="md"
              width="100%"
              value={language}
              options={LANGUAGES}
              onChange={setLanguage}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              paddingTop: 8,
              borderTop: '1px solid var(--koala-border-primary)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                padding: '0 20px',
                borderRadius: 8,
                border: '1px solid #D4D4D8',
                background: 'var(--koala-bg-primary)',
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 600,
                color: '#2F2F34',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-primary)',
                boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || keywords.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 40,
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: keywords.length > 0 ? '#2F2F34' : '#D4D4D8',
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 600,
                color: '#fff',
                cursor: keywords.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-family-primary)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (keywords.length > 0) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#F84416';
                }
              }}
              onMouseLeave={(e) => {
                if (keywords.length > 0) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#2F2F34';
                }
              }}
            >
              {isGenerating ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Generate {keywords.length > 0 ? `(${keywords.length})` : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ShellPortal>
  );
};

export default GenerateModal;
