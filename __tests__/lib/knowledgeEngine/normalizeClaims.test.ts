// Batched now, so the fall-back path rebuilds the array from its slices: the contract is
// that every claim comes back unchanged, not that it is the very same array object.
import { normalizeClaims } from '../../../lib/knowledgeEngine/normalizeClaims';
import type { CanonicalClaim, ClaimEvidence } from '../../../lib/knowledgeEngine/types';

function evidence(url: string): ClaimEvidence {
  const domain = new URL(url).hostname;
  return {
    kind: 'competitor',
    url,
    domain,
    favicon: `https://icons/${domain}`,
    title: domain,
    weight: 0.75,
    roles: ['serp'],
  };
}

function claim(id: string, statement: string, url: string): CanonicalClaim {
  return {
    id,
    statement,
    cluster: 'Unassigned',
    importance: 'medium',
    importanceScore: 52,
    consensus: 0,
    evidence: [evidence(url)],
    usedByCompetitors: 0,
    competitorsTotal: 0,
    usedInSections: [],
    generatedFrom: ['serp'],
    sourceDiversity: { official: false, competitors: true, aiOverview: false, paa: false, score: 0.25 },
    consensusExplanation: { percent: 0, because: [] },
  };
}

// Four paraphrases of two facts, from four different pages — the real shape of a SERP,
// and exactly what the hash embedder fails to merge (true paraphrases score ~0.42
// against a 0.82 threshold, so every claim reached the planner with one source).
const INPUT: CanonicalClaim[] = [
  claim('c0', 'Obserwacja osób jest jedną z najskuteczniejszych metod detektywistycznych.', 'https://a.pl/x'),
  claim('c1', 'Obserwacja osób to jedna z najbardziej skutecznych metod pracy detektywa.', 'https://b.pl/y'),
  claim('c2', 'Detektyw musi posiadać licencję wydaną przez MSWiA.', 'https://c.pl/z'),
  claim('c3', 'Licencję detektywistyczną wydaje minister spraw wewnętrznych.', 'https://d.pl/w'),
];

const GOOD_REPLY = JSON.stringify({
  facts: [
    {
      statement: 'Obserwacja osób jest jedną z najskuteczniejszych metod detektywistycznych.',
      topic: 'Obserwacja osób',
      from: [0, 1],
    },
    {
      statement: 'Usługi detektywistyczne wymagają licencji wydanej przez MSWiA.',
      topic: 'Wymogi prawne',
      from: [2, 3],
    },
  ],
});

