import { pickTermsForGeneratedArticle } from '../../lib/pickArticleTerms';
import type { NlpTerm } from '../../lib/contentScore';

describe('pickTermsForGeneratedArticle', () => {
  const rich: NlpTerm[] = Array.from({ length: 20 }, (_, i) => ({
    term: `detektyw warszawa oferta ${i + 1}`,
    target_count: 2,
  }));

  const thin: NlpTerm[] = [
    { term: 'detektyw warszawa', target_count: 3 },
    { term: 'detektyw', target_count: 2 },
    { term: 'warszawa', target_count: 2 },
  ];

  it('keeps enriched deep-analysis terms when sidecar returns PK splits', () => {
    const picked = pickTermsForGeneratedArticle(rich, thin, 'detektyw warszawa');
    expect(picked.length).toBeGreaterThanOrEqual(20);
    expect(picked.some((t) => t.term.includes('oferta'))).toBe(true);
  });

  it('uses sidecar terms when they are already rich', () => {
    const picked = pickTermsForGeneratedArticle(thin, rich, 'detektyw warszawa');
    expect(picked.length).toBeGreaterThanOrEqual(20);
  });
});
