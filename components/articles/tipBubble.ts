import React from 'react';

// Shared look for the dark hover tooltip used in the editor. The trigger logic
// differs per call site (a ref-wrapped span in WriteOptimizePanel vs DOM-hover
// detection in ArticleEditor), so only the bubble's visual style is shared —
// each site adds its own positioning (left/top/transform) and width rules.
export const TIP_BUBBLE_BASE: React.CSSProperties = {
   position: 'fixed',
   background: '#18181b',
   color: '#fff',
   fontSize: 12,
   lineHeight: '16px',
   padding: '6px 10px',
   borderRadius: 8,
   zIndex: 1000,
   boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
   pointerEvents: 'none',
   fontFamily: 'var(--font-family-primary)',
};
