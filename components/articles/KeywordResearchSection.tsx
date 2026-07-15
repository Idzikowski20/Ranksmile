import React, { useState } from 'react';

export interface KeywordItem {
  id?: number;
  keyword: string;
  gsc_volume_range?: string | null;
  gsc_position?: number | null;
  ads_monthly_volume?: number | null;
  ads_competition?: string | null;
  ads_cpc?: number | null;
  relevance_score?: number | null;
  is_covered?: boolean;
  source?: string;
  opportunity_score?: number;
  frequency?: number;
  avgMonthlySearches?: number | null;
}

interface Props {
  keywords: KeywordItem[];
  isLoading?: boolean;
  onSuggest?: () => void;
  isSuggesting?: boolean;
  suggestedKeywords?: KeywordItem[];
  onAcceptSuggestion?: (kw: KeywordItem) => void;
  onDismissSuggestion?: (kw: KeywordItem) => void;
  onToggleCoverage?: (kw: KeywordItem) => void;
  gapKeywords?: KeywordItem[];
}

const competitionColor = (comp: string | null | undefined): string => {
  if (comp === 'LOW') return '#16a34a';
  if (comp === 'MEDIUM') return '#d97706';
  if (comp === 'HIGH') return '#dc2626';
  return '#9f9fa9';
};

const KeywordResearchSection: React.FC<Props> = ({
  keywords, isLoading, onSuggest, isSuggesting,
  suggestedKeywords, onAcceptSuggestion, onDismissSuggestion, onToggleCoverage,
  gapKeywords,
}) => {
  const [search, setSearch] = useState('');

  const filtered = search
    ? keywords.filter((k) => k.keyword.toLowerCase().includes(search.toLowerCase()))
    : keywords;

  const sorted = [...filtered].sort((a, b) => {
    const aOpp = a.opportunity_score ?? 0;
    const bOpp = b.opportunity_score ?? 0;
    if (bOpp !== aOpp) return bOpp - aOpp;
    return (b.ads_monthly_volume ?? 0) - (a.ads_monthly_volume ?? 0);
  });

  return (
    <div style={{ padding: '0 0 12px' }}>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}>
          <circle cx={11} cy={11} r={8} /><line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          type="text"
          placeholder="Filter keywords"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 6, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box', fontFamily: 'var(--font-family-primary)' }}
        />
      </div>

      {isLoading ? (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', fontFamily: 'var(--font-family-primary)' }}>Loading keywords…</p>
      ) : sorted.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0', fontStyle: 'italic', fontFamily: 'var(--font-family-primary)' }}>No keywords yet. Use &quot;Suggest&quot; to fetch keyword ideas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map((kw, i) => {
            const covered = kw.is_covered;
            const oppScore = kw.opportunity_score ?? 0;
            const oppDot = oppScore > 0.6 ? '#16a34a' : oppScore > 0.3 ? '#d97706' : '#9f9fa9';
            const isGap = kw.frequency && kw.frequency > 0;
            return (
              <div
                key={kw.keyword + i}
                onClick={() => onToggleCoverage?.(kw)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 12px', borderRadius: 8,
                  background: covered ? '#f0fdf4' : isGap ? '#fef2f2' : '#fafafa',
                  border: `1px solid ${covered ? '#bbf7d0' : isGap ? '#fecaca' : '#f4f4f5'}`,
                  gap: 6, cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {/* Opportunity dot */}
                    <span title={`Opportunity: ${Math.round(oppScore * 100)}%`} style={{ width: 6, height: 6, borderRadius: '50%', background: oppDot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }} title={kw.keyword}>
                      {kw.keyword}
                    </span>
                    {covered && <span style={{ fontSize: 10, color: '#16a34a', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>in text</span>}
                    {kw.source === 'ads_suggestion' && (
                      <span style={{ fontSize: 10, color: '#fff', background: '#f29964', borderRadius: 4, padding: '0 4px', lineHeight: '16px', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>new</span>
                    )}
                    {isGap && (
                      <span style={{ fontSize: 10, color: '#dc2626', background: '#fff1f2', borderRadius: 4, padding: '0 4px', lineHeight: '16px', flexShrink: 0, fontFamily: 'var(--font-family-primary)' }}>competitor</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    {kw.ads_monthly_volume != null && kw.ads_monthly_volume > 0 && (
                      <span style={{ fontSize: 11, color: '#52525c', fontFamily: 'var(--font-family-primary)' }}>{kw.ads_monthly_volume.toLocaleString()}/mo</span>
                    )}
                    {kw.ads_competition && (
                      <span style={{ fontSize: 11, color: competitionColor(kw.ads_competition), fontFamily: 'var(--font-family-primary)', fontWeight: 600 }}>
                        {kw.ads_competition}
                      </span>
                    )}
                    {kw.gsc_volume_range && (
                      <span style={{ fontSize: 11, color: '#9f9fa9', fontFamily: 'var(--font-family-primary)' }}>{kw.gsc_volume_range}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Competitor gap keywords */}
      {gapKeywords && gapKeywords.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #f4f4f5', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9f9fa9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-family-primary)' }}>
            Competitor Gap ({gapKeywords.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {gapKeywords.slice(0, 10).map((kw, i) => (
              <div key={kw.keyword + i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 12, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }}>{kw.keyword}</span>
                <span style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>{kw.frequency}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested keywords (from Ads) */}
      {suggestedKeywords && suggestedKeywords.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #f4f4f5', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9f9fa9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-family-primary)' }}>
            Suggested from Ads
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestedKeywords.map((kw, i) => (
              <div key={kw.keyword + i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: '#f3eeff', border: '1px solid #ddd6fe' }}>
                <span style={{ fontSize: 12, color: '#18181b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }}>{kw.keyword}</span>
                {(() => { const vol = kw.ads_monthly_volume ?? kw.avgMonthlySearches; return vol != null && vol > 0 ? <span style={{ fontSize: 11, color: '#6d28d9', fontFamily: 'var(--font-family-primary)', whiteSpace: 'nowrap' }}>{vol.toLocaleString()}/mo</span> : null; })()}
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptSuggestion?.(kw); }}
                  style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: 'none', background: '#f29964', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                >+ Add</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismissSuggestion?.(kw); }}
                  style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', color: '#9f9fa9', cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggest button */}
      {onSuggest && (
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          style={{
            width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            background: 'transparent', color: '#f29964', border: '1px dashed #c4b5fd',
            cursor: isSuggesting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-family-primary)',
            opacity: isSuggesting ? 0.6 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => { if (!isSuggesting) e.currentTarget.style.background = '#f3eeff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {isSuggesting ? 'Fetching suggestions…' : '+ Suggest keywords from Ads'}
        </button>
      )}
    </div>
  );
};

export default KeywordResearchSection;
