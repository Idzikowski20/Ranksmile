/**
 * Topic Graph → Adaptive Outline + Section Budgets + Evidence/Freshness/Blocks.
 */
import { h2FromWords } from './competitorBenchmark';
import type {
  AdaptiveOutline,
  ArticleBlueprint,
  ContentBlockType,
  FreshnessTier,
  IntentBlueprint,
  OutlineSection,
  PriorityClass,
  ReaderModel,
  SectionBudget,
  SectionBrief,
  TargetKnowledgeGraph,
} from './types';
import type { NarrativeSeed } from './narrativeOptimizer';
import { MAX_CLAIMS_PER_SECTION } from '../knowledgeEngine/constants';

type TopicSeed = { role: string; heading: string; importance: number; reasonSummary?: string };

function topicSeeds(reader: ReaderModel, blueprint: ArticleBlueprint): TopicSeed[] {
  const seeds: TopicSeed[] = [];
  for (const name of blueprint.requiredSections) {
    const importance =
      /quick start|quick answer/i.test(name) ? 10
        : /mistake|błąd|cost|koszt/i.test(name) ? 8
          : /faq/i.test(name) ? 4
            : /summary|podsum/i.test(name) ? 2
              : 6;
    seeds.push({
      role: name.toLowerCase().replace(/\s+/g, '_'),
      heading: name,
      importance,
    });
  }
  // Fill remaining H2 slots with foundation topics from keyword.
  const need = Math.max(blueprint.targetH2, h2FromWords(blueprint.targetWords));
  const extras = [
    { role: 'keywords', heading: 'Analiza słów kluczowych i intencji', importance: 7 },
    { role: 'technical', heading: 'Techniczne SEO i indeksowanie', importance: 7 },
    { role: 'content', heading: 'Tworzenie treści, które rankują', importance: 6 },
    { role: 'links_internal', heading: 'Linkowanie wewnętrzne', importance: 5 },
    { role: 'backlinks', heading: 'Linki zewnętrzne i autorytet', importance: 5 },
    { role: 'local', heading: 'SEO lokalne', importance: 5 },
    { role: 'monitor', heading: 'Monitorowanie wyników', importance: 6 },
    { role: 'tools', heading: 'Narzędzia i stack', importance: 4 },
  ];
  for (const e of extras) {
    if (seeds.length >= need) break;
    if (seeds.some((s) => s.role === e.role)) continue;
    seeds.push(e);
  }
  while (seeds.length < need) {
    seeds.push({
      role: `topic_${seeds.length}`,
      heading: `Rozszerzenie: ${reader.keyword} (${seeds.length + 1})`,
      importance: 3,
    });
  }
  return seeds.slice(0, need);
}

export function allocateSectionBudget(
  blueprint: ArticleBlueprint,
  sectionCount: number,
  importance: number,
): SectionBudget {
  const weight = Math.max(1, importance);
  const totalWeight = sectionCount * 5; // approximate; refined below by caller
  void totalWeight;
  const share = weight / 10;
  const words = Math.max(80, Math.round((blueprint.targetWords / sectionCount) * (0.7 + share)));
  return {
    words,
    claims: Math.max(1, Math.round((blueprint.targetClaims / sectionCount) * (0.8 + share * 0.5))),
    entities: Math.max(1, Math.round(3 * share + 1)),
    questions: Math.max(0, Math.round((blueprint.targetQuestions / sectionCount) * share)),
    examples: Math.max(0, Math.round((blueprint.targetExamples / sectionCount) * (0.5 + share))),
    lists: Math.max(0, Math.round((blueprint.targetLists / sectionCount) * share)),
    tables: importance >= 7 ? 1 : 0,
    images: importance >= 6 ? 1 : 0,
    faq: /faq/i.test(String(importance)) ? Math.max(3, Math.round(blueprint.targetFaqs / 2)) : 0,
    citations: Math.max(0, Math.round(2 * share)),
  };
}

function blocksForRole(role: string, freshness: FreshnessTier): ContentBlockType[] {
  const blocks: ContentBlockType[] = [];
  if (/quick.?answer|quick.?wins|quick.?start/i.test(role)) blocks.push('steps', 'checklist', 'example');
  else if (/step.?by.?step|plan/i.test(role)) blocks.push('steps', 'checklist', 'example', 'pro_tip');
  else if (/faq/i.test(role)) blocks.push('faq');
  else if (/mistake|błąd/i.test(role)) blocks.push('warning', 'checklist', 'example');
  else if (/cost|koszt/i.test(role)) blocks.push('table', 'comparison', 'example');
  else if (/summary|podsum/i.test(role)) blocks.push('summary', 'checklist');
  else if (/technical|foundation/i.test(role)) blocks.push('checklist', 'steps', 'warning', 'example');
  else blocks.push('example', 'checklist', 'steps');
  if (freshness === 'high' && !blocks.includes('pro_tip')) blocks.push('pro_tip');
  return blocks;
}

