import React, { useMemo, useRef, useState } from 'react';
import type { TopicCluster } from '../../lib/topicalMap';
import {
   MAP_VIEWBOX, MAP_CENTER, MAP_AXIS_HALF_LENGTH, MAP_RING_COUNT, MAP_RING_COLORS, MAP_AXIS_STOPS,
   MAP_HEX_MAIN, MAP_HEX_SATELLITE, MAP_HEX_LEGEND, MAP_SATELLITE_OFFSETS,
   MAP_HEX_SCALE, MAP_COVERAGE_FILL, ringRadius, nodeCenter,
} from '../../lib/topicalMapGeometry';

const FONT = 'var(--font-family-primary)';

type ColorMode = 'coverage' | 'kd';

/** rAF-throttled setter: at most one pending update per animation frame, so
 * fast pointer movement over the SVG doesn't queue a setState per pixel.
 * Pending value is boxed (`{ value: T }`) so a legitimately-queued `null`
 * (mouseleave clearing the tooltip) is distinguishable from "nothing queued". */
function useRafThrottledState<T>(initial: T): [T, (v: T) => void] {
   const [state, setState] = useState(initial);
   const pendingRef = useRef<{ value: T } | null>(null);
   const frameRef = useRef<number | null>(null);
   const set = (v: T) => {
      pendingRef.current = { value: v };
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
         frameRef.current = null;
         if (pendingRef.current) setState(pendingRef.current.value);
         pendingRef.current = null;
      });
   };
   return [state, set];
}

const ChevronDown = () => (
   <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, color: '#18181B' }}>
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
   </svg>
);
const CheckIcon = () => (
   <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#18181B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const LegendHex = ({ fill, stroke }: { fill: string; stroke?: string }) => (
   <svg width="15" height="15" aria-hidden="true">
      <g transform="translate(7.5, 7.5)">
         <path d={MAP_HEX_LEGEND} transform="rotate(90)" fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
      </g>
   </svg>
);

const COLOR_MODES: Array<{ value: ColorMode; label: string }> = [
   { value: 'coverage', label: 'Cluster coverage' },
   { value: 'kd', label: 'Avg. keyword difficulty' },
];

type HoverInfo = { title: string; c: TopicCluster; isSatellite: boolean; x: number; y: number };

