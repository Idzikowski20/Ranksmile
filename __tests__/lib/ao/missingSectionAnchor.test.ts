import { buildEditCandidates } from '@/src/infrastructure/ao/buildCandidates';
import { buildIntentProfile } from '@/src/core/domain/optimize/intentProfile';
import { budgetForAction, DEFAULT_EDIT_BUDGET } from '@/src/core/domain/optimize/editBudget';
import type { Section } from '@/src/infrastructure/articles/articleSections';

const profile = buildIntentProfile({ keyword: 'szantaż emocjonalny', plainText: 'szantaż emocjonalny treść' });

function sec(id: string, index: number, headingText: string): Section {
  return { id, index, headingText, html: `<h2>${headingText}</h2><p>${'słowo '.repeat(60)}</p>` };
}

/**
 * The plan's order, with two sections deleted by hand ("Szybka odpowiedź" and
 * "Najczęstsze błędy") — the case that always appended repairs below the summary.
 */
const plannedHeadings = [
  'Czym jest szantaż emocjonalny',
  'Szybka odpowiedź',
  'Pierwsze kroki w sytuacji szantażu',
  'Najczęstsze błędy',
  'Podsumowanie',
];

const sections = [
  sec('s0', 0, 'Czym jest szantaż emocjonalny'),
  sec('s1', 1, 'Pierwsze kroki w sytuacji szantażu'),
  sec('s2', 2, 'Podsumowanie'),
];

describe('add_missing_section anchoring', () => {
  const cands = buildEditCandidates({ profile, sections, plannedHeadings, rebuild: true })
    .filter((c) => c.suggestedAction === 'add_missing_section');

  it('restores a planned section after the heading that precedes it in the plan', () => {
    const quick = cands.find((c) => c.targetGap === 'Szybka odpowiedź');
    const mistakes = cands.find((c) => c.targetGap === 'Najczęstsze błędy');
    expect(quick).toBeDefined();
    expect(mistakes).toBeDefined();
    // "Szybka odpowiedź" follows "Czym jest…" in the plan → anchored to s0, not the last section.
    expect(quick!.targetSectionId).toBe('s0');
    // "Najczęstsze błędy" follows "Pierwsze kroki…" → anchored to s1, above the summary.
    expect(mistakes!.targetSectionId).toBe('s1');
  });

  it('never dumps every restored section onto the last one', () => {
    const last = sections[sections.length - 1].id;
    expect(cands.every((c) => c.targetSectionId === last)).toBe(false);
  });

  it('keeps a restored section section-sized', () => {
    // Additive actions bypass the strategy cap, so this ceiling is the real limit. At 600
    // it was the largest budget in the system and a "quick answer" came back as the
    // longest block on the page.
    const added = budgetForAction('add_missing_section', DEFAULT_EDIT_BUDGET).maxNewWords;
    expect(added).toBeLessThanOrEqual(350);
  });
});
