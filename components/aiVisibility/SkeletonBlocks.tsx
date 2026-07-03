import React from 'react';

/** Shared pulsing skeleton primitives for AI Visibility. The pulse keyframes
 * (`aivPulse`) are injected once by AiVisPageShell. */

const base: React.CSSProperties = { background: '#F4F4F5', borderRadius: 6, display: 'inline-block' };

export const SkeletonBox = ({ w, h, radius = 6, style }: { w?: number | string; h?: number | string; radius?: number; style?: React.CSSProperties }) => (
   <span className="aiv-pulse" style={{ ...base, width: w, height: h, borderRadius: radius, ...style }} />
);

/** The 5-bar "Visibility score" chart placeholder (heights 70→30%). */
export const SkeletonBars = () => (
   <div style={{ display: 'flex', height: 300, width: '100%' }}>
      {[70, 60, 50, 40, 30].map((h) => (
         <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <SkeletonBox w={28} h={16} radius={4} />
            <span className="aiv-pulse" style={{ ...base, width: 64, height: `${h}%`, borderRadius: '8px 8px 0 0' }} />
            <div style={{ height: 1, width: '100%', background: '#F4F4F5' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
               <SkeletonBox w={20} h={20} radius={9999} />
               <SkeletonBox w={44} h={12} />
            </div>
         </div>
      ))}
   </div>
);

/** A stack of N label+value skeleton rows (Topics&Prompts / Sources panels). */
export const SkeletonRows = ({ count = 5, withIcon = false }: { count?: number; withIcon?: boolean }) => (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Array.from({ length: count }, (_, i) => (
         <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               {withIcon && <SkeletonBox w={20} h={20} radius={9999} />}
               <SkeletonBox w={180} h={14} />
            </div>
            <SkeletonBox w={28} h={14} />
         </div>
      ))}
   </div>
);
