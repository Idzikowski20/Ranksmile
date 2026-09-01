/**
 * Reader Model — persona for the searcher (not brand niche).
 */
import type { IntentBlueprint, ReaderModel } from './types';

const BEGINNER_RE = /\b(jak|samemu|samodziel|beginner|dla pocz|od zera|krok po kroku)\b/i;

export function buildReaderModel(opts: {
  intent: IntentBlueprint;
  brandNicheHint?: string;
  language?: string;
}): ReaderModel {
  const { intent } = opts;
  const beginner = BEGINNER_RE.test(intent.keyword) || intent.articleType === 'step-by-step';
  const langHint = (opts.language || '').toLowerCase();
  const language: 'pl' | 'en' = langHint.startsWith('en') ? 'en' : 'pl';

  // Brand niche never becomes the reader persona for generic SERP intents.
  void opts.brandNicheHint;

  return {
    keyword: intent.keyword,
    readerPersona: beginner ? 'beginner' : 'informed',
    goal: beginner
      ? `Samodzielnie osiągnąć pierwsze efekty dla: ${intent.keyword}`
      : `Pogłębić wiedzę i wdrożyć: ${intent.keyword}`,
    timeBudgetMinutes: beginner ? 30 : 45,
    knowledgeLevel: beginner ? 'low' : 'medium',
    desiredOutcome: beginner ? 'pierwsze efekty i jasny plan' : 'kompletny playbook',
    tone: 'praktyczny',
    articleType: intent.articleType,
    fears: beginner
      ? ['koszty agencji', 'puste obietnice TOP1', 'strata czasu']
      : ['nieaktualne dane', 'brak ROI'],
    expectedCta: beginner
      ? 'Zacznij od Google Search Console i jednego audytu'
      : 'Wdróż checklistę i zmierz efekty w Search Console',
    language,
  };
}
