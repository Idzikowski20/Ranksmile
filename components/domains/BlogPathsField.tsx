// Editable chip field for blog paths — shared by the setup wizard + DomainSettings.
// Chips: add via Enter, remove via ×. Inline styles per design.md.
import { useState } from 'react';
import { Chip } from '../koala/core';

type BlogPathsFieldProps = {
   value: string[];
   onChange: (next: string[]) => void;
};

const BlogPathsField = ({ value, onChange }: BlogPathsFieldProps) => {
   const [draft, setDraft] = useState('');

   const addDraft = () => {
      const v = draft.trim();
      if (v && !value.includes(v)) onChange([...value, v]);
      setDraft('');
   };

   return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
         {value.map((p) => (
            <Chip
               key={p}
               size="sm"
               aria-label={`Remove ${p}`}
               onDismiss={() => onChange(value.filter((x) => x !== p))}
            >
               {p}
            </Chip>
         ))}
         <input
            className="koala-blog-path-input"
            value={draft}
            placeholder="/blog/"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter') {
                  e.preventDefault();
                  addDraft();
               }
            }}
            onBlur={addDraft}
         />
      </div>
   );
};

export default BlogPathsField;
