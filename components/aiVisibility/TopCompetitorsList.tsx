import React from 'react';
import { Button } from '../core';

const FONT = 'var(--font-family-primary)';
const favicon = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
// `rank` is explicit (not the array index) so an outsider can read e.g. #7 after #1..#4;
// `outsider` draws a dashed divider above the row (compared competitor below the top list).
type Row = { domain: string; score: number; rank: number; outsider?: boolean };

/** Right-side "Top Competitors" panel shown beside the trend line — pick one to compare. */
const TopCompetitorsList = ({ competitors, selected, onSelect }: { competitors: Row[]; selected: string | null; onSelect: (d: string) => void }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
         <div style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>Top Competitors</div>
         <div style={{ fontSize: 13, color: '#71717B', fontFamily: FONT }}>Click on a competitor to compare</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
         {competitors.map((c) => {
            const isSel = c.domain === selected;
            return (
               <React.Fragment key={c.domain}>
                  {c.outsider ? <div style={{ height: 1, background: 'repeating-linear-gradient(to right, #E4E4E7 0 4px, transparent 4px 8px)' }} /> : null}
                  <Button type="button" variant="transparent" size="sm" onClick={() => onSelect(c.domain)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-start', padding: 0, height: 'auto', minHeight: 'unset', fontFamily: FONT }}>
                     <span style={{ width: 22, fontSize: 13, color: '#9F9FA9', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>{`#${c.rank}`}</span>
                     { /* eslint-disable-next-line @next/next/no-img-element */ }
                     <img alt="" src={favicon(c.domain)} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} />
                     <span title={c.domain} style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 14, fontWeight: isSel ? 600 : 500, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.domain}</span>
                     {isSel ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#783AFB', flexShrink: 0 }} /> : null}
                     <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', flexShrink: 0 }}>{c.score}</span>
                  </Button>
               </React.Fragment>
            );
         })}
      </div>
   </div>
);

export default TopCompetitorsList;
