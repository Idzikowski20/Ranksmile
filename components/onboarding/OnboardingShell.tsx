import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { semantic } from '../koala/tokens/semantic';
import { typeface, fontWeight } from '../koala/tokens/typography';
import { BounceSmileyAnimation } from '../pixel-perfect/bounce-smiley-animation';

/** DOM node for the header's center slot — set by OnboardingShell, consumed by OnboardingHeaderCenter. */
export const OnboardingHeaderCenterContext = React.createContext<HTMLDivElement | null>(null);

/** Portal helper — renders into the shell header's center slot (screen-centered, logo stays left). */
export const OnboardingHeaderCenter = ({ children }: { children: React.ReactNode }) => {
   const node = React.useContext(OnboardingHeaderCenterContext);
   if (!node) return null;
   return createPortal(children, node);
};

const wordmarkStyle: React.CSSProperties = {
   fontFamily: typeface.heading,
   fontWeight: fontWeight.bold,
   fontSize: 19,
   letterSpacing: '-0.01em',
   color: semantic.text.primary,
   whiteSpace: 'nowrap',
};

const BrandMark = () => (
   <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <BounceSmileyAnimation compact size={32} entrance={false} />
      <span style={wordmarkStyle}>Ranksmile</span>
   </div>
);

const headerRowStyle: React.CSSProperties = {
   flexShrink: 0,
   display: 'flex',
   alignItems: 'center',
   padding: '0 48px',
   height: 96,
   boxSizing: 'border-box',
};

const bodyColumnStyle: React.CSSProperties = {
   flex: 1,
   minHeight: 0,
   width: '100%',
   maxWidth: 720,
   margin: '0 auto',
   padding: '0 24px',
   boxSizing: 'border-box',
   display: 'flex',
   flexDirection: 'column',
};

/** Koala onboarding stage — single page background (no nested card), matches Koala UI v11 register-flow reference. */
const OnboardingShell = ({ children }: { children: React.ReactNode }) => {
   const [centerNode, setCenterNode] = useState<HTMLDivElement | null>(null);

   return (
      <div
         style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            background: semantic.background.primary,
            fontFamily: typeface.body,
         }}
      >
         <div style={headerRowStyle}>
            <BrandMark />
            <div ref={setCenterNode} style={{ flex: 1, display: 'flex', justifyContent: 'center' }} />
            {/* Invisible spacer — same width as the logo, so the center slot is truly screen-centered. */}
            <div style={{ visibility: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
               <BrandMark />
            </div>
         </div>
         <OnboardingHeaderCenterContext.Provider value={centerNode}>
            <div style={bodyColumnStyle}>
               {children}
            </div>
         </OnboardingHeaderCenterContext.Provider>
      </div>
   );
};

export default OnboardingShell;
