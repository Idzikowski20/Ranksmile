import React, { useMemo } from 'react';
import type { OrganicKeyword } from '../../../lib/organicResearch/types';
import { absoluteUrl, normalizeFeature, SerpMiniIcon } from './organicSerp';

const FONT = 'var(--font-family-primary)';
const LINK_COLOR = 'rgb(35, 95, 226)';

const SERP_CATALOG: { key: string; label: string; match: string[] }[] = [
  { key: 'ai_overview', label: 'AI Overview', match: ['ai_overview', 'ai overview', 'sge'] },
  { key: 'reviews', label: 'Reviews', match: ['reviews', 'review'] },
  { key: 'images', label: 'Image', match: ['images', 'image', 'image_pack'] },
  { key: 'video', label: 'Video', match: ['video', 'videos'] },
  { key: 'video_carousel', label: 'Video carousel', match: ['video_carousel', 'video carousel'] },
  { key: 'people_also_ask', label: 'People also ask', match: ['people_also_ask', 'people also ask', 'paa'] },
  { key: 'knowledge_panel', label: 'Knowledge panel', match: ['knowledge_panel', 'knowledge graph', 'knowledge_graph'] },
  { key: 'related_searches', label: 'Related searches', match: ['related_searches', 'related searches'] },
  { key: 'featured_snippet', label: 'Featured snippet', match: ['featured_snippet', 'featured snippet', 'snippet'] },
  { key: 'sitelinks', label: 'Sitelinks', match: ['sitelinks', 'sitelink'] },
  { key: 'local_pack', label: 'Local pack', match: ['local_pack', 'local pack', 'map'] },
  { key: 'shopping', label: 'Shopping', match: ['shopping', 'product'] },
];

export function ExpandedPanel({
  kw,
  onFilterKeyword,
}: {
  kw: OrganicKeyword;
  onFilterKeyword?: (keyword: string) => void;
}) {
  const href = absoluteUrl(kw.url);
  const thenPos = kw.previousPosition;
  const curr = kw.position;

  const activeSet = useMemo(
    () => new Set(kw.serpFeatures.map(normalizeFeature)),
    [kw.serpFeatures],
  );

  const isFeatureOn = (match: string[]) => match.some((m) => {
    const n = normalizeFeature(m);
    for (const f of activeSet) {
      if (f.includes(n) || n.includes(f)) return true;
    }
    return false;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '16px 20px 20px 48px',
      background: '#F7F9FC',
      borderBottom: '1px solid #dbded4',
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT, fontSize: 13 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#181225', marginRight: 4 }}>
            Position
          </span>
          <strong style={{ color: '#181225' }}>{thenPos != null ? thenPos : '—'}</strong>
          <span style={{ color: '#6A6772' }}>→</span>
          <strong style={{ color: '#181225' }}>{curr != null ? curr : '—'}</strong>
        </div>
        {onFilterKeyword && (
          <button
            type="button"
            onClick={() => onFilterKeyword(kw.keyword)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#E07D42',
              fontSize: 12,
              fontFamily: FONT,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Filter by: <span style={{ fontWeight: 600 }}>{kw.keyword}</span>
          </button>
        )}
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            color: LINK_COLOR,
            fontFamily: 'inherit',
            fontSize: 13,
            textDecoration: 'none',
            wordBreak: 'break-all',
            lineHeight: 1.4,
          }}
        >
          {href}
        </a>
      ) : (
        <span style={{ color: '#878490', fontSize: 13, fontFamily: FONT }}>No ranking URL</span>
      )}

      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#6A6772',
          fontFamily: FONT,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
        >
          SERP Features
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '6px 16px',
          maxWidth: 560,
        }}
        >
          {SERP_CATALOG.map((item) => {
            const on = isFeatureOn(item.match);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontFamily: FONT,
                  color: on ? '#302E36' : '#A29FAA',
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: on ? 1 : 0.45,
                }}
                >
                  <SerpMiniIcon name={item.key} />
                </span>
                {item.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