function evidenceForBlocks(
  blocks: ContentBlockType[],
): Array<'example' | 'statistic' | 'case' | 'source'> {
  const out: Array<'example' | 'statistic' | 'case' | 'source'> = [];
  if (blocks.includes('example')) out.push('example');
  if (blocks.includes('table') || blocks.includes('comparison')) out.push('statistic');
  if (blocks.includes('warning')) out.push('case');
  out.push('source');
  return [...new Set(out)];
}

function freshnessNotes(tier: FreshnessTier, year: number): string[] {
  if (tier === 'high') {
    return [`Użyj roku ${year}`, 'Wspomnij AI Overviews / aktualne CWV', 'Świeże przykłady'];
  }
  if (tier === 'medium') return [`Aktualność na ${year}`];
  return [];
}

export function buildAdaptiveOutline(opts: {
  blueprint: ArticleBlueprint;
  kg: TargetKnowledgeGraph;
  reader: ReaderModel;
  intent: IntentBlueprint;
  /** CIE Narrative Optimizer seeds — when set, replace default topicSeeds. */
  narrativeSeeds?: NarrativeSeed[] | null;
}): AdaptiveOutline {
  const seeds: TopicSeed[] = opts.narrativeSeeds?.length
    ? opts.narrativeSeeds
    : topicSeeds(opts.reader, opts.blueprint);
  const totalImp = seeds.reduce((s, x) => s + x.importance, 0) || 1;
  const claimPool = [...opts.kg.claims];
  const questionPool = [...opts.kg.questions];
  let claimIdx = 0;
  let qIdx = 0;

  const sections: OutlineSection[] = seeds.map((seed, i) => {
    const share = seed.importance / totalImp;
    const words = Math.max(80, Math.round(opts.blueprint.targetWords * share));
    const claimQuota = Math.max(1, Math.min(
      MAX_CLAIMS_PER_SECTION,
      Math.round(opts.blueprint.targetClaims * share),
    ));
    const qQuota = Math.max(
      /faq|quick/i.test(seed.role) ? 2 : 0,
      Math.round(opts.blueprint.targetQuestions * share),
    );
    const assignedClaimIds: string[] = [];
    for (let c = 0; c < claimQuota && claimIdx < claimPool.length; c++) {
      assignedClaimIds.push(claimPool[claimIdx++].id);
    }
    const assignedQuestionIds: string[] = [];
    for (let q = 0; q < qQuota && qIdx < questionPool.length; q++) {
      assignedQuestionIds.push(questionPool[qIdx++].id);
    }
    const requiredBlocks = blocksForRole(seed.role, opts.blueprint.freshness);
    const sectionBudget: SectionBudget = {
      words,
      claims: assignedClaimIds.length || claimQuota,
      entities: Math.max(1, Math.round(3 * share * 10)),
      questions: assignedQuestionIds.length,
      examples: requiredBlocks.includes('example') ? Math.max(1, Math.round(opts.blueprint.targetExamples * share)) : 0,
      lists: requiredBlocks.includes('checklist') || requiredBlocks.includes('steps') ? 1 : 0,
      tables: requiredBlocks.includes('table') ? 1 : 0,
      images: seed.importance >= 6 ? 1 : 0,
      faq: requiredBlocks.includes('faq') ? Math.max(3, Math.round(opts.blueprint.targetFaqs * 0.6)) : 0,
      citations: Math.max(1, Math.round(2 * share * 10)),
    };
    return {
      id: `sec-${i}-${seed.role}`,
      heading: seed.heading,
      role: seed.role,
      importance: seed.importance,
      assignedClaimIds,
      assignedQuestionIds,
      requiredBlocks,
      expectedWords: words,
      evidenceNeeds: evidenceForBlocks(requiredBlocks),
      freshnessNotes: freshnessNotes(opts.blueprint.freshness, opts.intent.yearHint),
      sectionBudget,
    };
  });

  // Assign leftover required claims/questions round-robin (respect claim cap).
  const byImp = [...sections].sort((a, b) => b.importance - a.importance);
  while (claimIdx < claimPool.length) {
    let progressed = false;
    for (const s of byImp) {
      if (claimIdx >= claimPool.length) break;
      if (s.assignedClaimIds.length >= MAX_CLAIMS_PER_SECTION) continue;
      s.assignedClaimIds.push(claimPool[claimIdx++].id);
      s.sectionBudget.claims = s.assignedClaimIds.length;
      progressed = true;
    }
    if (!progressed) break;
  }
  while (qIdx < questionPool.length) {
    for (const s of byImp) {
      if (qIdx >= questionPool.length) break;
      if (/summary/i.test(s.role)) continue;
      s.assignedQuestionIds.push(questionPool[qIdx++].id);
      s.sectionBudget.questions = s.assignedQuestionIds.length;
    }
  }

  return {
    h1: opts.reader.keyword,
    sections,
    narrativeOrder: sections.map((s) => s.id),
  };
}

