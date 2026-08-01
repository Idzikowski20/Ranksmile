import React from 'react';
import { Button, Checkbox } from '../../koala/core';

const FONT = 'var(--font-family-primary)';
const LINK_COLOR = 'rgb(35, 95, 226)';

export const ALL_COLUMNS = [
  { id: 'keyword', label: 'Keyword', locked: true },
  { id: 'intent', label: 'Intent' },
  { id: 'position', label: 'Position', locked: true },
  { id: 'sf', label: 'SERP Features' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'trafficShare', label: 'Traffic %' },
  { id: 'volume', label: 'Volume' },
  { id: 'difficulty', label: 'KD %' },
  { id: 'url', label: 'URL' },
  { id: 'updatedAt', label: 'Last Update' },
  { id: 'topic', label: 'Topic' },
  { id: 'trend', label: 'Trend' },
  { id: 'opportunityScore', label: 'Opportunity' },
] as const;

export type ColumnId = (typeof ALL_COLUMNS)[number]['id'];

export const DEFAULT_VISIBLE: ColumnId[] = [
  'keyword', 'intent', 'position', 'sf', 'traffic', 'trafficShare', 'volume', 'difficulty', 'url', 'updatedAt',
];

const dropdownPanel: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  background: '#fff',
  border: '1px solid #dbded4',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  zIndex: 30,
  fontFamily: FONT,
};

function IconSettings() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false">
      <path d="M6.5 1.5h3l.4 1.5 1.4.6 1.4-.5 1.5 1.5-.5 1.4.6 1.4 1.5.4v3l-1.5.4-.6 1.4.5 1.4-1.5 1.5-1.4-.5-1.4.6L9.5 14.5h-3l-.4-1.5-1.4-.6-1.4.5L1.8 11.4l.5-1.4-.6-1.4L.2 8.2v-3l1.5-.4.6-1.4-.5-1.4L3.3 1.5l1.4.5 1.4-.6L6.5 1.5Zm1.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </svg>
  );
}

type OrganicColumnMenuProps = {
  open: boolean;
  onToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
  visibleCols: ColumnId[];
  onChange: (cols: ColumnId[]) => void;
};

export function OrganicColumnMenu({
  open,
  onToggle,
  menuRef,
  visibleCols,
  onChange,
}: OrganicColumnMenuProps) {
  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<IconSettings />}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Manage columns
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 36,
            height: 18,
            padding: '0 6px',
            borderRadius: 999,
            background: '#F0F0F2',
            color: '#6A6772',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: FONT,
            lineHeight: 1,
          }}
          >
            {`${visibleCols.length}/${ALL_COLUMNS.length}`}
          </span>
        </span>
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Show table columns"
          style={{
            ...dropdownPanel,
            top: 'calc(100% + 6px)',
            width: 240,
            maxHeight: 'min(420px, 70vh)',
            overflowY: 'auto',
            padding: '12px 0 8px',
          }}
        >
          <div style={{
            padding: '0 14px 6px',
            fontSize: 14,
            fontWeight: 700,
            color: '#181225',
          }}
          >
            Show table columns
          </div>
          <button
            type="button"
            onClick={() => onChange([...DEFAULT_VISIBLE])}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0 14px 10px',
              margin: 0,
              fontSize: 13,
              color: LINK_COLOR,
              cursor: 'pointer',
              fontFamily: FONT,
              textAlign: 'left',
              width: '100%',
            }}
          >
            Reset to default
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ALL_COLUMNS.map((col) => {
              const on = visibleCols.includes(col.id);
              const locked = 'locked' in col && col.locked === true;
              return (
                <label
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 14px',
                    fontSize: 13,
                    color: locked ? '#878490' : '#302E36',
                    cursor: locked ? 'default' : 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Checkbox
                    size="sm"
                    checked={on}
                    disabled={locked}
                    onChange={(checked) => {
                      if (locked) return;
                      if (checked) {
                        onChange(
                          ALL_COLUMNS.map((c) => c.id).filter(
                            (id) => visibleCols.includes(id) || id === col.id,
                          ),
                        );
                      } else {
                        onChange(visibleCols.filter((id) => id !== col.id));
                      }
                    }}
                  />
                  <span>{col.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
