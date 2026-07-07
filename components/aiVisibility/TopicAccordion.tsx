import React, { useState } from 'react';
import { Button } from '../core';
import PromptRow from './PromptRow';
import AddPromptRow from './AddPromptRow';
import { SourceBadge, topicSources } from './sourceIcons';
import type { WizardTopic } from './wizardTypes';

const FONT = 'var(--font-family-primary)';

const Chevron = ({ open }: { open: boolean }) => (
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, transform: open ? 'none' : 'rotate(180deg)', transition: 'transform 200ms ease' }}>
      <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);
const TrashIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 6V5.2c0-1.12 0-1.68-.22-2.11a2 2 0 0 0-.87-.87C14.48 2 13.92 2 12.8 2h-1.6c-1.12 0-1.68 0-2.11.22a2 2 0 0 0-.87.87C8 3.52 8 4.08 8 5.2V6M10 11.5v5M14 11.5v5M3 6h18M19 6v11.2c0 1.68 0 2.52-.33 3.16a3 3 0 0 1-1.31 1.31c-.64.33-1.48.33-3.16.33H9.8c-1.68 0-2.52 0-3.16-.33a3 3 0 0 1-1.31-1.31C5 19.72 5 18.88 5 17.2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

const Spinner = () => (
   <span aria-label="Generating" role="status" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #C9C9D1', borderBottomColor: 'transparent', display: 'inline-block', animation: 'aivSpin 0.7s linear infinite', flexShrink: 0 }} />
);

// Staggered widths + per-row delay so the skeleton visibly "streams" in.
const SkeletonRow = ({ width, delay }: { width: string; delay: number }) => (
   <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 16px', borderTop: '1px solid #F4F4F5' }}>
      <div className="aiv-pulse" style={{ width: 16, height: 16, borderRadius: 4, background: '#F4F4F5', animationDelay: `${delay}ms` }} />
      <div className="aiv-pulse" style={{ height: 14, width, borderRadius: 4, background: '#F4F4F5', animationDelay: `${delay}ms` }} />
   </div>
);
const SKELETON_WIDTHS = ['72%', '54%', '81%', '63%', '48%'];

/** One fully-controlled topic card. */
const TopicAccordion = ({ topic, open, onToggleOpen, onRename, onRemoveTopic, onGenerate, onTogglePrompt, onRemovePrompt, onAddPrompt }: {
   topic: WizardTopic;
   open: boolean;
   onToggleOpen: () => void;
   onRename: (title: string) => void;
   onRemoveTopic: () => void;
   onGenerate: () => void;
   onTogglePrompt: (promptKey: string) => void;
   onRemovePrompt: (promptKey: string) => void;
   onAddPrompt: (text: string) => void;
}) => {
   const [hover, setHover] = useState(false);
   const [title, setTitle] = useState(topic.title);
   React.useEffect(() => setTitle(topic.title), [topic.title]);

   const empty = topic.prompts.length === 0 && !topic.generating;
   const sources = topicSources(topic.prompts);

   return (
      <div style={{ border: '1px solid #E4E4E7', borderRadius: 8, background: '#fff' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
         {/* Header */}
         <div style={{ display: 'flex', alignItems: 'center', minHeight: 56, padding: '8px 16px', gap: 8 }}>
            <Button type="button" variant="transparent" size="zero" onClick={onToggleOpen} aria-label={open ? 'Collapse' : 'Expand'} icon={<Chevron open={open} />} style={{ color: '#18181B' }} />
            {empty ? (
               <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => onRename(title.trim() || topic.title)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder="Topic title"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT, background: 'transparent' }}
               />
            ) : (
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span title={topic.title} style={{ fontSize: 15, fontWeight: 600, color: '#18181B', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</span>
                  {topic.generating ? (
                     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717B', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                        <Spinner /> Generating…
                     </span>
                  ) : (
                     <span style={{ fontSize: 13, color: '#71717B', fontFamily: FONT, whiteSpace: 'nowrap' }}>{topic.prompts.length} prompts</span>
                  )}
                  {!topic.generating && sources.length > 0 && (
                     <span style={{ display: 'inline-flex', marginLeft: 4 }}>
                        {sources.map((s, i) => <span key={s} style={{ marginLeft: i ? -8 : 0 }}><SourceBadge source={s} /></span>)}
                     </span>
                  )}
               </div>
            )}
            {empty ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, opacity: hover ? 1 : 0, transition: 'opacity 150ms ease' }}>
                  <Button type="button" variant="transparent" size="sm" tabIndex={hover ? 0 : -1} onClick={onRemoveTopic} style={{ color: '#52525C', fontWeight: 600, fontFamily: FONT }}>Remove</Button>
                  <button
                     type="button"
                     tabIndex={hover ? 0 : -1}
                     onClick={onGenerate}
                     style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E4E4E7', background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: FONT, cursor: 'pointer' }}
                  >
                     Generate prompts
                  </button>
               </div>
            ) : (
               <Button
                  type="button"
                  variant="transparent"
                  size="sm"
                  aria-label="Remove topic"
                  onClick={onRemoveTopic}
                  icon={<TrashIcon />}
                  style={{ flexShrink: 0, opacity: hover ? 1 : 0, transition: 'opacity 150ms ease', color: '#71717B' }}
               />
            )}
         </div>

         {/* Body */}
         {open && !empty && (
            <div>
               {topic.generating
                  ? SKELETON_WIDTHS.map((w, i) => <SkeletonRow key={w} width={w} delay={i * 150} />)
                  : (
                     <>
                        {topic.prompts.map((p) => (
                           <PromptRow key={p.key} prompt={p} onToggle={() => onTogglePrompt(p.key)} onRemove={() => onRemovePrompt(p.key)} />
                        ))}
                        <AddPromptRow topicTitle={topic.title} onAdd={onAddPrompt} />
                     </>
                  )}
            </div>
         )}
      </div>
   );
};

export default TopicAccordion;