/** Improve outline by ensuring required blocks and rebalancing leftovers. */
export function improveOutline(
  outline: AdaptiveOutline,
  blueprint: ArticleBlueprint,
  kg: TargetKnowledgeGraph,
): AdaptiveOutline {
  const next: AdaptiveOutline = {
    ...outline,
    sections: outline.sections.map((s) => ({
      ...s,
      assignedClaimIds: [...s.assignedClaimIds],
      assignedQuestionIds: [...s.assignedQuestionIds],
      requiredBlocks: [...s.requiredBlocks],
      sectionBudget: { ...s.sectionBudget },
    })),
  };

  // Ensure at least half of sections have example + checklist where budget needs them.
  let examples = next.sections.filter((s) => s.requiredBlocks.includes('example')).length;
  let checklists = next.sections.filter((s) => s.requiredBlocks.includes('checklist')).length;
  const needExamples = Math.ceil(blueprint.targetExamples * 0.5);
  const needChecklists = Math.max(1, Math.ceil(blueprint.targetChecklists * 0.5));
  for (const s of [...next.sections].sort((a, b) => b.importance - a.importance)) {
    if (examples < needExamples && !s.requiredBlocks.includes('example')) {
      s.requiredBlocks.push('example');
      s.evidenceNeeds = [...new Set([...s.evidenceNeeds, 'example' as const])];
      s.sectionBudget.examples = Math.max(1, s.sectionBudget.examples);
      examples++;
    }
    if (checklists < needChecklists && !s.requiredBlocks.includes('checklist')) {
      s.requiredBlocks.push('checklist');
      s.sectionBudget.lists = Math.max(1, s.sectionBudget.lists);
      checklists++;
    }
  }

  const assigned = new Set(next.sections.flatMap((s) => s.assignedClaimIds));
  const missingClaims = kg.claims.filter((c) => !assigned.has(c.id));
  const byImp = [...next.sections].sort((a, b) => b.importance - a.importance);
  let i = 0;
  for (const c of missingClaims) {
    let placed = false;
    for (let attempt = 0; attempt < byImp.length; attempt++) {
      const target = byImp[(i + attempt) % byImp.length];
      if (target.assignedClaimIds.length >= MAX_CLAIMS_PER_SECTION) continue;
      target.assignedClaimIds.push(c.id);
      target.sectionBudget.claims = target.assignedClaimIds.length;
      placed = true;
      break;
    }
    if (!placed) break;
    i++;
  }

  const assignedQ = new Set(next.sections.flatMap((s) => s.assignedQuestionIds));
  const missingQ = kg.questions.filter((q) => !assignedQ.has(q.id));
  i = 0;
  for (const q of missingQ) {
    const target = byImp[i % byImp.length];
    if (!/summary/i.test(target.role)) {
      target.assignedQuestionIds.push(q.id);
      target.sectionBudget.questions = target.assignedQuestionIds.length;
    }
    i++;
  }

  // Ensure required section names appear in headings/roles.
  for (const req of blueprint.requiredSections) {
    const hit = next.sections.some((s) =>
      s.heading.toLowerCase().includes(req.toLowerCase())
      || s.role.toLowerCase().includes(req.toLowerCase().replace(/\s+/g, '_')),
    );
    if (!hit && next.sections.length) {
      const weakest = [...next.sections].sort((a, b) => a.importance - b.importance)[0];
      weakest.heading = req;
      weakest.role = req.toLowerCase().replace(/\s+/g, '_');
      weakest.importance = Math.max(weakest.importance, 6);
    }
  }

  return next;
}

