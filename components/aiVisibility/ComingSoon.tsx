import React from 'react';
import AiVisPageShell from './AiVisPageShell';

const FONT = 'var(--font-family-primary)';

/** Guarded placeholder for AI Visibility sub-pages not built yet. Reuses
 * AiVisPageShell so the config guard (redirect to setup) still applies. */
const ComingSoon = ({ title, blurb }: { title: string; blurb: string }) => (
   <AiVisPageShell section="AI Visibility" title={title}>
      {() => (
         <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, background: '#fff', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525C' }}>
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#09090B', fontFamily: FONT }}>{title} — coming soon</h2>
            <p style={{ margin: 0, maxWidth: 440, fontSize: 14, color: '#71717B', lineHeight: 1.6, fontFamily: FONT }}>{blurb}</p>
         </div>
      )}
   </AiVisPageShell>
);

export default ComingSoon;
