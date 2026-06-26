import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;
const stepVariants = {
   enter: (dir: number) => ({ x: dir > 0 ? 44 : -44, opacity: 0 }),
   center: { x: 0, opacity: 1 },
   exit: (dir: number) => ({ x: dir > 0 ? -44 : 44, opacity: 0 }),
};

const F = 'var(--font-family-primary)';
const PURPLE = '#783AFB';

type QType = 'radio' | 'checkbox';
type Question = { id: string; type: QType; title: string; subtitle?: string; options: string[] };

const QUESTIONS: Question[] = [
   {
      id: 'business',
      type: 'radio',
      title: 'Which of these describes your business best?',
      options: ['Blogger', 'Professional Services', 'Local Business', 'Affiliate Marketer', 'Marketing / SEO Agency', 'E-commerce', 'Freelancer', 'Tech Company', 'Other'],
   },
   {
      id: 'team',
      type: 'radio',
      title: 'How many people are working on SEO and content?',
      options: ['Just me', '2-5', '6-10', '11-20', '20+'],
   },
   {
      id: 'role',
      type: 'radio',
      title: 'What is your role?',
      options: ['SEO Manager', 'Content Manager', 'SEO Specialist', 'Content Writer', 'Marketing Manager / Head of Marketing', 'Owner / CEO / GM', 'Other'],
   },
   {
      id: 'interests',
      type: 'checkbox',
      title: 'What are you most interested in?',
      subtitle: 'Select as many features as you want:',
      options: ['AI writer', 'AI visibility', 'Domain performance reporting', 'SEO audit', 'Keyword research', 'Local marketing', 'SEO data for API', 'Topical research', 'AI detection / Humanizing content', 'Rank tracking', 'Content creation', 'Competitive research', 'Backlink analytics', 'Other'],
   },
   {
      id: 'source',
      type: 'checkbox',
      title: 'How did you hear about Surfer?',
      subtitle: 'Select as many channels as you want:',
      options: ['Events', 'LinkedIn', 'YouTube', 'Facebook', 'External Advisors', 'Content Optimization Masterclass', 'Software reviews (G2, Capterra)', 'Google Search', 'Word of mouth and peers', 'ChatGPT or other AI', 'Other'],
   },
];

const TRUST_LOGOS = ['Lenovo', 'ClickUp', 'Square', 'Intuit', 'Opera', 'FedEx', 'Jasper', 'Thomson Reuters', 'Shopify', 'InPost', 'FreshBooks', 'Authority Hacker'];

const RadioMark = ({ on }: { on: boolean }) => (
   <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${on ? PURPLE : '#D4D4D8'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 150ms ease' }}>
      {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: PURPLE }} />}
   </span>
);

