import { optimizeNarrative } from '../../../lib/contentPlanner/narrativeOptimizer';
import { validatePlannerPlan } from '../../../lib/contentPlanner/plannerValidator';
import { runPlannerImproveLoop } from '../../../lib/contentPlanner/planningLoop';
import type { IntentBlueprint, AdaptiveOutline, SectionBrief, TargetKnowledgeGraph, ArticleBlueprint } from '../../../lib/contentPlanner/types';
import type { TopicBlock } from '../../../lib/knowledgeEngine/types';

const intent: IntentBlueprint = {
  keyword: 'jak pozycjonować stronę',
  primaryIntent: 'informational',
  articleType: 'step-by-step',
  first60sQuestions: ['Od czego zacząć?'],
  narrativePreference: 'step_by_step',
  allowBrandNiche: false,
  yearHint: 2026,
};

describe('narrativeOptimizer', () => {
  it('orders ACTION before FOUNDATION for step-by-step', () => {
    const blocks: TopicBlock[] = [
      {
        id: 'TB_f',
        title: 'Podstawy prawne',
        role: 'FOUNDATION',
        consensus: 0.9,
        memberHeadings: ['Podstawy prawne'],
        claimIds: [],
      },
      {
        id: 'TB_a',
        title: 'Plan 7 dni',
        role: 'ACTION',
        consensus: 0.8,
        memberHeadings: ['Plan 7 dni'],
        claimIds: [],
      },
      {
        id: 'TB_m',
        title: 'Monitorowanie',
        role: 'MONITORING',
        consensus: 0.7,
        memberHeadings: ['Monitorowanie'],
        claimIds: [],
      },
    ];
    const seeds = optimizeNarrative({
      topicBlocks: blocks,
      intent,
      targetH2: 6,
      requiredSections: ['Quick Answer'],
    });
    expect(seeds[0].heading).toMatch(/Quick Answer/i);
    const titles = seeds.map((s) => s.heading);
    expect(titles.indexOf('Plan 7 dni')).toBeLessThan(titles.indexOf('Podstawy prawne'));
  });

  it('skips EN course fillers when enough topic blocks', () => {
    const blocks: TopicBlock[] = Array.from({ length: 6 }, (_, i) => ({
      id: `TB_${i}`,
      title: `Blok tematyczny ${i + 1}`,
      role: (i % 2 === 0 ? 'ACTION' : 'FOUNDATION') as TopicBlock['role'],
      consensus: 0.8,
      memberHeadings: [`Blok tematyczny ${i + 1}`],
      claimIds: [],
    }));
    const seeds = optimizeNarrative({
      topicBlocks: blocks,
      intent,
      targetH2: 6,
      requiredSections: [],
    });
    expect(seeds.every((s) => !/Keywords and intent/i.test(s.heading))).toBe(true);
  });
});

