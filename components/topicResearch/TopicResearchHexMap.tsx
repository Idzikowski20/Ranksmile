import React from 'react';
import { ideaMapCoords } from '../../lib/topicClustering';
import type { TopicCluster, TopicIdea } from '../../lib/topicResearchTypes';

const FONT = 'var(--font-family-primary)';

const CLUSTER_COLORS = ['#783AFB', '#6366F1', '#0EA5E9', '#14B8A6', '#22C55E', '#EAB308', '#F97316', '#EF4444'];

function hexPath(cx: number, cy: number, size: number): string {
   const pts: string[] = [];
   for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
   }
   return `M ${pts.join(' L ')} Z`;
}

function ideaFill(idea: TopicIdea): string {
   if (idea.position != null && idea.position > 0 && idea.position <= 50) return '#1AB25E';
   if (idea.recommended) return '#FF6F77';
   return '#D4D4D8';
}

export type HexMapItem = { idea: TopicIdea; cluster: TopicCluster; clusterIdx: number; ideaIdx: number };

type Props = {
   items: HexMapItem[];
   selectedMain: string | null;
   onSelect: (item: HexMapItem) => void;
   width?: number;
   height?: number;
};

const TopicResearchHexMap = ({ items, selectedMain, onSelect, width = 720, height = 520 }: Props) => {
   const pad = 48;
   const cx = width / 2;
   const cy = height / 2;
   const hexSize = 22;

   const ringLabels: Array<{ label: string; r: number }> = [
      { label: 'HIGH KD', r: 0.85 },
      { label: 'MEDIUM KD', r: 0.55 },
      { label: 'LOW KD', r: 0.25 },
   ];

   return (
      <div style={{ border: '1px solid #DAD9DE', boxShadow: '0 4px 0 0 #e4e4e7', borderRadius: 12, background: '#fff', padding: 16, fontFamily: FONT }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>Topic map</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#52525C' }}>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#1AB25E' }} /> Covered</span>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#FF6F77' }} /> Recommended</span>
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#D4D4D8' }} /> Not covered</span>
            </div>
         </div>
         <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', maxHeight: 520 }}>
            {ringLabels.map(({ label, r }) => (
               <g key={label}>
                  <circle cx={cx} cy={cy} r={(height / 2 - pad) * r} fill="none" stroke="#F4F4F5" strokeWidth={1.5} strokeDasharray="4 4" />
                  <text x={cx} y={cy - (height / 2 - pad) * r + 14} textAnchor="middle" fontSize={10} fill="#9F9FA9" fontFamily={FONT}>{label}</text>
               </g>
            ))}
            {items.map((item) => {
               const coords = ideaMapCoords(item.idea, item.clusterIdx, item.ideaIdx, items.length > 0 ? new Set(items.map((i) => i.clusterIdx)).size : 1);
               const hx = pad + coords.x * (width - pad * 2);
               const hy = pad + coords.y * (height - pad * 2);
               const fill = ideaFill(item.idea);
               const stroke = selectedMain === item.idea.main ? '#783AFB' : CLUSTER_COLORS[item.clusterIdx % CLUSTER_COLORS.length];
               const selected = selectedMain === item.idea.main;
               return (
                  <g key={`${item.clusterIdx}-${item.idea.main}`} style={{ cursor: 'pointer' }} onClick={() => onSelect(item)}>
                     <path
                        d={hexPath(hx, hy, hexSize)}
                        fill={fill}
                        fillOpacity={selected ? 1 : 0.85}
                        stroke={stroke}
                        strokeWidth={selected ? 2.5 : 1.5}
                     />
                     {selected && (
                        <title>{item.idea.main}</title>
                     )}
                  </g>
               );
            })}
         </svg>
      </div>
   );
};

export default TopicResearchHexMap;