export function buildSectionBriefs(
  outline: AdaptiveOutline,
  kg: TargetKnowledgeGraph,
  reader?: ReaderModel,
): SectionBrief[] {
  const claimMap = new Map(kg.claims.map((c) => [c.id, c]));
  const questionMap = new Map(kg.questions.map((q) => [q.id, q]));
  const tone = reader?.tone || 'professional';

  return outline.sections.map((s, i) => {
    const prev = i > 0 ? outline.sections[i - 1] : null;
    const next = i < outline.sections.length - 1 ? outline.sections[i + 1] : null;
    const mustAnswer = s.assignedQuestionIds
      .map((id) => questionMap.get(id)?.question)
      .filter((q): q is string => Boolean(q));
    const sectionPriority: PriorityClass =
      s.importance >= 9 ? 'critical'
        : s.importance >= 7 ? 'high'
          : s.importance >= 4 ? 'medium'
            : 'low';
    const claimIds = s.assignedClaimIds.slice(0, MAX_CLAIMS_PER_SECTION);
    const signals = claimIds
      .map((id) => claimMap.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .slice(0, 4)
      .map((c) => `${c.priority}:${c.gainClass}`);
    return {
      sectionId: s.id,
      heading: s.heading,
      objective: /quick.?answer|quick.?wins/i.test(s.role)
        ? `Daj czytelnikowi natychmiastową wartość i konkretne kroki: ${s.heading}.`
        : `Pokryj ${s.heading} z przypisanymi claims, mustAnswer i blokami treści.`,
      claimIds,
      questionIds: s.assignedQuestionIds,
      blocks: s.requiredBlocks,
      evidence: s.evidenceNeeds.map((kind) => ({
        kind,
        hint:
          kind === 'example'
            ? claimIds.map((id) => claimMap.get(id)?.citationHint || claimMap.get(id)?.statement).find(Boolean) || 'Konkretny przykład wdrożenia'
            : kind === 'statistic'
              ? 'Liczba / zakres z wiarygodnego źródła'
              : kind === 'case'
                ? 'Mini case / scenariusz branżowy'
                : 'Źródło (docs / narzędzie)',
      })),
      budget: { ...s.sectionBudget, claims: claimIds.length },
      freshnessNotes: s.freshnessNotes,
      mustAnswer,
      sectionPriority,
      reason: {
        summary: `Sekcja „${s.heading}” · ${claimIds.length} claims · priority ${sectionPriority}`,
        signals: signals.length ? signals : [`role:${s.role}`, `importance:${s.importance}`],
      },
      writerHints: {
        previousSection: prev?.heading ?? null,
        nextSection: next?.heading ?? null,
        transition: prev
          ? `Po „${prev.heading}” przejdź naturalnie do „${s.heading}” bez powtarzania definicji.`
          : `Otwórz sekcję action-first — bez „X to proces…”.`,
        tone,
        avoidRepeating: prev
          ? [prev.heading, ...prev.assignedClaimIds.slice(0, 2).map((id) => claimMap.get(id)?.statement || '').filter(Boolean)]
          : [],
      },
    };
  });
}

export function improveBrief(brief: SectionBrief): SectionBrief {
  const next: SectionBrief = {
    ...brief,
    blocks: [...brief.blocks],
    evidence: [...brief.evidence],
    claimIds: [...brief.claimIds],
    mustAnswer: [...(brief.mustAnswer || [])],
    writerHints: {
      ...brief.writerHints,
      avoidRepeating: [...(brief.writerHints?.avoidRepeating || [])],
    },
  };
  if (!next.blocks.length) next.blocks.push('example', 'checklist');
  if (next.budget.examples > 0 && !next.evidence.some((e) => e.kind === 'example')) {
    next.evidence.push({ kind: 'example', hint: 'Dodaj praktyczny przykład' });
  }
  if (next.budget.claims > 0 && next.claimIds.length === 0) {
    next.claimIds.push(`pending-claim-${next.sectionId}`);
  }
  if (next.budget.words < 40) {
    next.budget = { ...next.budget, words: 120 };
  }
  if (!next.mustAnswer.length && next.questionIds.length) {
    next.mustAnswer = next.questionIds.map((id) => `Answer assigned question ${id}`);
  }
  if (!next.sectionPriority) next.sectionPriority = 'medium';
  if (!next.writerHints) {
    next.writerHints = {
      previousSection: null,
      nextSection: null,
      transition: 'Kontynuuj narrację bez powtórzeń.',
      tone: 'professional',
      avoidRepeating: [],
    };
  }
  return next;
}