describe('plannerValidator', () => {
  it('fails when critical claim unassigned', () => {
    const kg: TargetKnowledgeGraph = {
      claims: [{
        id: 'c1',
        statement: 'SSL is required for HTTPS security on websites today.',
        topic: 'ssl',
        type: 'fact',
        importance: 'required',
        gainClass: 'core',
        priority: 'critical',
        sources: [],
      }],
      questions: [],
      entities: [],
    };
    const outline: AdaptiveOutline = {
      h1: 'test',
      sections: [{
        id: 's1',
        heading: 'A',
        role: 'action',
        importance: 8,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: ['example'],
        expectedWords: 200,
        evidenceNeeds: ['example'],
        freshnessNotes: [],
        sectionBudget: {
          words: 200, claims: 0, entities: 1, questions: 0, examples: 1,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
      }],
      narrativeOrder: ['s1'],
    };
    const briefs: SectionBrief[] = [{
      sectionId: 's1',
      heading: 'A',
      objective: 'Cover A',
      claimIds: [],
      questionIds: [],
      blocks: ['example'],
      evidence: [],
      budget: {
        words: 200, claims: 0, entities: 1, questions: 0, examples: 1,
        lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
      },
      freshnessNotes: [],
      mustAnswer: [],
      sectionPriority: 'high',
      writerHints: {
        previousSection: null,
        nextSection: null,
        transition: '',
        tone: 'professional',
        avoidRepeating: [],
      },
    }];
    const r = validatePlannerPlan({ outline, briefs, kg });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'critical_claim_unassigned')).toBe(true);
  });

  it('fails when section exceeds claim cap', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const kg: TargetKnowledgeGraph = {
      claims: ids.map((id) => ({
        id,
        statement: `Claim statement number ${id} with enough length here.`,
        topic: 't',
        type: 'fact' as const,
        importance: 'required' as const,
        gainClass: 'expected' as const,
        priority: 'medium' as const,
        sources: [],
      })),
      questions: [],
      entities: [],
    };
    const outline: AdaptiveOutline = {
      h1: 't',
      sections: [{
        id: 's1',
        heading: 'Overloaded',
        role: 'action',
        importance: 8,
        assignedClaimIds: ids,
        assignedQuestionIds: [],
        requiredBlocks: [],
        expectedWords: 200,
        evidenceNeeds: [],
        freshnessNotes: [],
        sectionBudget: {
          words: 200, claims: 10, entities: 1, questions: 0, examples: 0,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
      }],
      narrativeOrder: ['s1'],
    };
    const r = validatePlannerPlan({
      outline,
      briefs: [{
        sectionId: 's1',
        heading: 'Overloaded',
        objective: 'x',
        claimIds: ids,
        questionIds: [],
        blocks: [],
        evidence: [],
        budget: {
          words: 200, claims: 10, entities: 1, questions: 0, examples: 0,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
        freshnessNotes: [],
        mustAnswer: [],
        sectionPriority: 'medium',
        writerHints: {
          previousSection: null, nextSection: null, transition: '', tone: 'p', avoidRepeating: [],
        },
      }],
      kg,
    });
    expect(r.issues.some((i) => i.code === 'section_claim_cap')).toBe(true);
  });
});

describe('runPlannerImproveLoop validation truth', () => {
  it('returns planValidation.ok false when critical claims stay unassigned', () => {
    const kg: TargetKnowledgeGraph = {
      claims: [{
        id: 'crit1',
        statement: 'Critical claim that must be assigned to a section of the outline.',
        topic: 't',
        type: 'fact',
        importance: 'required',
        gainClass: 'core',
        priority: 'critical',
        sources: [],
      }],
      questions: [],
      entities: ['x'],
    };
    const outline: AdaptiveOutline = {
      h1: 't',
      sections: [{
        id: 's1',
        heading: 'A',
        role: 'action',
        importance: 8,
        assignedClaimIds: [],
        assignedQuestionIds: [],
        requiredBlocks: ['example'],
        expectedWords: 200,
        evidenceNeeds: ['example'],
        freshnessNotes: [],
        sectionBudget: {
          words: 200, claims: 0, entities: 1, questions: 0, examples: 1,
          lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
        },
      }],
      narrativeOrder: ['s1'],
    };
    const briefs: SectionBrief[] = [{
      sectionId: 's1',
      heading: 'A',
      objective: 'Cover A',
      claimIds: [],
      questionIds: [],
      blocks: ['example'],
      evidence: [],
      budget: {
        words: 200, claims: 0, entities: 1, questions: 0, examples: 1,
        lists: 0, tables: 0, images: 0, faq: 0, citations: 0,
      },
      freshnessNotes: [],
      mustAnswer: [],
      sectionPriority: 'high',
      writerHints: {
        previousSection: null,
        nextSection: null,
        transition: '',
        tone: 'professional',
        avoidRepeating: [],
      },
    }];
    const blueprint: ArticleBlueprint = {
      targetWords: 2000,
      targetH2: 6,
      targetParagraphs: 40,
      targetLists: 8,
      targetTables: 1,
      targetImages: 2,
      targetFaqs: 3,
      targetClaims: 5,
      targetQuestions: 2,
      targetExamples: 2,
      targetChecklists: 1,
      requiredSections: [],
      freshness: 'medium',
      budget: {
        words: 2000, paragraphs: 40, h2: 6, lists: 8, tables: 1, images: 2,
        claims: 5, questions: 2, examples: 2, warnings: 0, checklists: 1, comparisons: 0, faq: 3,
      },
    };
    const improved = runPlannerImproveLoop({
      outline,
      briefs,
      kg,
      blueprint,
      maxIters: 0,
    });
    expect(improved.validation.ok).toBe(false);
    expect(improved.validation.issues.some((i) => i.code === 'critical_claim_unassigned')).toBe(true);
  });
});
