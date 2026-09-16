/**
 * Seeds drive the whole domain analysis: Suggest expands them, the SERP stage ranks
 * competitors for them. Splitting Brand Knowledge into bare words fed the pipeline
 * template headers ("Business") and sentence fragments ("specjalizująca"). The template
 * carries a "Topics to cover" section written as real phrases — use that.
 */
import { seedsFromBrandKnowledge } from '@/src/core/domain/setup/brandKnowledgeSeeds';

const BRAND_KNOWLEDGE = [
  'Business Type',
  'Agencja digital specjalizująca się w tworzeniu stron internetowych.',
  '',
  'Industry',
  'Tworzenie stron internetowych, e-commerce oraz marketing internetowy.',
  '',
  'Topics to cover',
  'Tworzenie stron internetowych, sklepy online, aplikacje webowe, pozycjonowanie stron w Google, SEO dla firm',
  '',
  'Example cases (anonymized)',
  'Sklep internetowy z nadrukami: zrealizowano projekt e-commerce.',
].join('\n');

describe('seedsFromBrandKnowledge', () => {
  it('takes the phrases from "Topics to cover", not the prose around it', () => {
    expect(seedsFromBrandKnowledge(BRAND_KNOWLEDGE)).toEqual([
      'tworzenie stron internetowych',
      'sklepy online',
      'aplikacje webowe',
      'pozycjonowanie stron w google',
      'seo dla firm',
    ]);
  });

  it('stops at the next section so example cases never become keywords', () => {
    expect(seedsFromBrandKnowledge(BRAND_KNOWLEDGE).join(' ')).not.toContain('nadrukami');
  });

  it('reads the section when the model translated its heading', () => {
    const pl = 'Tematy do poruszenia\nwynajem mieszkania, umowa najmu\n\nExample cases\nnic';
    expect(seedsFromBrandKnowledge(pl)).toEqual(['wynajem mieszkania', 'umowa najmu']);
  });

  it('accepts a bulleted list as readily as a comma-separated one', () => {
    const bullets = 'Topics to cover\n- audyt seo\n- pozycjonowanie lokalne\n\nCompetitors\nagencje';
    expect(seedsFromBrandKnowledge(bullets)).toEqual(['audyt seo', 'pozycjonowanie lokalne']);
  });

  it('drops one-word noise and duplicates, and caps the list', () => {
    const noisy = `Topics to cover\n${['seo', 'audyt seo', 'audyt seo', 'a', ...Array.from({ length: 20 }, (_, i) => `fraza numer ${i}`)].join(', ')}`;
    const seeds = seedsFromBrandKnowledge(noisy);
    expect(seeds).not.toContain('a');
    expect(seeds.filter((s) => s === 'audyt seo')).toHaveLength(1);
    expect(seeds.length).toBeLessThanOrEqual(12);
  });

  it('returns nothing when there is no such section, so the caller keeps its own fallback', () => {
    expect(seedsFromBrandKnowledge('Business Type\nAgencja digital.')).toEqual([]);
    expect(seedsFromBrandKnowledge('')).toEqual([]);
  });

  it('ignores a section the model left empty or filled with a "brak danych" note', () => {
    expect(seedsFromBrandKnowledge('Topics to cover\n\nCompetitors\nagencje')).toEqual([]);
    expect(seedsFromBrandKnowledge('Topics to cover\nBrak informacji w treści strony.')).toEqual([]);
  });
});
