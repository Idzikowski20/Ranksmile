import React, { useState } from 'react';

const FONT = 'var(--font-family-primary)';

/** Shared dark hover tooltip used across the app (score meta, activity avatars, …).
 *  `align` anchors the bubble so it doesn't overflow near a container edge. */
const HoverTooltip = ({ label, align = 'left', children }: { label: string; align?: 'left' | 'right' | 'center'; children: React.ReactNode }) => {
   const [show, setShow] = useState(false);
   let anchor: React.CSSProperties = { left: 0 };
   if (align === 'right') anchor = { right: 0 };
   else if (align === 'center') anchor = { left: '50%', transform: 'translateX(-50%)' };
   return (
      <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
         {children}
         {show ? (
            <span style={{ position: 'absolute', top: 'calc(100% + 6px)', ...anchor, whiteSpace: 'nowrap', background: '#18181B', color: '#fff', fontSize: 12, fontWeight: 400, fontFamily: FONT, padding: '6px 10px', borderRadius: 8, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', pointerEvents: 'none' }}>{label}</span>
         ) : null}
      </span>
   );
};

export default HoverTooltip;
