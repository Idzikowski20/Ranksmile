import {
  resolveAoWorkOutcome,
  aoOutcomeUserMessage,
  type AoRunOutcomeKind,
} from '../../../lib/ao/aoRunOutcome';

describe('aoRunOutcome', () => {
  it('classifies faq_only when body untouched and SEO gaps remain', () => {
    const outcome = resolveAoWorkOutcome({
      bodyAccepted: 0,
      faqAccepted: true,
      seoEntityGapsBefore: 4,
      seoEntityGapsAfter: 4,
    });
    expect(outcome).toBe('faq_only');
    expect(aoOutcomeUserMessage(outcome)).toMatch(/incomplete/i);
  });

  it('classifies fully_optimized when body accepted and SEO improved', () => {
    expect(
      resolveAoWorkOutcome({
        bodyAccepted: 2,
        faqAccepted: true,
        seoEntityGapsBefore: 4,
        seoEntityGapsAfter: 1,
      }),
    ).toBe('fully_optimized');
  });

  it('classifies partial_body when body accepted but SEO gaps remain', () => {
    expect(
      resolveAoWorkOutcome({
        bodyAccepted: 1,
        faqAccepted: false,
        seoEntityGapsBefore: 3,
        seoEntityGapsAfter: 3,
      }),
    ).toBe('partial_body');
  });

  const kinds: AoRunOutcomeKind[] = ['faq_only', 'partial_body', 'fully_optimized'];
  it('has user messages for key outcomes', () => {
    for (const k of kinds) {
      expect(aoOutcomeUserMessage(k).length).toBeGreaterThan(10);
    }
  });
});
