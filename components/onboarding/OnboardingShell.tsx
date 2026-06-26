import React from 'react';

const F = 'var(--font-family-primary)';

/** Dark frame around the onboarding split (no topbar). */
const OnboardingShell = ({ children }: { children: React.ReactNode }) => (
   <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#09090b', fontFamily: F, padding: 8 }}>
      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
         {children}
      </main>
   </div>
);

export default OnboardingShell;
