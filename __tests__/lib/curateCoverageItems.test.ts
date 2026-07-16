import {
  buildCitationPrompts,
  citationIntentItems,
  isLikelySyntheticCitationTemplate,
  isUsefulCitationPrompt,
  scoreCitationPrompt,
} from '../../lib/citationPrompts';
import { isCorpusNoiseSentence } from '../../lib/corpusNoiseFilter';
import {
  AI_COVERAGE_MAX,
  curateAiCoverageItems,
  compactCoverageSnapshotItems,
  dedupePaaQuestions,
  scorePaaQuestion,
} from '../../lib/curateCoverageItems';
import type { CoverageItem } from '../../lib/aiCoverage';

describe('citationPrompts', () => {
  const keyword = 'prywatny detektyw Warszawa';

  it('does not invent prompts — empty SERP means empty list', () => {
    expect(buildCitationPrompts(keyword)).toEqual([]);
    expect(citationIntentItems(keyword)).toEqual([]);
  });

  it('keeps real SERP questions only', () => {
    const serp = [
      'Ile kosztuje detektyw w Warszawie?',
      'Czy detektyw odkryje zdradę?',
      'Lubimyczytac.pl nie prowadzi sprzedaży',
    ];
    const prompts = buildCitationPrompts(keyword, serp);
    expect(prompts).toContain('Ile kosztuje detektyw w Warszawie?');
    expect(prompts).toContain('Czy detektyw odkryje zdradę?');
    expect(prompts.some((p) => /lubimyczytac/i.test(p))).toBe(false);
  });

  it('rejects scraped boilerplate', () => {
    expect(isUsefulCitationPrompt('Lubimyczytac.pl nie prowadzi sprzedaży', keyword)).toBe(false);
    expect(isUsefulCitationPrompt('Answer the main question early', keyword)).toBe(false);
  });

  it('citation intent items come from SERP, not templates', () => {
    const serp = [
      'Ile kosztuje detektyw w Warszawie?',
      'Jak wybrać prywatnego detektywa?',
      'Czy warto wynająć detektywa?',
    ];
    const items = citationIntentItems(keyword, undefined, { serpQuestions: serp });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(8);
    expect(items.every((i) => i.type === 'intent')).toBe(true);
    expect(items.every((i) => i.source === 'paa')).toBe(true);
    expect(items.every((i) => serp.some((s) => s === i.label))).toBe(true);
  });

  it('uses real legal SERP questions for nękanie without inventing extras', () => {
    const serp = [
      'Kiedy można oskarżyć o nękanie?',
      'Jakie zachowania są uważane za nękanie?',
    ];
    const items = citationIntentItems('nękanie', undefined, { serpQuestions: serp });
    expect(items.map((i) => i.label)).toEqual(serp);
    expect(items.every((i) => !isLikelySyntheticCitationTemplate(i.label, 'nękanie') || serp.includes(i.label))).toBe(true);
  });

  it('strips legacy synthetic templates for wojna hybrydowa', () => {
    expect(isLikelySyntheticCitationTemplate('Kiedy można oskarżyć o wojna hybrydowa?', 'wojna hybrydowa')).toBe(true);
    expect(isLikelySyntheticCitationTemplate('Co to jest wojna hybrydowa emocjonalne?', 'wojna hybrydowa')).toBe(true);
    const kept = buildCitationPrompts('wojna hybrydowa', [
      'Kiedy można oskarżyć o wojna hybrydowa?',
      'Czym różni się wojna hybrydowa od konfliktu zbrojnego?',
    ]);
    // buildCitationPrompts keeps real SERP; UI filter strips synthetic fills separately
    expect(kept).toContain('Czym różni się wojna hybrydowa od konfliktu zbrojnego?');
  });
});

describe('corpusNoiseFilter', () => {
  it('flags footer and unrelated site junk', () => {
    expect(isCorpusNoiseSentence('Wszelkie prawa zastrzeżone.')).toBe(true);
    expect(isCorpusNoiseSentence('Prywatny detektyw działa zgodnie z ustawą o usługach detektywistycznych.')).toBe(false);
  });
});