describe('normalizeClaims', () => {
  it('merges paraphrases so a claim carries every source that backs it', async () => {
    const out = await normalizeClaims(INPUT, async () => GOOD_REPLY);

    expect(out).toHaveLength(2);
    const observation = out[0];
    expect(observation.evidence.map((e) => e.domain).sort()).toEqual(['a.pl', 'b.pl']);
    expect(observation.cluster).toBe('Obserwacja osób');
    // 40 + 2 sources x 12 = 64. The input's flat 52 could never separate claims at all.
    expect(observation.importanceScore).toBeGreaterThan(52);
  });

  it('counts one source per URL, not one per merged input claim', async () => {
    const sameUrl = [
      claim('c0', 'Obserwacja osób jest skuteczną metodą detektywistyczną w praktyce.', 'https://a.pl/x'),
      claim('c1', 'Obserwacja osób bywa skuteczną metodą pracy detektywa w praktyce.', 'https://a.pl/x'),
      claim('c2', 'Detektyw musi posiadać licencję wydaną przez MSWiA przed rozpoczęciem pracy.', 'https://c.pl/z'),
    ];
    const out = await normalizeClaims(sameUrl, async () => JSON.stringify({
      facts: [
        { statement: 'Obserwacja osób jest skuteczną metodą detektywistyczną.', topic: 'Obserwacja', from: [0, 1] },
        { statement: 'Usługi detektywistyczne wymagają licencji wydanej przez MSWiA.', topic: 'Prawo', from: [2] },
      ],
    }));

    expect(out[0].evidence).toHaveLength(1);
  });

  it.each([
    ['no completion is injected', undefined],
    ['the reply is not JSON', async () => 'I cannot help with that.'],
    ['the reply is empty', async () => ''],
  ] as const)('keeps the raw claims when %s', async (_label, complete) => {
    expect(await normalizeClaims(INPUT, complete)).toEqual(INPUT);
  });

  it('keeps the raw claims when the reply covers too little of the input', async () => {
    // One fact out of four inputs reads as a truncated reply, not as the model judging
    // the other three worthless — dropping them would gut the graph silently.
    const thin = JSON.stringify({
      facts: [{ statement: 'Obserwacja osób jest skuteczną metodą detektywistyczną.', topic: 'Obserwacja', from: [0] }],
    });
    expect(await normalizeClaims(INPUT, async () => thin)).toEqual(INPUT);
  });

  it('drops facts that point at no input claim', async () => {
    const invented = JSON.stringify({
      facts: [
        { statement: 'Obserwacja osób jest jedną z najskuteczniejszych metod.', topic: 'Obserwacja', from: [0, 1] },
        { statement: 'Detektywi rozwiązują 98% spraw w pierwszym tygodniu pracy.', topic: 'Skuteczność', from: [] },
        { statement: 'Usługi detektywistyczne wymagają licencji wydanej przez MSWiA.', topic: 'Prawo', from: [2, 3] },
      ],
    });
    const out = await normalizeClaims(INPUT, async () => invented);

    expect(out.map((c) => c.statement)).not.toContain('Detektywi rozwiązują 98% spraw w pierwszym tygodniu pracy.');
    expect(out).toHaveLength(2);
  });

  it('survives a completion that throws', async () => {
    const out = await normalizeClaims(INPUT, async () => {
      throw new Error('provider down');
    });
    expect(out).toEqual(INPUT);
  });
});

/**
 * Article 18's 61 claims went into one request against a 3000-token reply budget. The
 * truncated reply covered under half the input, the coverage guard discarded EVERY
 * rewrite, and the graph shipped raw competitor prose with page titles as topics — after
 * paying for 23 seconds of model time.
 */
describe('normalizeClaims batching', () => {
  const BATCH = 30;

  function manyClaims(n: number): CanonicalClaim[] {
    return Array.from({ length: n }, (_, i) => claim(
      `c${i}`,
      `Detektyw wykonuje czynnosc numer ${i} zgodnie z obowiazujacymi przepisami prawa.`,
      `https://s${i % 4}.pl/x`,
    ));
  }

  /** Rewrites every claim the prompt listed, echoing its index back in `from`. */
  function replyFor(prompt: string): string {
    const asked = [...prompt.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    return JSON.stringify({
      facts: asked.map((n) => ({
        statement: `Znormalizowany fakt numer ${n} o pracy detektywa w Warszawie.`,
        topic: 'Zakres uslug',
        from: [n],
      })),
    });
  }

  it('splits a large graph across several calls instead of one oversized reply', async () => {
    const prompts: string[] = [];
    const out = await normalizeClaims(manyClaims(61), async (p) => { prompts.push(p); return replyFor(p); });

    expect(prompts).toHaveLength(Math.ceil(61 / BATCH));
    expect(out).toHaveLength(61);
    expect(out.every((c) => c.statement.startsWith('Znormalizowany'))).toBe(true);
  });

  it('loses only the failing batch, not every rewrite', async () => {
    const input = manyClaims(61);
    // The first batch comes back truncated; the rest are fine.
    let seen = 0;
    const out = await normalizeClaims(input, async (p) => {
      seen += 1;
      return seen === 1 ? JSON.stringify({ facts: [] }) : replyFor(p);
    });

    const raw = out.filter((c) => c.statement.startsWith('Detektyw wykonuje'));
    const rewritten = out.filter((c) => c.statement.startsWith('Znormalizowany'));

    expect(raw).toHaveLength(BATCH);
    expect(rewritten).toHaveLength(61 - BATCH);
  });
});
