// Editable chip field for blog paths — shared by the setup wizard + DomainSettings.
// Chips: add via Enter, remove via ×. Inline styles per design.md.
import { useState } from 'react';

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
            <span
               key={p}
               style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                  borderRadius: 9999, background: '#F4F4F5', fontSize: 13, color: '#18181B',
                  fontFamily: 'var(--font-family-primary)',
               }}
            >
               {p}
               <button
                  type="button"
                  aria-label={`Remove ${p}`}
                  onClick={() => onChange(value.filter((x) => x !== p))}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#71717B', fontSize: 14, lineHeight: 1 }}
               >
                  ×
               </button>
            </span>
         ))}
         <input
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
            style={{
               border: '1px solid #D4D4D8', borderRadius: 8, padding: '4px 10px',
               fontSize: 13, fontFamily: 'var(--font-family-primary)', outline: 'none',
            }}
         />
      </div>
   );
};

export default BlogPathsField;
