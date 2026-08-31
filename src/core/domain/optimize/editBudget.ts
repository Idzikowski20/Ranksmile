export type EditBudget = {
  maxNewWords: number;
  maxDeletedWords: number;
  maxModifiedParagraphs: number;
  maxChangeRatio: number;
  allowNewHeading: boolean;
};

export const DEFAULT_EDIT_BUDGET: EditBudget = {
  maxNewWords: 70,
  maxDeletedWords: 40,
  maxModifiedParagraphs: 2,
  maxChangeRatio: 0.35,
  allowNewHeading: false,
};

/** Precision targeted — can still substantial-rewrite one section (not tiny-only). */
export const PRECISION_SECTION_BUDGET: EditBudget = {
  maxNewWords: 280,
  maxDeletedWords: 120,
  maxModifiedParagraphs: 8,
  maxChangeRatio: 0.7,
  allowNewHeading: true,
};

export const ENRICHMENT_EDIT_BUDGET: EditBudget = {
  maxNewWords: 350,
  maxDeletedWords: 200,
  maxModifiedParagraphs: 12,
  maxChangeRatio: 0.8,
  allowNewHeading: true,
};

export const DEEP_EDIT_BUDGET: EditBudget = {
  maxNewWords: 450,
  maxDeletedWords: 300,
  maxModifiedParagraphs: 20,
  maxChangeRatio: 0.85,
  allowNewHeading: true,
};

export function budgetFromStep(partial: Partial<EditBudget>): EditBudget {
  return { ...DEFAULT_EDIT_BUDGET, ...partial };
}

/** Absolute ceilings per action (never word-count targets). Cap by strategy base. */
export function budgetForAction(action: string, base: EditBudget): EditBudget {
  const ceilings: Record<string, Partial<EditBudget>> = {
    improve_direct_answer: { maxNewWords: 100, maxDeletedWords: 40, maxModifiedParagraphs: 4 },
    insert_sentence: { maxNewWords: 100, maxDeletedWords: 40, maxModifiedParagraphs: 3 },
    add_facts: { maxNewWords: 200, maxDeletedWords: 80, maxModifiedParagraphs: 6 },
    expand_section: { maxNewWords: 300, maxDeletedWords: 150, maxModifiedParagraphs: 10 },
    expand_existing_paragraph: { maxNewWords: 300, maxDeletedWords: 150, maxModifiedParagraphs: 10 },
    rewrite_section: { maxNewWords: 450, maxDeletedWords: 300, maxModifiedParagraphs: 20, allowNewHeading: true },
    add_subsection: { maxNewWords: 350, maxDeletedWords: 100, maxModifiedParagraphs: 12, allowNewHeading: true },
    // maxChangeRatio 1: this step APPENDS a section, so the safety gate measures it
    // against an empty "before" and the ratio is 1.0 by definition — the metric asks
    // how much of an existing block was rewritten, and none was. Deletion and word
    // budgets still bound it.
    // 350, not 600: a restored section should read like the article's other sections, and
    // 600 made it the biggest budget in the system — larger than a full rewrite_section —
    // so a "Szybka odpowiedź" (quick answer) came back as the longest block on the page.
    add_missing_section: { maxNewWords: 350, maxDeletedWords: 50, maxModifiedParagraphs: 24, maxChangeRatio: 1, allowNewHeading: true },
    add_faq: { maxNewWords: 400, maxDeletedWords: 80, maxModifiedParagraphs: 16, allowNewHeading: true },
    enrich_heading: { maxNewWords: 20, maxDeletedWords: 15, maxModifiedParagraphs: 1 },
  };
  const c = ceilings[action];
  if (!c) return base;
  // Additive actions are NOT capped by the strategy base.
  //
  // The safety gate compares the anchor section against "anchor + the whole new
  // section", so `add_missing_section` is measured as if it rewrote the anchor. Under
  // `Math.min` with a strategy base of 70 new words, its own 600-word ceiling collapsed
  // to 70 and every rebuilt section was rejected on WORD_BUDGET / PARAGRAPH_BUDGET —
  // the model wrote them, the gate threw them away. These actions add a block rather
  // than edit one, so their ceiling is the real limit; deletion stays capped by the
  // base, which is what actually protects existing prose.
  const additive = action === 'add_missing_section' || action === 'add_subsection' || action === 'add_faq';
  const pick = (ceiling: number | undefined, baseValue: number): number => {
    const v = ceiling ?? baseValue;
    return additive ? Math.max(v, baseValue) : Math.min(v, baseValue);
  };
  return {
    maxNewWords: pick(c.maxNewWords, base.maxNewWords),
    maxDeletedWords: Math.min(c.maxDeletedWords ?? base.maxDeletedWords, base.maxDeletedWords),
    maxModifiedParagraphs: pick(c.maxModifiedParagraphs, base.maxModifiedParagraphs),
    maxChangeRatio: Math.max(c.maxChangeRatio ?? base.maxChangeRatio, base.maxChangeRatio),
    allowNewHeading: Boolean(c.allowNewHeading || base.allowNewHeading),
  };
}
