import {
  classifyGain,
  importanceFromGain,
  priorityFromGainAndImportance,
} from '../../../lib/contentPlanner/knowledgeIntelligence';
import {
  validateBlueprint,
  validateBrief,
  validateOutline,
} from '../../../lib/contentPlanner/validators/planValidators';
import {
  validateFlow,
  validateClaims,
  validateQuestions,
} from '../../../lib/contentPlanner/validators/postWriteValidators';
import { buildRewritePlan } from '../../../lib/contentPlanner/knowledgeCompletion';
import type { AdaptiveOutline, ArticleBlueprint, TargetKnowledgeGraph } from '../../../lib/contentPlanner/types';

describe('Information Gain classifyGain', () => {
  it('marks core / expected / opportunity by competitor frequency', () => {
    const counts = new Map([
      ['ssl required', 8],
      ['search console', 3],
      ['site command', 1],
    ]);
    expect(classifyGain('ssl required', 10, counts)).toBe('core');
    expect(classifyGain('search console', 10, counts)).toBe('expected');
    expect(classifyGain('site command', 10, counts)).toBe('opportunity');
  });

  /**
   * `critical` is a hard gate — the planner refuses to write when one is unassigned — so
   * it has to mean consensus, not the absence of a signal. Claims are matched as whole
   * normalised sentences, and two sites never phrase one identically: on a real SERP all
   * 58 claims came back `opportunity`, every one of them was promoted to critical, and
   * generation failed on the two that did not fit 7 sections × 8 claims.
   */
  it('reserves critical for claims the SERP agrees on', () => {
    expect(priorityFromGainAndImportance('core', importanceFromGain('core'))).toBe('critical');
    expect(priorityFromGainAndImportance('expected', importanceFromGain('expected'))).toBe('high');
    expect(priorityFromGainAndImportance('opportunity', importanceFromGain('opportunity'))).toBe('high');
  });

  /** Every observed claim still counts toward the claim budget and the coverage ratio. */
  it('keeps every observed class required', () => {
    expect(importanceFromGain('core')).toBe('required');
    expect(importanceFromGain('expected')).toBe('required');
    expect(importanceFromGain('opportunity')).toBe('required');
  });
});

describe('Plan validators', () => {
  const blueprint: ArticleBlueprint = {
    targetWords: 3600,
    targetH2: 14,
    targetParagraphs: 90,
    targetLists: 20,
    targetTables: 2,
    targetImages: 4,
    targetFaqs: 6,
    targetClaims: 8,
    targetQuestions: 5,
    targetExamples: 6,
    targetChecklists: 4,
    requiredSections: ['Quick Start', 'FAQ'],
    freshness: 'high',
    budget: {
      words: 3600,
      paragraphs: 90,
      h2: 14,
      lists: 20,
      tables: 2,
      images: 4,
      claims: 8,
      questions: 5,
      examples: 6,
      warnings: 3,
      checklists: 4,
      comparisons: 1,
      faq: 6,
    },
  };

  it('rejects blueprint with budget mismatch', () => {
    const bad = { ...blueprint, budget: { ...blueprint.budget, words: 100 } };
    expect(validateBlueprint(bad).ok).toBe(false);
  });

  it('accepts outline that meets floors', () => {
    const outline: AdaptiveOutline = {
      h1: 'test',
      narrativeOrder: [],
      sections: Array.from({ length: 12 }, (_, i) => ({
        id: `s${i}`,
        heading: i === 0 ? 'Quick Start' : i === 1 ? 'FAQ' : `Section ${i}`,
        role: i === 0 ? 'quick_start' : i === 1 ? 'faq' : `sec_${i}`,
        importance: 5,
        assignedClaimIds: [`c${i}`, `c${i}b`],
        assignedQuestionIds: i < 5 ? [`q${i}`] : [],
        requiredBlocks: i % 2 === 0 ? ['example', 'checklist'] : ['example'],
        expectedWords: 200,
        evidenceNeeds: ['example'],
        freshnessNotes: [],
        sectionBudget: {
          words: 200,
          claims: 2,
          entities: 2,
          questions: 1,
          examples: 1,
          lists: 1,
          tables: 0,
          images: 0,
          faq: 0,
          citations: 1,
        },
      })),
    };
    // 12 sections * 2 = 24 unique claim ids — floor is 0.9*8
    expect(validateOutline(outline, blueprint).ok).toBe(true);
  });

  it('rejects brief without evidence when examples budgeted', () => {
    const r = validateBrief({
      sectionId: 's1',
      heading: 'X',
      objective: 'y',
      claimIds: ['c1'],
      questionIds: [],
      blocks: ['example'],
      evidence: [],
      budget: {
        words: 200,
        claims: 1,
        entities: 1,
        questions: 0,
        examples: 1,
        lists: 0,
        tables: 0,
        images: 0,
        faq: 0,
        citations: 0,
      },
      freshnessNotes: [],
      mustAnswer: [],
      sectionPriority: 'medium',
      writerHints: {
        previousSection: null,
        nextSection: null,
        transition: 'Continue',
        tone: 'professional',
        avoidRepeating: [],
      },
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'no_evidence')).toBe(true);
  });
});

describe('Post-write + rewrite planner', () => {
  const kg: TargetKnowledgeGraph = {
    entities: [],
    claims: [
      {
        id: 'c1',
        statement: 'Certyfikat SSL jest wymagany do bezpiecznego połączenia',
        topic: 'ssl',
        type: 'fact',
        importance: 'required',
        gainClass: 'core',
        priority: 'high',
        sources: [],
      },
    ],
    questions: [
      {
        id: 'q1',
        question: 'Ile trwa pozycjonowanie strony?',
        requiredAnswerBrief: '3-6 miesięcy',
        importance: 'required',
        priority: 'critical',
        answeredByClaimIds: [],
        status: 'missing',
      },
    ],
  };

  const outline: AdaptiveOutline = {
    h1: 'Jak pozycjonować',
    narrativeOrder: ['s0'],
    sections: [
      {
        id: 's0',
        heading: 'Quick Start',
        role: 'quick_start',
        importance: 10,
        assignedClaimIds: ['c1'],
        assignedQuestionIds: ['q1'],
        requiredBlocks: ['checklist'],
        expectedWords: 300,
        evidenceNeeds: ['example'],
        freshnessNotes: [],
        sectionBudget: {
          words: 300,
          claims: 1,
          entities: 1,
          questions: 1,
          examples: 1,
          lists: 1,
          tables: 0,
          images: 0,
          faq: 0,
          citations: 1,
        },
      },
    ],
  };

  it('flags missing claims and builds rewrite plan', () => {
    const html = '<h1>Jak pozycjonować</h1><h2>Quick Start</h2><p>Ogólny tekst bez faktów.</p>';
    const claims = validateClaims(html, kg);
    expect(claims.items[0].coverage).toBe('missing');
    const questions = validateQuestions(html, kg);
    expect(questions.statuses[0].status).toBe('missing');
    const flow = validateFlow(html, outline);
    const plan = buildRewritePlan({
      outline,
      kg,
      claimItems: claims.items,
      questionStatuses: questions.statuses,
      flow,
      seo: { ok: true, issues: [] },
    });
    expect(plan.steps.some((s) => s.action === 'add_claims')).toBe(true);
    expect(plan.steps.some((s) => s.action === 'add_questions')).toBe(true);
  });
});
