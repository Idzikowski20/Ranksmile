// Local sequelize-chain mock (mirror __tests__/utils/verifyDomainOwnership.test.ts) — NEVER touch global jest infra.
jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../lib/articleSql', () => ({ getArticleIdSql: jest.fn(async () => 'id') }));
jest.mock('../../lib/articleTerms', () => ({ readArticleTerms: jest.fn(async () => []) }));
jest.mock('../../lib/contentSettings', () => ({ readContentSettings: jest.fn(async () => ({ brandName: '', brandKnowledge: '', voices: [] })) }));
jest.mock('../../lib/domainVoices', () => ({ getDomainVoices: jest.fn(async () => []) }));

import db from '../../database/database';
import { buildArticleContext } from '../../lib/articleContext';
import { readArticleTerms } from '../../lib/articleTerms';
import { readContentSettings } from '../../lib/contentSettings';
import { getDomainVoices } from '../../lib/domainVoices';

const mockQuery = (db as unknown as { query: jest.Mock }).query;

describe('buildArticleContext — core fields', () => {
  beforeEach(() => mockQuery.mockReset());

  it('assembles keyword/scoreData/coverage/paa from the article row; sparse when columns null', async () => {
    // 1st query = article row (Task 5 reads this). Return a minimal row.
    mockQuery.mockResolvedValueOnce([[{
      id: 1, target_keyword: 'react hooks', language: 'en',
      score_data: JSON.stringify({ terms: [], paa_questions: ['What are hooks?'] }),
      ai_info_to_cover: null,        // un-analyzed -> coverage null
    }]]);
    // subsequent queries (terms/competitors in Task 6) — default empty
    mockQuery.mockResolvedValue([[]]);

    const ctx = await buildArticleContext(1);
    expect(ctx.articleId).toBe(1);
    expect(ctx.keyword).toBe('react hooks');
    expect(ctx.language).toBe('en');
    expect(ctx.contentType).toBeUndefined(); // no content_type column on articles yet
    expect(ctx.paa).toEqual(['What are hooks?']);
    expect(ctx.coverage).toBeNull();           // parseSnapshot(null) -> null
  });

  it('does not throw when the article row is missing', async () => {
    mockQuery.mockResolvedValue([[]]); // no row
    const ctx = await buildArticleContext(999);
    expect(ctx.articleId).toBe(999);
    expect(ctx.keyword).toBe('');
    expect(ctx.coverage).toBeNull();
    expect(ctx.paa).toEqual([]);
  });
});

describe('buildArticleContext — knowledge + brand inputs', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    (readArticleTerms as jest.Mock).mockReset();
    (readContentSettings as jest.Mock).mockReset();
    (getDomainVoices as jest.Mock).mockReset();
  });

  it('populates terms (via readArticleTerms) and competitors (from article_competitors rows)', async () => {
    (readArticleTerms as jest.Mock).mockResolvedValueOnce([
      { term: 'hooks', term_type: 'topic', source: 'serp', importance: 3, target_min: 2, target_max: 4, current_count: 1 },
    ]);
    (readContentSettings as jest.Mock).mockResolvedValueOnce({ brandName: '', brandKnowledge: '', voices: [] });
    (getDomainVoices as jest.Mock).mockResolvedValueOnce([]);
    // 1st query = article row.
    mockQuery.mockResolvedValueOnce([[{ id: 1, target_keyword: 'k', score_data: null, ai_info_to_cover: null, domain_id: 7 }]]);
    // 2nd query = article_competitors rows.
    mockQuery.mockResolvedValueOnce([[{ domain: 'a.com', url: 'https://a.com/x', title: 'A', headings_json: JSON.stringify(['H1', 'H2']), terms_json: JSON.stringify(['t1', 't2', 't3']) }]]);

    const ctx = await buildArticleContext(1);
    expect(ctx.terms).toHaveLength(1);
    expect(ctx.terms[0].term).toBe('hooks');
    expect(ctx.competitors[0].domain).toBe('a.com');
    expect(ctx.competitors[0].headings).toEqual(['H1', 'H2']);
    expect(ctx.competitors[0].termsCount).toBe(3);
  });

  it('populates brandKnowledge/voiceTone from readContentSettings + getDomainVoices (default voice)', async () => {
    (readArticleTerms as jest.Mock).mockResolvedValueOnce([]);
    (readContentSettings as jest.Mock).mockResolvedValueOnce({ brandName: 'Acme', brandKnowledge: 'We sell widgets.', voices: [] });
    (getDomainVoices as jest.Mock).mockResolvedValueOnce([
      { id: 'v1', name: 'Casual', description: 'friendly and light', isDefault: false },
      { id: 'v2', name: 'Formal', description: 'precise and professional', isDefault: true },
    ]);
    mockQuery.mockResolvedValueOnce([[{ id: 2, target_keyword: 'k', score_data: null, ai_info_to_cover: null, domain_id: 7 }]]);
    mockQuery.mockResolvedValueOnce([[]]); // competitors

    const ctx = await buildArticleContext(2);
    expect(ctx.brandKnowledge).toBe('We sell widgets.');
    expect(ctx.voiceTone).toBe('precise and professional');
    expect(getDomainVoices as jest.Mock).toHaveBeenCalledWith(7);
  });

  it('never throws when brand/voice reads fail; leaves fields undefined', async () => {
    (readArticleTerms as jest.Mock).mockResolvedValueOnce([]);
    (readContentSettings as jest.Mock).mockRejectedValueOnce(new Error('fs error'));
    (getDomainVoices as jest.Mock).mockRejectedValueOnce(new Error('db error'));
    mockQuery.mockResolvedValueOnce([[{ id: 3, target_keyword: 'k', score_data: null, ai_info_to_cover: null, domain_id: 7 }]]);
    mockQuery.mockResolvedValueOnce([[]]); // competitors

    const ctx = await buildArticleContext(3);
    expect(ctx.brandKnowledge).toBeUndefined();
    expect(ctx.voiceTone).toBeUndefined();
    expect(ctx.customRules).toBeUndefined();
  });
});
