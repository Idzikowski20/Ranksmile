import { canonicalizeClaims } from '@/src/infrastructure/knowledgeEngine/canonicalize';

// VAGUE is the shorter of the two, so the old "keep the shortest member" rule picks it.
const VAGUE = 'Zakres usług detektywistycznych jest bardzo szeroki.';
const SPECIFIC = 'Zakres usług detektywistycznych obejmuje 12 kategorii spraw opisanych w ustawie.';

// The production hash embedder scores true paraphrases around 0.42 — far under
// CANONICALIZE_SIM_MIN — so with the real provider nothing clusters and this test would
// exercise nothing. Clustering recall is a separate defect; stub it out to isolate which
// member of a cluster wins.
const alwaysSimilar = { id: 'test-always-similar', embed: () => [1, 0] };

describe('canonicalizeClaims statement choice', () => {
  it('keeps the paraphrase that carries the figures, not the shortest one', async () => {
    const claims = await canonicalizeClaims(
      [
        { text: SPECIFIC, url: 'https://a.pl', kind: 'competitor' },
        { text: VAGUE, url: 'https://b.pl', kind: 'competitor' },
      ],
      { provider: alwaysSimilar },
    );

    const merged = claims.find((c) => c.evidence.length === 2);
    expect(merged).toBeDefined();
    // The old rule kept whichever member was shorter, so the paraphrase that dropped the
    // numbers won — article 15 shipped 98 claims carrying three digits between them.
    expect(merged?.statement).toBe(SPECIFIC);
  });
});