const CheckMark = ({ on }: { on: boolean }) => (
   <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? PURPLE : '#D4D4D8'}`, background: on ? PURPLE : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
      {on && (
         <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M16.7 4.15a.75.75 0 0 1 .14 1.05l-8 10.5a.75.75 0 0 1-1.13.08l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.9 3.89 7.48-9.82a.75.75 0 0 1 1.05-.14Z" fill="#fff" />
         </svg>
      )}
   </span>
);

type Props = {
   onFinish: (answers: Record<string, string[]>) => void;
   submitting?: boolean;
};

const OnboardingSurvey = ({ onFinish, submitting = false }: Props) => {
   const [step, setStep] = useState(0);
   const [dir, setDir] = useState(1);
   const [answers, setAnswers] = useState<Record<string, string[]>>({});

   const q = QUESTIONS[step];
   const selected = answers[q.id] ?? [];
   const valid = selected.length > 0;
   const isLast = step === QUESTIONS.length - 1;

   const choose = (option: string) => {
      setAnswers((prev) => {
         const cur = prev[q.id] ?? [];
         if (q.type === 'radio') return { ...prev, [q.id]: [option] };
         const next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
         return { ...prev, [q.id]: next };
      });
   };

   const next = () => {
      if (!valid || submitting) return;
      if (isLast) { onFinish(answers); return; }
      setDir(1);
      setStep((s) => s + 1);
   };

   const back = () => {
      setDir(-1);
      setStep((s) => s - 1);
   };

   return (
      <div className="ob-split" style={{ flex: 1, display: 'flex', gap: 8, width: '100%', minHeight: 0, fontFamily: F, marginBottom: 8 }}>
         <style>{`
            .ob-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
            .ob-aside { display: none; }
            @media (min-width: 720px) { .ob-grid { grid-template-columns: 1fr 1fr; } }
            @media (min-width: 1100px) { .ob-aside { display: flex; } }
         `}</style>

         {/* Left — form */}
         <section style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px clamp(20px, 4vw, 48px)' }}>
            <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 40 }}>
               {/* Header: back + progress */}
               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                     {step > 0 && (
                        <button
                           type="button"
                           onClick={back}
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#18181B', fontFamily: F, fontSize: 15, fontWeight: 500, padding: 0, transition: 'opacity 150ms ease' }}
                           onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                           onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                           <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                              <path fillRule="evenodd" clipRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.61l4.16 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.61 9.25H16.25A.75.75 0 0 1 17 10Z" fill="currentColor" />
                           </svg>
                           Back
                        </button>
                     )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                     <span style={{ color: '#52525C', fontSize: 14 }}>Question {step + 1} of {QUESTIONS.length}</span>
                     <div style={{ display: 'flex', gap: 5 }}>
                        {QUESTIONS.map((_, i) => (
                           <span key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i <= step ? PURPLE : '#E4E4E7', transition: 'background 200ms ease' }} />
                        ))}
                     </div>
                  </div>
               </div>

               {/* Question */}
               <AnimatePresence mode="wait" custom={dir} initial={false}>
               <motion.div
                  key={q.id}
                  custom={dir}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: EASE }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}
               >
                  <motion.div
                     initial={{ opacity: 0, y: 6 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ duration: 0.3, ease: EASE }}
                     style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}
                  >
                     <h1 style={{ margin: 0, fontSize: 23, fontWeight: 600, color: '#18181B', letterSpacing: '-0.01em' }}>{q.title}</h1>
                     {q.subtitle && <p style={{ margin: 0, fontSize: 15, color: '#52525C' }}>{q.subtitle}</p>}
                  </motion.div>

                  <div className="ob-grid" style={{ width: '100%' }}>
                     {q.options.map((option, i) => {
                        const on = selected.includes(option);
                        return (
                           <motion.button
                              key={option}
                              type="button"
                              role={q.type}
                              aria-checked={on}
                              onClick={() => choose(option)}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, ease: EASE, delay: 0.06 + i * 0.03 }}
                              whileTap={{ scale: 0.98 }}
                              style={{
                                 display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                                 padding: '13px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: F, fontSize: 14.5, color: '#18181B',
                                 background: '#fff',
                                 border: `1px solid ${on ? PURPLE : '#E4E4E7'}`,
                                 boxShadow: on ? '0 0 0 3px rgba(120,58,251,0.08)' : 'none',
                                 transition: 'border-color 150ms ease, box-shadow 150ms ease',
                              }}
                              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!on) e.currentTarget.style.borderColor = '#D4D4D8'; }}
                              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!on) e.currentTarget.style.borderColor = '#E4E4E7'; }}
                           >
                              {q.type === 'radio' ? <RadioMark on={on} /> : <CheckMark on={on} />}
                              <span>{option}</span>
                           </motion.button>
                        );
                     })}
                  </div>

                  {/* Next / Finish */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                     <motion.button
                        type="button"
                        onClick={next}
                        disabled={!valid || submitting}
                        whileTap={valid && !submitting ? { scale: 0.97 } : undefined}
                        style={{
                           display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                           padding: '10px 22px', borderRadius: 10, border: 'none', fontFamily: F, fontSize: 14.5, fontWeight: 600, color: '#fff',
                           background: valid ? '#2F2F34' : '#A1A1AA',
                           opacity: valid ? 1 : 0.6,
                           cursor: valid && !submitting ? 'pointer' : 'not-allowed',
                           transition: 'background 150ms ease',
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (valid && !submitting) e.currentTarget.style.background = PURPLE; }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (valid && !submitting) e.currentTarget.style.background = '#2F2F34'; }}
                     >
                        {isLast ? (submitting ? 'Finishing…' : 'Finish') : 'Next'}
                     </motion.button>
                  </div>
               </motion.div>
               </AnimatePresence>
            </div>
         </section>

         {/* Right — trust panel */}
         <aside className="ob-aside" aria-hidden="true" style={{ width: '40%', flexShrink: 0, background: '#6B4EFF', borderRadius: 16, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, padding: 48 }}>
            <p style={{ margin: 0, maxWidth: 28 + 'ch', textAlign: 'center', color: '#fff', fontSize: 20, fontWeight: 500, lineHeight: 1.35, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>
               Trusted by 150,000+ Content Creators, SEOs and Agencies.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '18px 22px', maxWidth: 440 }}>
               {TRUST_LOGOS.map((name) => (
                  <span key={name} style={{ color: '#fff', opacity: 0.92, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{name}</span>
               ))}
            </div>
         </aside>
      </div>
   );
};

export default OnboardingSurvey;
