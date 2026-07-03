import React from 'react';

const FONT = 'var(--font-family-primary)';

const Spinner = () => (
   <span
      aria-label="Loading"
      role="status"
      style={{
         width: 20,
         height: 20,
         borderRadius: '50%',
         border: '2px solid #fff',
         borderBottomColor: 'transparent',
         display: 'inline-block',
         animation: 'aiv-spin 0.8s linear infinite',
      }}
   />
);

/**
 * Fixed "Crunching data…" pill at the bottom of the AI Visibility pages while a
 * scan is queued/running. Visibility is driven by the caller (AiVisPageShell
 * reads useAiVisScanStatus) so it survives sub-page navigation.
 *
 * Centered on the *content* column, not the viewport: we measure the live
 * `.app-content` rect (which already excludes whatever width the sidebar takes,
 * collapsed or not) so the pill stays centered in every sidebar state.
 */
const CrunchingBar = ({ visible }: { visible: boolean }) => {
   if (!visible) return null;
   return (
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
         <style>{'@keyframes aiv-spin { to { transform: rotate(360deg); } }'}</style>
         <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, minHeight: 48, minWidth: 850, padding: '10px 20px', borderRadius: 40, background: '#18181B', color: '#fff', fontFamily: FONT, boxShadow: '0 12px 32px rgba(0,0,0,0.24)', transition: 'opacity 0.3s' }}>
            <Spinner />
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Crunching data…</span>
            <span style={{ fontSize: 14, color: '#D4D4D8' }}>This may take up to a few minutes. You can navigate away — we&rsquo;ll keep working in the background.</span>
         </div>
      </div>
   );
};

export default CrunchingBar;
