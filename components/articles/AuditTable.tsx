import React, { useState } from 'react';
import type { AuditItem } from '../../pages/api/audit';

interface Props {
  items: AuditItem[];
  isLoading: boolean;
  onSelect: (item: AuditItem) => void;
  selectedId: number | null;
}

type SortKey = 'contentScore' | 'position' | 'traffic' | 'impressions' | 'ctr';

const AuditTable: React.FC<Props> = ({ items, isLoading, onSelect, selectedId }) => {
  const [sortBy, setSortBy] = useState<SortKey>('traffic');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const sorted = [...items].sort((a, b) => {
    const av = a[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    const bv = b[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <span style={{ color: '#d4d4d8', marginLeft: 3 }}>↕</span>;
    return <span style={{ color: '#783afb', marginLeft: 3 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f97316';
    return '#ef4444';
  };

  const formatNum = (n: number | null): string => {
    if (n === null || n === undefined) return '—';
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  };

  const formatCtr = (n: number | null): string => {
    if (n === null || n === undefined) return '—';
    return `${n.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 13, color: '#9f9fa9' }}>
        No articles found for this domain. Generate your first article to see it here.
      </div>
    );
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    color: '#71717a',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #e4e4e7',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #f4f4f5',
    fontSize: 13,
    verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '40%' }}>Page / Main keyword</th>
            <th style={{ ...thStyle, textAlign: 'center', width: 110 }} onClick={() => handleSort('contentScore')}>
              Content Score<SortArrow col="contentScore" />
            </th>
            <th style={{ ...thStyle, textAlign: 'center', width: 80 }} onClick={() => handleSort('position')}>
              Position<SortArrow col="position" />
            </th>
            <th style={{ ...thStyle, textAlign: 'center', width: 80 }} onClick={() => handleSort('traffic')}>
              Traffic<SortArrow col="traffic" />
            </th>
            <th style={{ ...thStyle, textAlign: 'center', width: 80 }} onClick={() => handleSort('impressions')}>
              Impr.<SortArrow col="impressions" />
            </th>
            <th style={{ ...thStyle, textAlign: 'center', width: 70 }} onClick={() => handleSort('ctr')}>
              CTR<SortArrow col="ctr" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? '#f3eeff' : undefined,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: '#09090b' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#783afb', marginTop: 1 }}>
                    {item.mainKeyword ? `Keyword: ${item.mainKeyword}` : item.url}
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <span style={{ fontWeight: 700, color: scoreColor(item.contentScore), fontSize: 14 }}>
                    {item.contentScore || '—'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: item.position !== null ? '#09090b' : '#9f9fa9' }}>
                  {item.position !== null ? item.position : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: item.traffic !== null ? '#09090b' : '#9f9fa9' }}>
                  {formatNum(item.traffic)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: item.impressions !== null ? '#09090b' : '#9f9fa9' }}>
                  {formatNum(item.impressions)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', color: item.ctr !== null ? '#09090b' : '#9f9fa9' }}>
                  {formatCtr(item.ctr)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AuditTable;
