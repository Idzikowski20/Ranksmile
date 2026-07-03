import React, { useState } from 'react';

const FONT = 'var(--font-family-primary)';

const PlusIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z" />
   </svg>
);

/** The ghost "+ Add prompt to {topic}" row; expands to an inline input, Enter commits. */
const AddPromptRow = ({ topicTitle, onAdd }: { topicTitle: string; onAdd: (text: string) => void }) => {
   const [editing, setEditing] = useState(false);
   const [text, setText] = useState('');

   const commit = () => {
      const t = text.trim();
      if (t) onAdd(t);
      setText('');
      setEditing(false);
   };

   if (editing) {
      return (
         <div style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px', gap: 8 }}>
            <PlusIcon />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
               autoFocus
               value={text}
               onChange={(e) => setText(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setText(''); setEditing(false); } }}
               onBlur={commit}
               placeholder={`Add prompt to ${topicTitle}`}
               style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#18181B', fontFamily: FONT, background: 'transparent' }}
            />
         </div>
      );
   }
   return (
      <button
         type="button"
         onClick={() => setEditing(true)}
         style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 52, padding: '0 16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#71717B', fontSize: 14, fontFamily: FONT, textAlign: 'left' }}
      >
         <PlusIcon />
         <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add prompt to {topicTitle}</span>
      </button>
   );
};

export default AddPromptRow;
