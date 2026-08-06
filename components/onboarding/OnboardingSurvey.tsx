import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { WizardLayout } from '../koala/layout';
import { OnboardingHeaderCenter } from './OnboardingShell';
import Button from '../koala/primitives/Button';
import { Chip } from '../koala/core/chip/chip';
import { EmailTagInput } from '../koala/core/emailTagInput/emailTagInput';
import { ProgressBar } from '../koala/core/progressBar/progressBar';
import OrganizationProfileStep, { OrganizationProfileValue } from './OrganizationProfileStep';
import { useInviteMember } from '../../services/people';
import { useUpdateOrganization } from '../../services/organization';
import { semantic } from '../koala/tokens/semantic';
import { typeface, textScale, fontWeight } from '../koala/tokens/typography';
import { spacing } from '../koala/tokens/spacing';

const EASE = [0.16, 1, 0.3, 1] as const;
const stepVariants = {
   enter: (dir: number) => ({ x: dir > 0 ? 44 : -44, opacity: 0 }),
   center: { x: 0, opacity: 1 },
   exit: (dir: number) => ({ x: dir > 0 ? -44 : 44, opacity: 0 }),
};

type QType = 'radio' | 'checkbox';
type Question = { id: string; type: QType; title: string; subtitle?: string; options: string[] };

/** Team-size answer that means "no one else to invite" — keeps the invite step out of the flow. */
const SOLO_ANSWER = 'Just me';

const QUESTIONS: Question[] = [
   {
      id: 'business',
      type: 'radio',
      title: 'Which of these describes your business best?',
      options: [
         'Blogger', 'Professional Services', 'Local Business', 'Affiliate Marketer',
         'Marketing / SEO Agency', 'E-commerce', 'Freelancer', 'Tech Company', 'Other',
      ],
   },
   {
      id: 'team',
      type: 'radio',
      title: 'How many people are working on SEO and content?',
      options: [SOLO_ANSWER, '2-5', '6-10', '11-20', '20+'],
   },
   {
      id: 'role',
      type: 'radio',
      title: 'What is your role?',
      options: [
         'SEO Manager', 'Content Manager', 'SEO Specialist', 'Content Writer',
         'Marketing Manager / Head of Marketing', 'Owner / CEO / GM', 'Other',
      ],
   },
   {
      id: 'interests',
      type: 'checkbox',
      title: 'What are you most interested in?',
      subtitle: 'Select as many features as you want:',
      options: [
         'AI writer', 'AI visibility', 'Domain performance reporting', 'SEO audit', 'Keyword research',
         'Local marketing', 'SEO data for API', 'Topical research', 'AI detection / Humanizing content',
         'Rank tracking', 'Content creation', 'Competitive research', 'Backlink analytics', 'Other',
      ],
   },
   {
      id: 'source',
      type: 'checkbox',
      title: 'How did you hear about Ranksmile?',
      subtitle: 'Select as many channels as you want:',
      options: [
         'Events', 'LinkedIn', 'YouTube', 'Facebook', 'External Advisors',
         'Content Optimization Masterclass', 'Software reviews (G2, Capterra)', 'Google Search',
         'Word of mouth and peers', 'ChatGPT or other AI', 'Other',
      ],
   },
];

/** Invite lands right after the team-size question it depends on. */
const INVITE_AFTER = 'team';

type Step = { kind: 'org' } | { kind: 'question'; question: Question } | { kind: 'invite' };

/** Copy for the two non-survey steps; questions carry their own title/subtitle. */
const STEP_COPY: Record<'org' | 'invite' | 'question', { title: string; subtitle: string }> = {
   org: {
      title: 'Set up your organization',
      subtitle: 'Name it and add a logo. Both show up across the app and on invites you send.',
   },
   invite: {
      title: 'Invite your team',
      subtitle: 'Add teammates by email. They can join now, or you can invite them later from Settings.',
   },
   // Unreachable — a question step always resolves its copy from the question itself.
   question: { title: '', subtitle: '' },
};

function buildSteps(teamAnswer: string | undefined): Step[] {
   const steps: Step[] = [];
   QUESTIONS.forEach((question) => {
      steps.push({ kind: 'question', question });
      if (question.id === INVITE_AFTER && teamAnswer && teamAnswer !== SOLO_ANSWER) {
         steps.push({ kind: 'invite' });
      }
   });
   // Org goes last — it closes the flow, and invite emails quote its name, so it
   // must be saved before the collected invites are flushed on Finish.
   steps.push({ kind: 'org' });
   return steps;
}

type Props = {
   onFinish: (answers: Record<string, string[]>) => void;
   submitting?: boolean;
};