const TopicalMapCanvas = ({ clusters, showTitles, onKeywordClick }: {
   clusters: TopicCluster[];
   showTitles: boolean;
   onKeywordClick?: (c: TopicCluster) => void;
}) => {
   const [zoom, setZoom] = useState(100);
   const [mode, setMode] = useState<ColorMode>('coverage');
   const [modeOpen, setModeOpen] = useState(false);
   const [selected, setSelected] = useState<TopicCluster | null>(null);
   const [hover, setHover] = useRafThrottledState<HoverInfo | null>(null);
   const boxRef = useRef<HTMLDivElement>(null);

   const maxKd = useMemo(() => Math.max(1, ...clusters.map((c) => c.kd)), [clusters]);
   const kdFill = (kd: number): string => {
      const t = kd / maxKd;
      if (t <= 0.34) return '#C5B8FE';
      if (t <= 0.67) return '#8F69FC';
      return '#630DE3';
   };
   const nodeStyle = (c: TopicCluster) => (mode === 'coverage'
      ? MAP_COVERAGE_FILL[c.status]
      : { fill: kdFill(c.kd), stroke: '#0A0418', strokeWidth: 0.6 });

   const onNodeMove = (c: TopicCluster, title: string, isSatellite: boolean) => (e: React.MouseEvent) => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      setHover({ title, c, isSatellite, x: e.clientX - r.left, y: e.clientY - r.top });
   };

   return (
      <div
         ref={boxRef}
         style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100vh - 300px)',
            minHeight: 400,
            maxHeight: 600,
            display: 'flex',
            borderRadius: 8,
            background: '#F4F4F5',
            // Dotted grid pattern rendered via CSS (not the SVG rect) so it
            // fills the wrapper edge-to-edge, regardless of how the inner SVG
            // gets scaled/centered by preserveAspectRatio="xMidYMid meet".
            backgroundImage: 'radial-gradient(circle at 9px 9px, #C9C9D1 1.5px, transparent 1.5px)',
            backgroundSize: '19px 19px',
         }}
      >
         <svg viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
            <defs>
               <pattern id="tm-dots" width="19" height="19" patternUnits="userSpaceOnUse">
                  <rect fill="#F4F4F5" width="100%" height="100%" />
                  <rect transform="translate(9,9)" width="1.5" height="1.5" fill="#C9C9D1" />
               </pattern>
               <linearGradient id="tm-scale-x" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9F9FA9" />
                  <stop offset="25%" stopColor="#C5B8FE" />
                  <stop offset="50%" stopColor="#0D5920" />
                  <stop offset="75%" stopColor="#C5B8FE" />
                  <stop offset="100%" stopColor="#9F9FA9" />
               </linearGradient>
               <linearGradient id="tm-scale-y" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9F9FA9" />
                  <stop offset="25%" stopColor="#C5B8FE" />
                  <stop offset="50%" stopColor="#0D5920" />
                  <stop offset="75%" stopColor="#C5B8FE" />
                  <stop offset="100%" stopColor="#9F9FA9" />
               </linearGradient>
            </defs>
            <g transform={`scale(${zoom / 100})`} style={{ transformOrigin: '50% 50%' }}>
               <g transform="scale(0.9)" style={{ transformOrigin: '50% 50%' }}>
               <g transform="rotate(-45)" style={{ transformOrigin: 'center center' }}>
                  {MAP_RING_COLORS.map((stroke, i) => (
                     <circle key={stroke} cx={MAP_CENTER.x} cy={MAP_CENTER.y} r={ringRadius(i)} fill="none" stroke={stroke} strokeWidth={0.5} />
                  ))}
                  <rect x={MAP_CENTER.x - MAP_AXIS_HALF_LENGTH} y={MAP_CENTER.y} width={MAP_AXIS_HALF_LENGTH * 2} height={0.5} fill="url(#tm-scale-x)" />
                  {MAP_AXIS_STOPS.map((s) => (
                     <text key={`x${s.off}`} x={MAP_CENTER.x + s.off} y={MAP_CENTER.y - 5} fill={s.fill} transform={`translate(${s.adj})`} style={{ fontSize: 11, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</text>
                  ))}
                  <rect x={MAP_CENTER.x} y={MAP_CENTER.y - MAP_AXIS_HALF_LENGTH} width={0.5} height={MAP_AXIS_HALF_LENGTH * 2} fill="url(#tm-scale-y)" />
                  {MAP_AXIS_STOPS.map((s) => (
                     // Same `adj`, NOT negated on this axis either — verified against the reference markup (see lib/topicalMapGeometry.ts comment).
                     <text key={`y${s.off}`} x={MAP_CENTER.x + 8} y={MAP_CENTER.y + s.off} fill={s.fill} transform={`translate(0 ${s.adj})`} style={{ fontSize: 11, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</text>
                  ))}
               </g>
               {clusters.map((c) => {
                  const st = nodeStyle(c);
                  const { cx, cy } = nodeCenter(c.map.x, c.map.y);
                  const sats = Math.min(MAP_SATELLITE_OFFSETS.length, Math.max(0, c.keywords.length - 1));
                  // More keywords → smaller hex, so busy clusters stay readable.
                  const kwFactor = Math.max(0.55, 1.25 - c.keywords.length * 0.07);
                  const hexScale = MAP_HEX_SCALE * c.map.size * kwFactor;
                  return (
                     <g key={c.id} transform={`translate(${cx} ${cy})`}>
                        <g transform={`scale(${hexScale})`}>
                           <path
                              d={MAP_HEX_MAIN}
                              fill={st.fill}
                              stroke={st.stroke}
                              strokeWidth={st.strokeWidth}
                              tabIndex={0}
                              style={{ cursor: 'pointer', outline: 'none' }}
                              onClick={() => setSelected(c)}
                              onMouseMove={onNodeMove(c, c.name, false)}
                              onMouseLeave={() => setHover(null)}
                           />
                           {Array.from({ length: sats }, (_, i) => {
                              const kwText = c.keywords[i + 1]?.text ?? c.mainKeyword;
                              return (
                                 <g key={MAP_SATELLITE_OFFSETS[i].join(',')} transform={`translate(${MAP_SATELLITE_OFFSETS[i][0]} ${MAP_SATELLITE_OFFSETS[i][1]})`}>
                                    <path
                                       d={MAP_HEX_SATELLITE}
                                       fill={st.fill}
                                       stroke={st.stroke}
                                       strokeWidth={0.4}
                                       style={{ cursor: 'pointer' }}
                                       onClick={() => onKeywordClick?.(c)}
                                       onMouseMove={onNodeMove(c, kwText, true)}
                                       onMouseLeave={() => setHover(null)}
                                    />
                                 </g>
                              );
                           })}
                        </g>
                        {showTitles && (
                           <text x={0} y={16 * hexScale + 16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: '#18181B', fontFamily: FONT }}>{c.name}</text>
                        )}
                     </g>
                  );
               })}
               </g>
            </g>
         </svg>

         {/* Legend + selected-cluster card: one flex column stack (not two independently
             absolute-positioned boxes) so the selected card always sits right below the
             legend regardless of which legend variant (coverage swatches vs. KD gradient)
             is showing — a fixed pixel offset here previously overlapped in KD mode. */}
         <div style={{ position: 'absolute', top: 16, left: 16, width: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: FONT, paddingBottom: 6 }}>Color shades by:</span>
                  <div style={{ position: 'relative' }}>
                     <button
                        type="button"
                        onClick={() => setModeOpen((o) => !o)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 40, border: '1px solid #D4D4D8', borderRadius: 10, background: '#fff', padding: '0 12px', fontSize: 14, fontFamily: FONT, color: '#18181B', cursor: 'pointer', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.06)' }}
                     >
                        {COLOR_MODES.find((mo) => mo.value === mode)!.label}
                        <span style={{ transform: modeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', display: 'inline-flex' }}><ChevronDown /></span>
                     </button>
                     {modeOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 150, background: '#fff', borderRadius: 12, padding: 6, boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09)', animation: 'growOut 0.18s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'top' }}>
                           {COLOR_MODES.map((mo) => (
                              <button
                                 key={mo.value}
                                 type="button"
                                 onClick={() => { setMode(mo.value); setModeOpen(false); }}
                                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14, color: '#18181B', cursor: 'pointer', textAlign: 'left' }}
                                 onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                                 onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                 {mo.label}
                                 {mode === mo.value && <CheckIcon />}
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
               {mode === 'coverage' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                           <LegendHex fill="#fff" stroke="#0A0418" />
                           <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Not covered</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                           <LegendHex fill="#630DE3" />
                           <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Covered</span>
                        </span>
                     </div>
                     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <LegendHex fill="#FF6F77" stroke="#A4001C" />
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Recommended</span>
                     </span>
                  </div>
               ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                     <div style={{ height: 8, borderRadius: 9999, background: 'linear-gradient(90deg, #C5B8FE 0%, #8F69FC 50%, #630DE3 100%)' }} />
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>
                        <span>Low KD</span>
                        <span>High KD</span>
                     </div>
                  </div>
               )}
            </div>

            {selected && (() => {
               const st = nodeStyle(selected);
               return (
                  <div style={{ boxSizing: 'border-box', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#71717B', fontFamily: FONT }}>Topic cluster</span>
                        <button type="button" aria-label="Close topic cluster" onClick={() => setSelected(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181B', padding: 0, display: 'inline-flex' }}>
                           <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                     </div>
                     <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B', fontFamily: FONT }}>{selected.name}</span>
                     <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#71717B', fontFamily: FONT }}>
                        <span>KD: <span style={{ color: '#18181B', fontWeight: 500 }}>{selected.kd}</span></span>
                        <span>SV: <span style={{ color: '#18181B', fontWeight: 500 }}>{selected.vol}</span></span>
                        <span>Covg.: <span style={{ color: '#18181B', fontWeight: 500 }}>{selected.covRatio}</span></span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                        <svg width="80" height="80" viewBox="-20 -20 40 40" aria-hidden="true">
                           <path d={MAP_HEX_MAIN} transform="scale(1.8)" fill={st.fill} stroke={st.stroke} strokeWidth={st.strokeWidth} />
                        </svg>
                     </div>
                  </div>
               );
            })()}
         </div>

         {/* Zoom card */}
         <div style={{ position: 'absolute', top: 16, right: 16, background: '#fff', borderRadius: 8, padding: '10px 8px', boxShadow: '0px 1px 2px 0px rgba(26,29,40,0.08), 0px 4px 12px rgba(26,29,40,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" aria-label="Decrease zoom" disabled={zoom <= 100} onClick={() => setZoom((z) => Math.max(100, z - 25))} style={{ border: 'none', background: 'transparent', cursor: zoom <= 100 ? 'not-allowed' : 'pointer', opacity: zoom <= 100 ? 0.5 : 1, color: '#3F3F47', display: 'inline-flex', padding: 2 }}>
               <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M4.25 12a.75.75 0 0 1 .75-.75h14a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75" clipRule="evenodd" /></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#3F3F47', fontFamily: FONT, minWidth: 42, textAlign: 'center' }}>{zoom}%</span>
            <button type="button" aria-label="Increase zoom" disabled={zoom >= 200} onClick={() => setZoom((z) => Math.min(200, z + 25))} style={{ border: 'none', background: 'transparent', cursor: zoom >= 200 ? 'not-allowed' : 'pointer', opacity: zoom >= 200 ? 0.5 : 1, color: '#3F3F47', display: 'inline-flex', padding: 2 }}>
               <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75" clipRule="evenodd" /></svg>
            </button>
         </div>

         {/* Hover tooltip */}
         {hover && (() => {
            const kw = hover.isSatellite ? hover.c.keywords.find((k) => k.text === hover.title) : null;
            return (
               <div style={{ position: 'absolute', left: hover.x, top: hover.y - 64, transform: 'translateX(-50%)', background: '#18181B', color: '#fff', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', fontFamily: FONT, whiteSpace: 'nowrap', zIndex: 150 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{hover.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#D4D4D8', marginTop: 2 }}>
                     {kw ? (
                        <>
                           <span>KD: <span style={{ color: '#fff' }}>{kw.kd}</span></span>
                           <span>SV: <span style={{ color: '#fff' }}>{kw.vol}</span></span>
                        </>
                     ) : (
                        <>
                           <span>KD: <span style={{ color: '#fff' }}>{hover.c.kd}</span></span>
                           <span>SV: <span style={{ color: '#fff' }}>{hover.c.vol}</span></span>
                           <span>Covg.: <span style={{ color: '#fff' }}>{hover.c.covRatio}</span></span>
                        </>
                     )}
                  </div>
               </div>
            );
         })()}
      </div>
   );
};

export default TopicalMapCanvas;
