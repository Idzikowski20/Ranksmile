/**
 * Rewrite Planner + Knowledge Completion Engine (KG-first).
 */
import type {
  AdaptiveOutline,
  RewritePlan,
  RewriteStep,
  TargetKnowledgeGraph,
  ValidationResult,
} from './types';
import type { ClaimValidationItem } from './validators/postWriteValidators';
import { stubWriteSection } from './sectionWriter';
import type { SectionBrief } from './types';

export function buildRewritePlan(opts: {
  outline: AdaptiveOutline;
  kg: TargetKnowledgeGraph;
  claimItems: ClaimValidationItem[];
  questionStatuses: Array<{ questionId: string; status: string }>;
  flow: ValidationResult;
  seo: ValidationResult;
}): RewritePlan {
  const steps: RewriteStep[] = [];
  const claimById = new Map(opts.kg.claims.map((c) => [c.id, c]));
  const missingClaims = opts.claimItems.filter((i) => i.coverage === 'missing' || i.quality === 'partial');
  const bySection = new Map<string, string[]>();

  for (const item of missingClaims) {
    const sec = opts.outline.sections.find((s) => s.assignedClaimIds.includes(item.claimId));
    const sid = sec?.id || opts.outline.sections[0]?.id;
    if (!sid) continue;
    const list = bySection.get(sid) || [];
    list.push(item.claimId);
    bySection.set(sid, list);
  }

  for (const [sectionId, claimIds] of bySection) {
    steps.push({
      sectionId,
      action: 'add_claims',
      count: claimIds.length,
      detail: claimIds.map((id) => claimById.get(id)?.statement || id).join('; '),
    });
  }

  for (const qs of opts.questionStatuses.filter((q) => q.status === 'missing')) {
    const sec = opts.outline.sections.find((s) => s.assignedQuestionIds.includes(qs.questionId))
      || opts.outline.sections.find((s) => /faq/i.test(s.role))
      || opts.outline.sections[0];
    if (!sec) continue;
    steps.push({
      sectionId: sec.id,
      action: 'add_questions',
      count: 1,
      detail: opts.kg.questions.find((q) => q.id === qs.questionId)?.question || qs.questionId,
    });
  }

  if (opts.flow.issues.some((i) => i.code === 'quick_after_theory')) {
    const quick = opts.outline.sections.find((s) => /quick/i.test(s.role));
    if (quick) {
      steps.push({
        sectionId: quick.id,
        action: 'rewrite_intro',
        detail: 'Move quick-start content before theory',
      });
    }
  }

  if (opts.seo.issues.some((i) => i.code === 'lists_below')) {
    const target = [...opts.outline.sections].sort((a, b) => b.importance - a.importance)[0];
    if (target) {
      steps.push({
        sectionId: target.id,
        action: 'add_checklist',
        detail: 'Add checklist to meet list budget',
      });
    }
  }

  // Prefer high-importance sections first.
  const imp = new Map(opts.outline.sections.map((s) => [s.id, s.importance]));
  steps.sort((a, b) => (imp.get(b.sectionId) || 0) - (imp.get(a.sectionId) || 0));
  return { steps };
}

/**
 * Apply RewritePlan by injecting stub blocks for missing knowledge (deterministic / testable).
 * Production can swap injectFn for LLM section writer.
 */
export function runKnowledgeCompletion(opts: {
  html: string;
  plan: RewritePlan;
  outline: AdaptiveOutline;
  kg: TargetKnowledgeGraph;
  briefs: SectionBrief[];
  injectFn?: (brief: SectionBrief) => string;
}): { html: string; applied: number } {
  let html = opts.html;
  let applied = 0;
  const inject = opts.injectFn || ((b: SectionBrief) => stubWriteSection({ brief: b, kg: opts.kg }));

  for (const step of opts.plan.steps) {
    const brief = opts.briefs.find((b) => b.sectionId === step.sectionId);
    const section = opts.outline.sections.find((s) => s.id === step.sectionId);
    // rewrite_intro reorders whole-article H2s — needs section, not a section brief.
    if (!section) continue;
    if (!brief && step.action !== 'rewrite_intro') continue;

    if (step.action === 'add_claims' || step.action === 'add_questions' || step.action === 'add_checklist' || step.action === 'add_evidence') {
      if (!brief) continue;
      const patchBrief: SectionBrief = {
        ...brief,
        blocks:
          step.action === 'add_checklist'
            ? ['checklist']
            : step.action === 'add_questions'
              ? ['faq']
              : ['example', 'definition'],
      };
      const fragment = inject(patchBrief);
      const h2Re = new RegExp(`<h2[^>]*>\\s*${escapeRegExp(section.heading)}\\s*</h2>`, 'i');
      if (h2Re.test(html)) {
        html = html.replace(h2Re, (m) => `${m}\n${fragment.replace(/^<h2[\s\S]*?<\/h2>\s*/i, '')}`);
      } else {
        html = `${html}\n${fragment}`;
      }
      applied++;
    } else if (step.action === 'rewrite_intro') {
      // Reorder H2 blocks so Quick Start precedes theory (not just inject a teaser).
      const parts = html.split(/(?=<h2[\s>])/i);
      const before = parts[0] || '';
      const sections = parts.slice(1);
      const h2Title = (s: string) => {
        const m = s.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        return (m?.[1] || '').replace(/<[^>]+>/g, '').trim().toLowerCase();
      };
      const isQuick = (s: string) => /quick|szyb|7\s*dni|pierwsze/.test(h2Title(s));
      const isTheory = (s: string) => /podstaw|definic|czym jest|foundation/.test(h2Title(s));
      const qi = sections.findIndex(isQuick);
      const ti = sections.findIndex(isTheory);
      if (qi >= 0 && ti >= 0 && qi > ti) {
        const next = [...sections];
        const [quick] = next.splice(qi, 1);
        next.splice(ti, 0, quick);
        html = before + next.join('');
      } else {
        const intro = `<p>Chcesz działać od razu? Zacznij od Quick Start poniżej — teoria dopiero potem.</p>`;
        html = html.replace(/<h1[\s\S]*?<\/h1>/i, (m) => `${m}\n${intro}`);
      }
      applied++;
    }
  }

  return { html, applied };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