const OnboardingSurvey = ({ onFinish, submitting = false }: Props) => {
   const [step, setStep] = useState(0);
   const [dir, setDir] = useState(1);
   const [answers, setAnswers] = useState<Record<string, string[]>>({});
   const [invites, setInvites] = useState<string[]>([]);
   const [org, setOrg] = useState<OrganizationProfileValue>({ name: '', logoDataUrl: null });
   const [sending, setSending] = useState(false);
   const invite = useInviteMember();
   const updateOrg = useUpdateOrganization();

   const steps = useMemo(() => buildSteps(answers.team?.[0]), [answers.team]);
   const current = steps[Math.min(step, steps.length - 1)];
   const isOrg = current.kind === 'org';
   const isInvite = current.kind === 'invite';
   const q = current.kind === 'question' ? current.question : null;
   const selected = q ? answers[q.id] ?? [] : [];
   // Invite is skippable so it never blocks Next; org needs at least a name.
   const valid = isInvite || (isOrg ? org.name.trim().length > 0 : selected.length > 0);
   const isLast = step === steps.length - 1;

   const choose = (option: string) => {
      if (!q) return;
      setAnswers((prev) => {
         if (q.type !== 'checkbox') return { ...prev, [q.id]: [option] };
         const cur = prev[q.id] ?? [];
         const nextValues = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
         return { ...prev, [q.id]: nextValues };
      });
   };

   /** Fire one invite per address; a failure is reported but never blocks the flow. */
   const sendInvites = async (): Promise<void> => {
      if (!invites.length) return;
      setSending(true);
      const failed: string[] = [];
      for (const email of invites) {
         try {
            // Sequential on purpose — the invite endpoint writes one membership row per call.
            // eslint-disable-next-line no-await-in-loop
            await invite.mutateAsync({ email, role: 'member', workspaceIds: null });
         } catch {
            failed.push(email);
         }
      }
      setSending(false);
      if (failed.length) {
         toast.error(`Couldn't invite ${failed.join(', ')}. You can retry from Settings › People.`);
      } else {
         toast.success(invites.length === 1 ? 'Invitation sent' : `${invites.length} invitations sent`);
      }
   };

   /** Persist the organization name + logo. Rejects so the caller can keep the user on the step. */
   const saveOrg = async (): Promise<void> => {
      setSending(true);
      try {
         const patch: { name?: string; logoDataUrl?: string } = { name: org.name.trim() };
         if (org.logoDataUrl) patch.logoDataUrl = org.logoDataUrl;
         await updateOrg.mutateAsync(patch);
      } finally {
         setSending(false);
      }
   };

   const next = () => {
      if (!valid || submitting || sending) return;
      const advance = () => {
         if (isLast) { onFinish(answers); return; }
         setDir(1);
         setStep((s) => s + 1);
      };
      if (isOrg) {
         // Closing step: save the org first (invite emails quote its name), then flush
         // the addresses collected earlier. A failed save keeps the user here.
         saveOrg()
            .then(sendInvites)
            .then(advance)
            .catch(() => {
               toast.error("Couldn't save your organization. Check your connection and try again.");
            });
         return;
      }
      advance();
   };

   const back = () => {
      setDir(-1);
      setStep((s) => s - 1);
   };

   const primaryLabel = (): string => {
      // Invites are only collected here — they go out on Finish, once the org has a name.
      if (isInvite && !invites.length) return 'Skip for now';
      return isLast ? 'Finish' : 'Next';
   };

   const stepKey = q ? q.id : current.kind;
   const title = q ? q.title : STEP_COPY[current.kind].title;
   const subtitle = q ? q.subtitle : STEP_COPY[current.kind].subtitle;

   const renderStepBody = (): React.ReactNode => {
      if (isOrg) {
         return (
            <OrganizationProfileStep
               value={org}
               onChange={setOrg}
               onError={(message) => toast.error(message)}
               disabled={sending}
            />
         );
      }
      if (isInvite) {
         return (
            <div style={{ width: '100%', maxWidth: 400 }}>
               <EmailTagInput value={invites} onChange={setInvites} disabled={sending} />
            </div>
         );
      }
      return (
         <div className="ob-chips">
            {(q?.options ?? []).map((option, i) => (
               <motion.div
                  key={option}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE, delay: 0.06 + i * 0.02 }}
               >
                  <Chip size="md" selected={selected.includes(option)} onClick={() => choose(option)}>
                     {option}
                  </Chip>
               </motion.div>
            ))}
         </div>
      );
   };

   const titleStyle: React.CSSProperties = {
      margin: 0,
      fontFamily: typeface.heading,
      fontSize: textScale['2xl'].fontSize,
      lineHeight: textScale['2xl'].lineHeight,
      fontWeight: fontWeight.bold,
      color: semantic.text.primary,
      letterSpacing: textScale['2xl'].letterSpacing,
   };

   const subtitleStyle: React.CSSProperties = {
      margin: 0,
      fontSize: textScale.base.fontSize,
      lineHeight: textScale.base.lineHeight,
      color: semantic.text.secondary,
   };

   return (
      <>
      <OnboardingHeaderCenter>
         <ProgressBar label="Getting started" completed={step} total={steps.length} style={{ width: 360 }} />
      </OnboardingHeaderCenter>
      <WizardLayout
         className="ob-wizard-fill"
         footer={(
            <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', gap: spacing.lg }}>
               {step > 0 && (
                  <Button type="button" variant="secondary" size="lg" onClick={back} style={{ flexShrink: 0 }}>
                     Back
                  </Button>
               )}
               <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={!valid}
                  busy={sending || (submitting && isLast)}
                  onClick={next}
                  style={{ flex: 1 }}
               >
                  {primaryLabel()}
               </Button>
            </div>
         )}
      >
         <section className="ob-body">
            <style>{`
               .ob-body {
                  height: 100%; min-width: 0; overflow-y: auto; overflow-x: hidden; box-sizing: border-box;
                  display: flex; flex-direction: column; align-items: center; justify-content: center;
                  padding: ${spacing['2xl']} 0; font-family: ${typeface.body};
               }
               .ob-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: ${spacing.md}; }
               .ob-wizard-fill { flex: 1; min-height: 0; }
            `}</style>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
               key={stepKey}
               custom={dir}
               variants={stepVariants}
               initial="enter"
               animate="center"
               exit="exit"
               transition={{ duration: 0.3, ease: EASE }}
               style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['2xl'], width: '100%', maxWidth: 640 }}
            >
               <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs, textAlign: 'center' }}
               >
                  <h1 style={titleStyle}>{title}</h1>
                  {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
               </motion.div>

               {renderStepBody()}
            </motion.div>
            </AnimatePresence>
         </section>
      </WizardLayout>
      </>
   );
};

export default OnboardingSurvey;
