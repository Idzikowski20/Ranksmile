/**
 * Narrative Optimizer — Topic Blocks + intent → ordered outline seeds.
 * Prefer action-first for step-by-step; never inject product-SEO meta H2s.
 */
import type { TopicBlock } from '../knowledgeEngine/types';
import type { IntentBlueprint } from './types';
import { headingFillersFromCompetitors, isSeoMetaHeading } from './sectionLabels';

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
 * Order: required action path → topic blocks → competitor heading fillers.
 * FAQ/Summary stay in required list; outlineBuilder reorders them to the end.
 */
export function optimizeNarrative(opts: {
  topicBlocks: TopicBlock[];
  intent: IntentBlueprint;
  targetH2: number;
  requiredSections?: string[];
  commonHeadings?: string[];
  lang?: 'pl' | 'en';
}): NarrativeSeed[] {
  const required = opts.requiredSections || [];
  const need = Math.max(5, opts.targetH2, required.length);
  const seeds: NarrativeSeed[] = [];
  const lang = opts.lang || 'pl';

  for (const name of required) {
    if (isSeoMetaHeading(name)) continue;
    seeds.push({
      role: name.toLowerCase().replace(/\s+/g, '_'),
      heading: name,
      importance:
        /quick|szybka|szybki|pierwsze/i.test(name) ? 10
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
    if (isSeoMetaHeading(b.title)) continue;
    if (seeds.some((s) => s.heading.toLowerCase() === b.title.toLowerCase())) continue;
    seeds.push(blockToSeed(b));
  }

  const fillers = headingFillersFromCompetitors(
    opts.commonHeadings || [],
    opts.intent.keyword,
    lang,
    Math.max(0, need - seeds.length),
  );
  for (const f of fillers) {
    if (seeds.length >= need) break;
    if (seeds.some((s) => s.heading.toLowerCase() === f.heading.toLowerCase())) continue;
    seeds.push({ ...f, reasonSummary: 'Competitor / practical filler' });
  }

  return seeds.slice(0, need);
}
