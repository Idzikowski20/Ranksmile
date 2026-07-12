import {
  buildGoogleRankingSources,
  buildAiRankingSources,
  buildRankingSourcesPayload,
  parseRankingSources,
} from '../../lib/rankingSources';
import type { AiVisibilitySummary } from '../../lib/aiSearchScore';

describe('rankingSources', () => {
  it('builds google sources from SERP competitors', () => {
    const google = buildGoogleRankingSources([
      { url: 'https://example.com/a', domain: 'example.com', title: 'A', snippet: '', serp_position: 3 },
    ]);
    expect(google).toEqual([
      { rank: 3, domain: 'example.com', url: 'https://example.com/a', title: 'A' },
    ]);
  });

  it('builds ai sources from visibility summary citations', () => {
    const summary: AiVisibilitySummary = {
      prompts_total: 2,
      prompts_cited: 1,
      competitor_citations: 0,
      extractability_score: 0,
      citations: [
        {
          prompt: 'How to check if someone follows you',
          cited_url: 'https://prodetektyw.pl/page',
          cited_domain: 'prodetektyw.pl',
          answer_readiness_score: 80,
        },
      ],
    };
    expect(buildAiRankingSources(summary)).toEqual([
      {
        domain: 'prodetektyw.pl',
        url: 'https://prodetektyw.pl/page',
        title: 'How to check if someone follows you',
      },
    ]);
  });

  it('parses stored JSON payload', () => {
    const payload = buildRankingSourcesPayload({
      competitors: [{ url: 'https://x.com', domain: 'x.com', title: 'X', snippet: '' }],
    });
    expect(parseRankingSources(JSON.stringify(payload)).google).toHaveLength(1);
  });
});
