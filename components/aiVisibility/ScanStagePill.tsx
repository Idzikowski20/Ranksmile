import React from 'react';

/**
 * Inline "this panel is still filling in" marker, sat next to a card title while a scan
 * runs. Quiet on purpose — the pinned ScanProgressBar owns the detail; this only says
 * which phase is feeding the panel you are looking at.
 */
const ScanStagePill = ({ label }: { label: string }) => (
   <span
      style={{
         display: 'inline-flex',
         alignItems: 'center',
         gap: 6,
         padding: '3px 10px 3px 8px',
         borderRadius: 999,
         background: 'var(--koala-bg-secondary)',
         color: 'var(--koala-text-secondary)',
         fontFamily: 'var(--font-family-primary)',
         fontSize: 12,
         fontWeight: 500,
         whiteSpace: 'nowrap',
         verticalAlign: 'middle',
      }}
   >
      {/* Self-contained: the pill can render without the pinned progress bar mounted, so it
          carries its own reduced-motion rule rather than relying on the bar's copy. */}
      <style>
         {'@keyframes aiv-spin { to { transform: rotate(360deg); } }'
          + '@media (prefers-reduced-motion: reduce) { [data-aiv-spin] { animation: none } }'}
      </style>
      {/* data-aiv-spin sits on this span because it carries the animation; `animation` does
          not inherit, so the rule above must target the animated element itself. */}
      <span
         aria-hidden="true"
         data-aiv-spin
         style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '1.5px solid currentColor',
            borderBottomColor: 'transparent',
            animation: 'aiv-spin 0.8s linear infinite',
         }}
      />
      {label}
   </span>
);

export default ScanStagePill;
