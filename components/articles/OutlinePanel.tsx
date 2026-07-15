import React from 'react';

export interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface Props {
  headings: HeadingItem[];
  keyword?: string;
  activeHeadingPos?: number | null;
  onHeadingClick: (pos: number) => void;
}

const OutlinePanel = ({ headings, keyword, activeHeadingPos, onHeadingClick }: Props) => {
  return (
    <div
      className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        background: 'var(--color-surface-strong)',
        borderRight: '1px solid var(--color-border-strong)',
      }}
    >
      {/* Header */}
      <div
        className="px-ds-6 pt-ds-7 pb-ds-5"
        style={{ borderBottom: '1px solid var(--color-border-strong)' }}
      >
        <div
          className="uppercase tracking-widest font-semibold"
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          Outline
        </div>
        {keyword && (
          <div
            className="mt-ds-1 font-medium truncate"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {keyword}
          </div>
        )}
      </div>

      {/* Heading list */}
      <div className="flex-1 overflow-y-auto styled-scrollbar-dark py-ds-4">
        {headings.length === 0 ? (
          <p
            className="px-ds-6 py-ds-3 italic"
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'rgba(255,255,255,0.2)',
            }}
          >
            No headings yet
          </p>
        ) : (
          headings.map((h, i) => {
            const isActive = activeHeadingPos === h.pos;
            const indent = Math.min(h.level - 1, 2);
            const pl = `var(--space-${6 + indent * 2})`;
            const getOpacity = () => {
              if (h.level === 1) return 1;
              if (h.level === 2) return 0.6;
              return 0.45;
            };
            const opacity = getOpacity();
            const size = h.level === 1 ? 'var(--font-size-sm)' : 'var(--font-size-xs)';

            return (
              <button
                key={i}
                onClick={() => onHeadingClick(h.pos)}
                className="w-full text-left px-ds-6 py-ds-3 transition-fast rounded-ds-xs block truncate"
                style={{
                  paddingLeft: pl,
                  fontSize: size,
                  color: isActive
                    ? 'var(--color-text-primary)'
                    : `rgba(255,255,255,${opacity})`,
                  fontWeight: h.level === 1 ? 500 : 400,
                  background: isActive ? 'rgba(242,153,100,0.15)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = `rgba(255,255,255,${opacity})`;
                  }
                }}
              >
                {h.text || '(empty heading)'}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OutlinePanel;
