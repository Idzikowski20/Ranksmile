import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useFetchDomains } from '../../services/domains';
import KeywordSuggestInput from '../../components/articles/KeywordSuggestInput';

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  US: { name: 'United States', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/us.svg' },
  GB: { name: 'United Kingdom', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/gb.svg' },
  PL: { name: 'Poland', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/pl.svg' },
  DE: { name: 'Germany', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/de.svg' },
  FR: { name: 'France', flag: 'https://cdn.jsdelivr.net/npm/flag-icons@6.11.1/flags/4x3/fr.svg' },
};

const ImportPage: NextPage = () => {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [country, setCountry] = useState('PL');
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const { data: domainsData } = useFetchDomains(router);
  const domains: DomainType[] = domainsData?.domains || [];

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleNext = async () => {
    if (!url.trim()) return;
    const params = new URLSearchParams({
      url: url.trim(),
      keywords: keywords.join(','),
      country,
      flow: 'import',
    });
    router.push(`/articles/deep-analysis?${params.toString()}`);
  };

  const canProceed = url.trim().length > 0;
  const countryData = COUNTRIES[country] || COUNTRIES.US;

  return (
    <DashboardLayout domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>Import Content — SerpBear</title></Head>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9ff',
        }}
      >
        <div
          style={{
            padding: 4,
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              border: '1px solid #E4E4E7',
              background: '#fff',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Scrollable content */}
            <div
              style={{
                padding: '48px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'auto',
                width: '100%',
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
                      <KeywordSuggestInput
                        keywords={keywords}
                        onAdd={addKeyword}
                        onRemove={removeKeyword}
                        country={country}
                        placeholder="Enter keyword(s) you want to rank for..."
                      />
                    </div>

                    {/* Folder selector */}
                    <div style={{ width: 188 }}>
                      <label
                        style={{
                          display: 'block', fontSize: 14, lineHeight: '20px',
                          fontWeight: 500, color: '#3F3F47', paddingBottom: 6,
                          fontFamily: 'var(--font-family-primary)',
                        }}
                      >
                        Folder
                      </label>
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%', height: 40, display: 'flex', alignItems: 'center',
                          gap: 8, padding: '0 12px', background: '#F8F8F9',
                          border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 14,
                          lineHeight: '20px', color: '#9F9FA9', cursor: 'not-allowed',
                          opacity: 0.6, fontFamily: 'var(--font-family-primary)',
                          boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                        }}
                      >
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
                        display: 'block', fontSize: 14, lineHeight: '20px',
                        fontWeight: 500, color: '#3F3F47', paddingBottom: 6,
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      URL
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          position: 'absolute', left: 12, top: '50%',
                          transform: 'translateY(-50%)', display: 'flex',
                          alignItems: 'center', color: '#9F9FA9', zIndex: 1,
                          pointerEvents: 'none',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25zM7.5 6h.008v.008H7.5zm2.25 0h.008v.008H9.75z" />
                        </svg>
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article.html"
                        style={{
                          width: '100%', height: 40, paddingLeft: 40, paddingRight: 12,
                          border: '1px solid #D4D4D8', borderRadius: 8, fontSize: 14,
                          lineHeight: '20px', color: '#09090B', background: '#fff',
                          outline: 'none', fontFamily: 'var(--font-family-primary)',
                          boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        display: 'inline-block', minHeight: 20, paddingTop: 6,
                        fontSize: 14, lineHeight: '20px', color: '#3F3F47',
                        fontFamily: 'var(--font-family-primary)',
                      }}
                    >
                      Enter the URL from which you&apos;d like to import content into Content Editor
                    </span>
                  </div>

                  {/* Bottom bar */}
                  <div
                    style={{
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                      justifyContent: 'space-between', borderTop: '1px solid #E4E4E7',
                      paddingTop: 24, paddingLeft: 24, paddingRight: 24,
                      marginLeft: -24, marginRight: -24, gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', lineHeight: '32px' }}>
                      <span style={{ fontSize: 14, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>
                        Results for
                      </span>

                      {/* Country selector */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setShowCountryMenu(!showCountryMenu)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: 0, fontSize: 14, fontWeight: 600, color: '#3F3F47',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                        >
                          <img src={countryData.flag} alt={countryData.name} style={{ width: 20, height: 15, boxShadow: 'rgba(0,0,0,0.5) 0px 0px 1px 0px' }} />
                          <span>{countryData.name}</span>
                          <svg viewBox="0 0 20 20" width="20" height="20" style={{ color: '#9F9FA9' }}>
                            <path fill="currentColor" fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
                          </svg>
                        </button>
                        {showCountryMenu && (
                          <div
                            style={{
                              position: 'absolute', top: '100%', left: 0, marginTop: 4,
                              background: '#fff', border: '1px solid #E4E4E7',
                              borderRadius: 8, boxShadow: '0px 4px 16px rgba(0,0,0,0.08)',
                              zIndex: 10, minWidth: 180, overflow: 'hidden',
                            }}
                          >
                            {Object.entries(COUNTRIES).map(([code, c]) => (
                              <button
                                key={code} type="button"
                                onClick={() => { setCountry(code); setShowCountryMenu(false); }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '8px 12px', background: code === country ? '#F4F4F5' : 'transparent',
                                  border: 'none', cursor: 'pointer', fontSize: 14, color: '#09090B',
                                  fontFamily: 'var(--font-family-primary)', textAlign: 'left',
                                }}
                              >
                                <img src={c.flag} alt={c.name} style={{ width: 20, height: 15 }} />
                                {c.name}
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

            {/* Bottom button */}
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center', width: '100%', borderTop: '1px solid #E4E4E7' }}>
              <div style={{ width: '100%', maxWidth: 512, display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  disabled={!canProceed}
                  onClick={handleNext}
                  style={{
                    width: '100%', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8, padding: '10px 24px',
                    borderRadius: 8, fontSize: 16, lineHeight: '24px', fontWeight: 600,
                    border: 'none', fontFamily: 'var(--font-family-primary)',
                    cursor: canProceed ? 'pointer' : 'not-allowed',
                    background: canProceed ? '#2F2F34' : '#9F9FA9',
                    color: '#fff', opacity: canProceed ? 1 : 0.6,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Next<span style={{ fontWeight: 400 }}> — Deep analysis</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ImportPage;
