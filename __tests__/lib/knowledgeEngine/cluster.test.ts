import { buildTopicBlocks } from '../../../lib/knowledgeEngine/cluster';
import type { CanonicalClaim } from '../../../lib/knowledgeEngine/types';
import { getEmbeddingProvider } from '../../../lib/knowledgeEngine/embeddingProvider';

const claim = (id: string, statement: string): CanonicalClaim => ({
  id,
  statement,
  cluster: 'Unassigned',
  importance: 'medium',
  importanceScore: 50,
  consensus: 0.5,
  evidence: [],
  usedByCompetitors: 1,
  competitorsTotal: 5,
  usedInSections: [],
  generatedFrom: ['serp'],
} as unknown as CanonicalClaim);

/** The default hash provider is deterministic — fine for a two-heading fixture. */
const provider = getEmbeddingProvider();

describe('buildTopicBlocks claim assignment', () => {
  /**
   * The matcher required the claim to contain the block title's literal 12-char prefix —
   * competitor headings ("Sprawy cywilne – jak pomaga detektyw") almost never appear
   * verbatim inside a claim, so every claim shipped as cluster "Unassigned" and the
   * fact sheet had nothing to group by.
   */
  it('assigns claims to blocks on shared word stems, not literal prefixes', async () => {
    // Inflected forms, not the title's literal words: "wykrywania"≠"wykrywanie",
    // "podsłuchem"≠"podsłuchów", "obserwacji"≠"obserwacja", "osoby"≠"osób" — so the
    // match rides the stem branch, and each claim shares two title tokens (the ≥2 floor).
    const claims = [
      claim('c1', 'Wykrywania podsłuchem nie wolno prowadzić bez profesjonalnego sprzętu.'),
      claim('c2', 'Obserwacji zlecenia dotyczą także Warszawy oraz najbliższych okolic.'),
    ];

    const blocks = await buildTopicBlocks({
      headings: [
        { text: 'Wykrywanie podsłuchów i lokalizatorów GPS', url: 'https://a.pl', serpPosition: 1 },
        { text: 'Dyskretna obserwacja osób w Warszawie', url: 'https://b.pl', serpPosition: 2 },
      ],
      claims,
      competitorCount: 2,
      provider,
    });

    const byTitle = new Map(blocks.map((b) => [b.title, b.claimIds]));
    expect(byTitle.get('Wykrywanie podsłuchów i lokalizatorów GPS')).toContain('c1');
    expect(byTitle.get('Dyskretna obserwacja osób w Warszawie')).toContain('c2');
    expect(claims[0].cluster).toBe('Wykrywanie podsłuchów i lokalizatorów GPS');
    expect(claims[1].cluster).toBe('Dyskretna obserwacja osób w Warszawie');
  });
});
