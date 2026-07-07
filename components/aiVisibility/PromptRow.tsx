import React from 'react';
import { Checkbox } from '../core';
import { SourceInlineIcon } from './sourceIcons';
import type { WizardPrompt } from './wizardTypes';

const FONT = 'var(--font-family-primary)';

const TrashIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 6V5.2c0-1.12 0-1.68-.22-2.11a2 2 0 0 0-.87-.87C14.48 2 13.92 2 12.8 2h-1.6c-1.12 0-1.68 0-2.11.22a2 2 0 0 0-.87.87C8 3.52 8 4.08 8 5.2V6M10 11.5v5M14 11.5v5M3 6h18M19 6v11.2c0 1.68 0 2.52-.33 3.16a3 3 0 0 1-1.31 1.31c-.64.33-1.48.33-3.16.33H9.8c-1.68 0-2.52 0-3.16-.33a3 3 0 0 1-1.31-1.31C5 19.72 5 18.88 5 17.2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

/** One 52px prompt line: checkbox + text + source icon + hover trash. */
const PromptRow = ({ prompt, onToggle, onRemove }: {
   prompt: WizardPrompt;
   onToggle: () => void;
   onRemove: () => void;
}) => {
   const [hover, setHover] = React.useState(false);
   return (
      <div
         className="aiv-prompt-row"
         onMouseEnter={() => setHover(true)}
         onMouseLeave={() => setHover(false)}
         style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px', borderTop: '1px solid #F4F4F5', gap: 12 }}
      >
         <span style={{ flexShrink: 0 }}><Checkbox checked={prompt.selected} onChange={onToggle} /></span>
         <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
               title={prompt.text}
               style={{ fontSize: 14, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
               {prompt.text}
            </span>
            {prompt.provenance[0] && <SourceInlineIcon source={prompt.provenance[0]} />}
         </div>
         <button
            type="button"
            aria-label="Remove prompt"
            onClick={onRemove}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#71717B', padding: 0, display: 'inline-flex', flexShrink: 0, opacity: hover ? 1 : 0, transition: 'opacity 150ms ease' }}
         >
            <TrashIcon />
         </button>
      </div>
   );
};

export default PromptRow;
