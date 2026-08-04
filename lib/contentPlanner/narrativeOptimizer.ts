/**
 * Narrative Optimizer — Topic Blocks + intent → ordered outline seeds.
 * Prefer action-first for step-by-step; avoid English course templates when blocks ≥ 5.
 */
import type { TopicBlock } from '../knowledgeEngine/types';
import type { IntentBlueprint } from './types';

export type NarrativeSeed = {
  role: string;
  heading: string;
  importance: number;
  topicBlockId?: string;
  reasonSummary?: string;
};

const ROLE_RANK: Record<string, number> = {
  FOUNDATION: 2,
  ACTION: 1,
  MONITORING: 3,
  ADVANCED: 4,
};

const TEMPLATE_FILLERS_PL: NarrativeSeed[] = [
  { role: 'keywords', heading: 'Analiza słów kluczowych i intencji', importance: 7 },
  { role: 'technical', heading: 'Techniczne SEO i indeksowanie', importance: 7 },
  { role: 'content', heading: 'Tworzenie treści, które rankują', importance: 6 },
  { role: 'links_internal', heading: 'Linkowanie wewnętrzne', importance: 5 },
  { role: 'monitor', heading: 'Monitorowanie wyników', importance: 6 },
];

function blockToSeed(b: TopicBlock): NarrativeSeed {
  const importance =
    b.role === 'ACTION' ? 9
      : b.role === 'FOUNDATION' ? 8
        : b.role === 'MONITORING' ? 7
          : 5;
  return {
    role: b.role.toLowerCase(),
    heading: b.title,
    importance: Math.max(importance, Math.round(b.consensus * 10)),
    topicBlockId: b.id,
    reasonSummary: `Topic block ${b.role} · consensus ${Math.round(b.consensus * 100)}%`,
  };
}

/**
 * Order: Quick Answer → action path → foundation → monitoring → advanced → FAQ/Summary.
 * When blocks ≥ 5, do not inject primary EN course template labels.
 */
export function optimizeNarrative(opts: {
  topicBlocks: TopicBlock[];
  intent: IntentBlueprint;
  targetH2: number;
  requiredSections?: string[];
}): NarrativeSeed[] {
  const need = Math.max(5, opts.targetH2);
  const required = opts.requiredSections || [];
  const seeds: NarrativeSeed[] = [];

  for (const name of required) {
    seeds.push({
      role: name.toLowerCase().replace(/\s+/g, '_'),
      heading: name,
      importance:
        /quick/i.test(name) ? 10
          : /faq/i.test(name) ? 4
            : /summary|podsum/i.test(name) ? 2
              : 6,
      reasonSummary: 'Required section from reader blueprint',
    });
  }

  const actionFirst =
    opts.intent.articleType === 'step-by-step'
    || opts.intent.narrativePreference === 'step_by_step';

  const sorted = [...opts.topicBlocks].sort((a, b) => {
    if (actionFirst) {
      const ra = ROLE_RANK[a.role] ?? 9;
      const rb = ROLE_RANK[b.role] ?? 9;
      if (ra !== rb) return ra - rb;
    }
    return b.consensus - a.consensus;
  });

  for (const b of sorted) {
    if (seeds.length >= need) break;
    if (seeds.some((s) => s.heading.toLowerCase() === b.title.toLowerCase())) continue;
    seeds.push(blockToSeed(b));
  }

  const allowFillers = opts.topicBlocks.length < 5;
  if (allowFillers) {
    for (const f of TEMPLATE_FILLERS_PL) {
      if (seeds.length >= need) break;
      if (seeds.some((s) => s.role === f.role)) continue;
      // Guard: never inject English course labels as primary seeds
      if (/keywords and intent|technical seo foundations/i.test(f.heading)) continue;
      seeds.push({ ...f, reasonSummary: 'Template filler (few topic blocks)' });
    }
  }

  while (seeds.length < need) {
    seeds.push({
      role: `topic_${seeds.length}`,
      heading: `Praktyczne rozszerzenie (${seeds.length + 1})`,
      importance: 3,
      reasonSummary: 'Padding to meet H2 target',
    });
  }

  return seeds.slice(0, need);
}