describe('curateCoverageItems', () => {
  const keyword = 'prywatny detektyw Warszawa';

  it('dedupes PAA questions', () => {
    const rows = dedupePaaQuestions([
      { question: 'Ile kosztuje detektyw w Warszawie?' },
      { question: '  ile kosztuje detektyw w warszawie?  ' },
      { question: 'Czy detektyw odkryje zdradę?' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('filters job-listing noise', () => {
    expect(scorePaaQuestion('Praca Detektyw, Warszawa (Pilne!)', keyword)).toBeLessThanOrEqual(0);
    expect(scorePaaQuestion('Ile bierze detektyw za wykrycie zdrady?', keyword)).toBeGreaterThan(30);
  });

  it('curates LLM-sourced questions instead of corpus junk', () => {
    const pool = [
      { question: 'Ile bierze detektyw za wykrycie zdrady?', sources: ['chat_gpt' as const] },
      { question: 'Czy detektyw odkryje zdradę?', sources: ['perplexity' as const] },
      { question: 'Lubimyczytac.pl nie prowadzi sprzedaży i nie uczestniczy w procesie zakupowym', sources: ['ai_overview' as const] },
      { question: 'Answer the main question early', sources: ['gemini' as const] },
      { question: 'Praca Detektyw, Warszawa', sources: ['reddit' as const] },
      { question: 'Wszelkie prawa zastrzeżone.', sources: ['ai_overview' as const] },
    ];

    const { knowledge, entity } = curateAiCoverageItems({ keyword, llmQuestions: pool });
    expect(knowledge.length).toBeGreaterThanOrEqual(2);
    expect(knowledge.length).toBeLessThanOrEqual(AI_COVERAGE_MAX - 8);
    expect(entity).toHaveLength(0);
    expect(knowledge.some((i) => /lubimyczytac/i.test(i.label))).toBe(false);
    expect(knowledge.some((i) => /Answer the main/i.test(i.label))).toBe(false);
    expect(knowledge.some((i) => /kosztuje|zdrad/i.test(i.label))).toBe(true);
    expect(knowledge.some((i) => i.llmSources?.includes('chat_gpt'))).toBe(true);
  });

  it('merges PAA questions into knowledge pool', () => {
    const { knowledge } = curateAiCoverageItems({
      keyword: 'nękanie',
      paaQuestions: [
        { question: 'Kiedy można zgłosić nękanie?' },
        { question: 'Jakie zachowania są uważane za nękanie?' },
        { question: 'Co to jest nękanie emocjonalne?' },
      ],
      llmQuestions: [
        { question: 'Czym jest uporczywe nękanie?', sources: ['chat_gpt'] },
      ],
    });
    expect(knowledge.length).toBeGreaterThanOrEqual(3);
    const labels = knowledge.map((i) => i.label).join(' ');
    expect(labels).toMatch(/zgłosić nękanie/i);
    expect(labels).toMatch(/emocjonalne/i);
  });

  it('compacts legacy bloated snapshots', () => {
    const serp = [
      'Ile kosztuje detektyw w Warszawie?',
      'Czy warto wynająć detektywa?',
      'Jak wybrać prywatnego detektywa?',
      'Detektyw Warszawa opinie',
      'Ile bierze detektyw za zdradę?',
      'Czy detektyw jest legalny?',
      'Jak znaleźć dobrego detektywa?',
      'Prywatny detektyw ranking',
    ];
    const bloated: CoverageItem[] = [
      ...citationIntentItems(keyword, undefined, { serpQuestions: serp }),
      ...Array.from({ length: 140 }, (_, i) => ({
        id: `paa-${i}`,
        label: i % 3 === 0 ? 'Ile kosztuje detektyw w Warszawie?' : `Lubimyczytac noise ${i}`,
        type: 'paa' as const,
        category: 'knowledge' as const,
        importance: 'recommended' as const,
        source: 'paa' as const,
        covered: false,
        quality: 0,
      })),
    ];
    const compact = compactCoverageSnapshotItems(bloated, keyword);
    expect(compact.length).toBeLessThanOrEqual(AI_COVERAGE_MAX);
    expect(compact.filter((i) => i.type === 'intent').length).toBeGreaterThan(0);
  });

  it('separate paa vs intent IDs when ENABLE_NEW_COVERAGE_IDS', () => {
    const prev = process.env.ENABLE_NEW_COVERAGE_IDS;
    process.env.ENABLE_NEW_COVERAGE_IDS = 'true';
    try {
      const { knowledge } = curateAiCoverageItems({
        keyword,
        llmQuestions: [{ question: 'Ile kosztuje detektyw w Warszawie?', sources: ['chat_gpt'] }],
      });
      const intents = citationIntentItems(keyword, undefined, {
        serpQuestions: ['Ile kosztuje detektyw w Warszawie?', 'Czy warto wynająć detektywa?'],
      });
      expect(knowledge.length).toBeGreaterThan(0);
      expect(intents.length).toBeGreaterThan(0);
      expect(knowledge[0]?.id.startsWith('paa-citation-')).toBe(true);
      expect(intents[0]?.id.startsWith('intent-citation-')).toBe(true);
      expect(knowledge[0]?.id).not.toBe(intents[0]?.id);
    } finally {
      if (prev === undefined) delete process.env.ENABLE_NEW_COVERAGE_IDS;
      else process.env.ENABLE_NEW_COVERAGE_IDS = prev;
    }
  });
});
