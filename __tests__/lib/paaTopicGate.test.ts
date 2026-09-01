import { isUsefulCitationPrompt } from '@/src/infrastructure/articles/citationPrompts';

describe('PAA topic gate', () => {
  const keyword = 'szantaż emocjonalny';

  it('rejects the domain PAA that contaminated article 93', () => {
    // Deep analysis runs against prodetektyw.pl, so its PAA is about detective pricing.
    expect(isUsefulCitationPrompt('Ile kosztuje detektyw za godzinę?', keyword)).toBe(false);
    expect(isUsefulCitationPrompt('Agencja detektywistyczna Warszawa cennik?', keyword)).toBe(false);
    expect(isUsefulCitationPrompt('Ile kosztuje wynajęcie detektywa na dzień?', keyword)).toBe(false);
  });

  it('keeps questions that are actually about the article keyword', () => {
    expect(isUsefulCitationPrompt('Czym jest szantaż emocjonalny w związku?', keyword)).toBe(true);
    expect(isUsefulCitationPrompt('Jak rozpoznać szantaż emocjonalny?', keyword)).toBe(true);
  });
});
