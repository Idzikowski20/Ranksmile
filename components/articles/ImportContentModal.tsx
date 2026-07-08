import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../lib/errors';
import Modal from '../core/modal/modal';
import Button from '../core/button/button';
import Input from '../core/input/input';

interface Props {
  domains: { ID: number; domain: string }[];
  onImport: (data: { url: string; domainId: number; keywords: string[]; country: string; device: string }) => void;
  onClose: () => void;
  isImporting: boolean;
}

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  US: { name: 'United States', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/us.svg' },
  GB: { name: 'United Kingdom', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/gb.svg' },
  PL: { name: 'Poland', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/pl.svg' },
  DE: { name: 'Germany', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/de.svg' },
  FR: { name: 'France', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/fr.svg' },
};

const DEVICES = ['Desktop', 'Mobile'] as const;

const ImportContentModal = ({ domains, onClose, isImporting }: Props) => {
  const [url, setUrl] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [country, setCountry] = useState('US');
  const [device, setDevice] = useState<string>('Desktop');
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [folderId] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [cannibalWarnings, setCannibalWarnings] = useState<string[]>([]);

  // Check cannibalization when keywords change
  useEffect(() => {
    if (keywords.length === 0 || !domains.length) return;
    const domainSlug = domains[0]?.domain || '';
    if (!domainSlug) return;
    // Check each keyword for cannibalization
    const checks = keywords.map((kw) =>
      fetch(`/api/domains/${domainSlug}/cannibalization?keyword=${encodeURIComponent(kw)}`)
        .then(r => r.json())
        .then(d => ({ kw, cannibalized: d.cannibalized || [] }))
        .catch(() => ({ kw, cannibalized: [] }))
    );
    Promise.all(checks).then(results => {
      const warnings: string[] = [];
      for (const { kw, cannibalized } of results) {
        for (const c of cannibalized) {
          warnings.push(`"${c.keyword}" already targeted by: ${c.articles.map((a: { title?: string | null }) => a.title).join(', ')}`);
        }
      }
      setCannibalWarnings(warnings);
    });
  }, [keywords, domains]);

  const canProceed = url.trim().length > 0;

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput('');
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleImport = async () => {
    if (!canProceed) return;
    try {
      const res = await fetch('/api/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, keywords, country, device, domainId: folderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast.success('Content imported successfully!');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Import failed');
    }
  };

  const countryData = COUNTRIES[country] || COUNTRIES.US;

  return (
    <Modal onClose={onClose} width={1130} closeOnOverlayClick>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 'auto',
          maxHeight: 'calc(100vh - 64px)',
          overflow: 'hidden',
          gap: 12,
          padding: 4,
        }}
      >
        {/* Left: Main panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #E4E4E7',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable content area */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '48px 24px',
              display: 'flex',
              justifyContent: 'center',
            }}
            className="styled-scrollbar"
          >
            <div
              style={{
                width: '100%',
                maxWidth: 576,
                display: 'flex',
                flexDirection: 'column',
                gap: 32,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 24,
                    lineHeight: '32px',
                    fontWeight: 600,
                    color: '#000',
                    fontFamily: 'var(--font-family-primary)',
                    letterSpacing: 0,
                  }}
                >
                  Import content from URL
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: '16px',
                    color: '#52525C',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Enter the URL of an existing page and select keywords to target
                </p>
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Keyword + Folder row */}
                <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between' }}>
                  {/* Keyword input */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 500,
                        color: '#3F3F47',
                        paddingBottom: 6,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      Keyword
                    </label>
                    <div
                      style={{
                        minHeight: 40,
                        border: '1px solid #D4D4D8',
                        borderRadius: 8,
                        padding: '4px 12px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 4,
                        background: '#fff',
                        boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        cursor: 'text',
                      }}
                      onClick={() => {
                        const input = document.getElementById('keyword-import-input');
                        input?.focus();
                      }}
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
                            onClick={(e) => { e.stopPropagation(); removeKeyword(kw); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              color: '#52525C',
                              fontSize: 14,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        id="keyword-import-input"
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKeyDown}
                        onBlur={() => { if (keywordInput.trim()) addKeyword(keywordInput); }}
                        placeholder={keywords.length === 0 ? 'Enter keyword(s) you want to rank for...' : ''}
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
                  </div>

                  {/* Folder selector */}
                  <div style={{ width: 188 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        lineHeight: '20px',
                        fontWeight: 500,
                        color: '#3F3F47',
                        paddingBottom: 6,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      Folder
                    </label>
                    <button
                      type="button"
                      disabled
                      style={{
                        width: '100%',
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 12px',
                        background: '#F8F8F9',
                        border: '1px solid #D4D4D8',
                        borderRadius: 8,
                        fontSize: 14,
                        lineHeight: '20px',
                        color: '#9F9FA9',
                        cursor: 'not-allowed',
                        opacity: 0.6,
                        fontFamily: 'var(--font-family-primary)',
                        boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                      }}
                    >
                      {/* Folder icon */}
                      <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0, color: '#9F9FA9' }}>
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 9.776q.168-.026.344-.026h15.812q.176 0 .344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                      </svg>
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Unassigned
                      </span>
                      <svg viewBox="0 0 20 20" width="20" height="20" style={{ flexShrink: 0, color: '#9F9FA9' }}>
                        <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* URL input */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 500,
                      color: '#3F3F47',
                      paddingBottom: 6,
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    URL
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {/* Globe icon left */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#9F9FA9',
                        zIndex: 1,
                        pointerEvents: 'none',
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" />
                      </svg>
                    </div>
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article.html"
                      style={{ paddingLeft: 40 }}
                    />
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      minHeight: 20,
                      paddingTop: 6,
                      fontSize: 14,
                      lineHeight: '20px',
                      color: '#3F3F47',
                      fontFamily: 'var(--font-family-primary)',
                    }}
                  >
                    Enter the URL from which you&apos;d like to import content into Content Editor
                  </span>
                </div>

                {/* Cannibalization warnings */}
                {cannibalWarnings.length > 0 && (
                  <div style={{
                    padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    {cannibalWarnings.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                        <span style={{ fontSize: 12, color: '#92400e', fontFamily: 'var(--font-family-primary)' }}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom bar: country + device + button */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #E4E4E7',
                    paddingTop: 24,
                    marginTop: 8,
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                      Results for
                    </span>

                    {/* Country selector */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => { setShowCountryMenu(!showCountryMenu); setShowDeviceMenu(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 0',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#3F3F47',
                          fontFamily: 'var(--font-family-primary)',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        <img
                          src={countryData.flag}
                          alt={countryData.name}
                          style={{ width: 20, height: 15, boxShadow: 'rgba(0,0,0,0.5) 0px 0px 1px 0px' }}
                        />
                        <span>{countryData.name}</span>
                        <svg viewBox="0 0 20 20" width="20" height="20" style={{ color: '#9F9FA9' }}>
                          <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showCountryMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: 4,
                            background: '#fff',
                            border: '1px solid #E4E4E7',
                            borderRadius: 8,
                            boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                            zIndex: 10,
                            minWidth: 180,
                            overflow: 'hidden',
                          }}
                        >
                          {Object.entries(COUNTRIES).map(([code, c]) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => { setCountry(code); setShowCountryMenu(false); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                background: code === country ? '#F4F4F5' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                color: '#09090B',
                                fontFamily: 'var(--font-family-primary)',
                                textAlign: 'left',
                              }}
                            >
                              <img src={c.flag} alt={c.name} style={{ width: 20, height: 15 }} />
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span style={{ fontSize: 14, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                      on
                    </span>

                    {/* Device selector */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => { setShowDeviceMenu(!showDeviceMenu); setShowCountryMenu(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 0',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#3F3F47',
                          fontFamily: 'var(--font-family-primary)',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        {device}
                        <svg viewBox="0 0 20 20" width="20" height="20" style={{ color: '#9F9FA9' }}>
                          <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showDeviceMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: 4,
                            background: '#fff',
                            border: '1px solid #E4E4E7',
                            borderRadius: 8,
                            boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                            zIndex: 10,
                            overflow: 'hidden',
                          }}
                        >
                          {DEVICES.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { setDevice(d); setShowDeviceMenu(false); }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: d === device ? '#F4F4F5' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                color: '#09090B',
                                fontFamily: 'var(--font-family-primary)',
                                textAlign: 'left',
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom button bar */}
          <div
            style={{
              padding: 12,
              display: 'flex',
              justifyContent: 'center',
              borderTop: '1px solid #E4E4E7',
            }}
          >
            <div style={{ width: '100%', maxWidth: 512, display: 'flex', gap: 12 }}>
              <Button
                type="button"
                variant="primary"
                disabled={!canProceed || isImporting}
                busy={isImporting}
                onClick={handleImport}
                style={{ width: '100%' }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isImporting ? 'Importing...' : step === 1 ? (
                    <>
                      Next
                      <span style={{ fontWeight: 400 }}> — Deep analysis</span>
                    </>
                  ) : (
                    'Import content'
                  )}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Steps sidebar */}
        <div
          style={{
            width: 312,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 8px',
          }}
        >
          {/* Step 1 — Keywords (active) */}
          <div
            style={{
              padding: '12px 16px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              background: '#F4F4F5',
              borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#F97316',
                  border: '1px solid #F97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: '20px',
                    color: '#fff',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  1
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 600,
                    color: '#000',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Keywords
                </span>
              </div>
            </div>
          </div>

          {/* Connector line */}
          <div style={{ padding: '12px 16px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                position: 'absolute',
                left: 26,
                top: 0,
                height: 12,
                width: 1,
                background: '#E4E4E7',
                transform: 'translateX(-50%)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: '1px solid #E4E4E7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: '20px',
                    color: '#52525C',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  2
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 400,
                    color: '#000',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Deep analysis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImportContentModal;
