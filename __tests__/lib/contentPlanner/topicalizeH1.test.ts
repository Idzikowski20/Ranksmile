/** @jest-environment node */
/**
 * The H1 must be a topical, reader-benefit title — never brand/audience/service framing.
 * Surfer writes "Szantaż emocjonalny: jak go rozpoznać, przerwać i zadbać o swoje
 * bezpieczeństwo"; our outline LLM kept emitting "Szantaż emocjonalny — poufna pomoc
 * detektywistyczna dla osób prywatnych i firm z Warszawy" even when the prompt forbade
 * it. This guard strips the framing deterministically.
 */
import { topicalizeH1 } from '@/src/core/domain/contentPlanner/sectionLabels';

describe('topicalizeH1', () => {
  it('strips brand/audience/city framing, keeps the topical head', () => {
    expect(topicalizeH1(
      'Szantaż emocjonalny — poufna pomoc detektywistyczna dla osób prywatnych i firm z Warszawy',
      'szantaż emocjonalny',
      'pl',
    )).toBe('Szantaż emocjonalny');
  });

  it('leaves a genuinely topical, Surfer-style H1 untouched', () => {
    const good = 'Szantaż emocjonalny: jak go rozpoznać, przerwać i zadbać o swoje bezpieczeństwo';
    expect(topicalizeH1(good, 'szantaż emocjonalny', 'pl')).toBe(good);
  });

  it('keeps the topical clause and drops only the branded tail', () => {
    expect(topicalizeH1(
      'Szantaż emocjonalny w rodzinie — jak pomóc osobom prywatnym',
      'szantaż emocjonalny',
      'pl',
    )).toBe('Szantaż emocjonalny w rodzinie');
  });

  it('falls back to the keyword when nothing topical survives', () => {
    expect(topicalizeH1(
      'Poufna pomoc detektywistyczna dla firm z Warszawy',
      'szantaż emocjonalny',
      'pl',
    )).toBe('Szantaż emocjonalny');
  });

  it('handles an empty H1', () => {
    expect(topicalizeH1('', 'szantaż emocjonalny', 'pl')).toBe('Szantaż emocjonalny');
  });
});
