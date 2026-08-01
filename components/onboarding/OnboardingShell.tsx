import React from 'react';
import { PageLayout, WizardLayout } from '../koala/layout';
import { semantic } from '../koala/tokens/semantic';

/** Single-column Koala onboarding stage (no side image). */
const OnboardingShell = ({ children }: { children: React.ReactNode }) => (
   <div
      style={{
         minHeight: '100dvh',
         display: 'flex',
         flexDirection: 'column',
         background: semantic.background.secondary,
         fontFamily: 'var(--font-family-primary)',
         padding: '24px 16px',
         boxSizing: 'border-box',
      }}
   >
      <PageLayout maxWidth={920} fillHeight>
         <div
            style={{
               flex: 1,
               display: 'flex',
               flexDirection: 'column',
               minHeight: 0,
               background: semantic.background.primary,
               border: `1px solid ${semantic.border.primary}`,
               borderRadius: 16,
               overflow: 'hidden',
            }}
         >
            <WizardLayout>
               {children}
            </WizardLayout>
         </div>
      </PageLayout>
   </div>
);

export default OnboardingShell;
