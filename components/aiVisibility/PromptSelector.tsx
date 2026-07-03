import React, { useEffect, useRef, useState } from 'react';
import TopicAccordion from './TopicAccordion';
import type { WizardTopic, WizardPrompt } from './wizardTypes';

/** Orchestrator: owns accordion open-state, maps immutable updates back via onChange. */
const PromptSelector = ({ topics, onChange, onGenerate }: {
   topics: WizardTopic[];
   onChange: (next: WizardTopic[]) => void;
   onGenerate: (topicKey: string, title: string) => void;
}) => {
   const [open, setOpen] = useState<Set<string>>(() => new Set(topics.map((t) => t.key)));

   // Topics can arrive async (seed fetch / Add topic). Auto-open any key we
   // haven't seen before — tracked in a ref so a manual collapse is never undone.
   const seen = useRef<Set<string>>(new Set(topics.map((t) => t.key)));
   useEffect(() => {
      const fresh = topics.map((t) => t.key).filter((k) => !seen.current.has(k));
      if (fresh.length) {
         fresh.forEach((k) => seen.current.add(k));
         setOpen((prev) => { const next = new Set(prev); fresh.forEach((k) => next.add(k)); return next; });
      }
   }, [topics]);

   const toggleOpen = (key: string) => setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
   });

   const patchTopic = (key: string, fn: (t: WizardTopic) => WizardTopic) => {
      onChange(topics.map((t) => (t.key === key ? fn(t) : t)));
   };

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
         {topics.map((topic) => (
            <TopicAccordion
               key={topic.key}
               topic={topic}
               open={open.has(topic.key)}
               onToggleOpen={() => toggleOpen(topic.key)}
               onRename={(title) => patchTopic(topic.key, (t) => ({ ...t, title }))}
               onRemoveTopic={() => onChange(topics.filter((t) => t.key !== topic.key))}
               onGenerate={() => { setOpen((prev) => new Set(prev).add(topic.key)); onGenerate(topic.key, topic.title); }}
               onTogglePrompt={(promptKey) => patchTopic(topic.key, (t) => ({
                  ...t,
                  prompts: t.prompts.map((p) => (p.key === promptKey ? { ...p, selected: !p.selected } : p)),
               }))}
               onRemovePrompt={(promptKey) => patchTopic(topic.key, (t) => ({
                  ...t,
                  prompts: t.prompts.filter((p) => p.key !== promptKey),
               }))}
               onAddPrompt={(text) => patchTopic(topic.key, (t) => {
                  const p: WizardPrompt = { key: `${t.key}-c${t.prompts.length}-${text.slice(0, 8)}`, text, provenance: [], selected: true, isCustom: true };
                  return { ...t, prompts: [...t.prompts, p] };
               })}
            />
         ))}
      </div>
   );
};

export default PromptSelector;
