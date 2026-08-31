import { buildTargetKnowledgeGraph } from '@/src/core/domain/contentPlanner/knowledgeIntelligence';
import type { CompetitorProfile } from '@/src/core/domain/contentPlanner/types';

function profile(url: string, claims: string[]): CompetitorProfile {
  return {
    url, domain: new URL(url).hostname, title: 't', headings: [],
    claims, questions: [], entities: [], wordCount: 1000,
  } as unknown as CompetitorProfile;
}

/** Surfer writes from engine-cited facts, not scraped prose — the pool must reflect that. */
describe('buildTargetKnowledgeGraph — AI facts lead the pool', () => {
  const aiClaims = Array.from({ length: 5 }, (_, i) =>
    `Szantaż emocjonalny wykorzystuje mechanizm numer ${i} oparty na poczuciu winy.`);
  const scraped = Array.from({ length: 60 }, (_, i) =>
    `Konkurencyjne zdanie numer ${i} o manipulacji emocjonalnej w relacjach bliskich.`);

  const kg = buildTargetKnowledgeGraph({
    profiles: [profile('https://a.pl/x', scraped.slice(0, 30)), profile('https://b.pl/y', scraped.slice(30))],
    ai: { claims: aiClaims, sources: [{ url: 'https://pl.wikipedia.org/w', confidence: 0.85 }] },
  });

  it('caps the pool at a Surfer-sized budget', () => {
    expect(kg.claims.length).toBeLessThanOrEqual(40);
  });

  it('never cuts an AI-engine fact to make room for scraped prose', () => {
    for (const c of aiClaims) {
      expect(kg.claims.some((k) => k.statement === c)).toBe(true);
    }
  });

  it('keeps the AI phrasing when both routes carry the same statement', () => {
    const shared = 'Ofiary szantażu doświadczają silnego stresu.';
    const kg2 = buildTargetKnowledgeGraph({
      profiles: [profile('https://a.pl/x', [shared.toUpperCase()])],
      ai: { claims: [shared] },
    });
    // Same statement normalises to one key; exact-case survivor must be the AI one.
    const hit = kg2.claims.find((k) => k.statement.toLowerCase() === shared.toLowerCase());
    expect(hit?.statement).toBe(shared);
  });
});
