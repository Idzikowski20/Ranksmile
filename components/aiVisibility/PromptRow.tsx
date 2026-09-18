import React from 'react';
import { Checkbox } from '../koala/core';
import { SourceInlineIcon } from './sourceIcons';
import type { WizardPrompt } from './wizardTypes';
import { TrashIcon } from '../common/inlineIcons';

const FONT = 'var(--font-family-primary)';

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
         style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px', borderTop: '1px solid var(--koala-bg-secondary)', gap: 12 }}
      >
         <span style={{ flexShrink: 0 }}><Checkbox checked={prompt.selected} onChange={onToggle} /></span>
         <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
               title={prompt.text}
               style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
               {prompt.text}
            </span>
            {prompt.provenance[0] && <SourceInlineIcon source={prompt.provenance[0]} />}
         </div>
         <button
            type="button"
            aria-label="Remove prompt"
            onClick={onRemove}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--koala-text-secondary)', padding: 0, display: 'inline-flex', flexShrink: 0, opacity: hover ? 1 : 0, transition: 'opacity 150ms ease' }}
         >
            <TrashIcon />
         </button>
      </div>
   );
};

export default PromptRow;
