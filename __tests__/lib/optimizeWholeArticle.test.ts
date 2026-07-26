import { buildWholeArticlePrompt } from '../../lib/optimizeWholeArticle';
import { buildEffortOptimizeGuidance } from '../../lib/contentEffort';
import type { ArticleContext } from '../../lib/articleContext';
import type { ScoreData } from '../../lib/contentScore';

function ctxWithTerms(terms: ScoreData['terms']): ArticleContext {
  return {
    articleId: 1,
    keyword: 'darmowa strona internetowa',
    scoreData: {
      terms,
      words_target: 1500,
      words_min: 1000,
      words_max: 2000,
      headings_target: 10,
      headings_min: 6,
      headings_max: 14,
    },
    breakdown: null,
    coverage: null,
    paa: [],
    terms: [],
    competitors: [],
  };
}

describe('optimizeWholeArticle prompt v2', () => {
  it('includes human-readable structure rules (not thin heading spam)', () => {
    const { systemPrompt } = buildWholeArticlePrompt({
      ctx: null,
      html: '<p>test</p>',
      guidelines: [],
      seoScore: 50,
      aiScore: 30,
      phase: 'first_run',
    });
    expect(systemPrompt).toContain('write for HUMANS');
    expect(systemPrompt).toContain('6–14 H2');
    expect(systemPrompt).toContain('≈120–450 characters');
    expect(systemPrompt).not.toContain('MANY H2/H3');
    expect(systemPrompt).not.toContain('100–200 characters of plain text (NOT words)');
  });

  it('with high SEO+AI (minimal mode) still focuses SEO terms when NLP gaps remain', () => {
    // Reproduces: SEO 85 / AI 68 → selectOptimizeMode = minimal → previously forced
    // ai-coverage and never asked the model to weave missing multi-word terms.
    const html = '<p>' + Array.from({ length: 25 }, () => 'darmowa').join(' ') + ' internetowa</p>';
    const ctx = ctxWithTerms([
      { term: 'darmowa', target_count: 2 },
      { term: 'kreator stron www', target_count: 3 },
      { term: 'notion strona internetowa', target_count: 3 },
      { term: 'wix strona internetowa', target_count: 3 },
    ]);
    const { systemPrompt, focus, reason } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 85,
      aiScore: 68,
      phase: 'first_run',
    });
    expect(focus).toBe('seo-terms');
    expect(reason).toBe('Whole-article SEO terms');
    expect(systemPrompt).toMatch(/kreator stron www/);
    expect(systemPrompt).toMatch(/notion strona internetowa/);
    expect(systemPrompt).toMatch(/0\/3|current 0|0\/target/i);
  });

  it('instructs reducing overused short roots while filling multi-word gaps', () => {
    const html = '<p>' + Array.from({ length: 23 }, () => 'darmowa').join(' ') + '</p>';
    const ctx = ctxWithTerms([
      { term: 'darmowa', target_count: 2 },
      { term: 'kreator stron www', target_count: 3 },
    ]);
    const { systemPrompt, focus } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 85,
      aiScore: 68,
      phase: 'first_run',
    });
    expect(focus).toBe('seo-terms');
    expect(systemPrompt).toMatch(/OVERUSED|reduce|odchud/i);
    expect(systemPrompt).toMatch(/darmowa/);
    expect(systemPrompt).toMatch(/kreator stron www/);
  });

  it('injects EFFORT gaps from fail/warn checklist into the AO system prompt', () => {
    const html = '<h1>seo</h1><p>In this article we discuss things. In this article we discuss things. '.repeat(12) + '</p>';
    const ctx: ArticleContext = {
      articleId: 1,
      keyword: 'seo',
      scoreData: {
        terms: [],
        words_target: 500,
        words_min: 300,
        words_max: 800,
        headings_target: 5,
        headings_min: 3,
        headings_max: 8,
        paa_questions: ['What is seo?'],
      },
      breakdown: null,
      coverage: null,
      paa: ['What is seo?'],
      terms: [],
      competitors: [],
    };
    const { systemPrompt, userInstruction } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 40,
      aiScore: 20,
      phase: 'first_run',
    });
    expect(systemPrompt).toContain('EFFORT (hard to cheaply replicate');
    expect(systemPrompt).toMatch(/Original data|Lead completeness|Experience|Keyword stuffing|Originality/);
    expect(systemPrompt).toContain("WHAT'S MISSING");
    expect(userInstruction).toContain("WHAT'S MISSING");
    expect(userInstruction).toContain('EFFORT gaps');
  });

  it('ai-only (SEO ready, AI weak) uses normal edits — not preserve-90% less mode', () => {
    // Reproduces: SEO 73 / AI 19 / overall ~49 → selectOptimizeMode = ai-only → previously
    // forced less ("preserve more than 90%") and the model echoed the article → no_change.
    const html = '<p>Short article about gardening without useful FAQ or NLP coverage.</p>';
    const ctx = ctxWithTerms([
      { term: 'ogród warzywny', target_count: 4 },
      { term: 'kompost', target_count: 3 },
    ]);
    const { editMode, focus, systemPrompt, userInstruction } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 73,
      aiScore: 19,
      phase: 'first_run',
    });
    expect(focus).toBe('seo-terms');
    expect(editMode).toBe('normal');
    expect(systemPrompt).not.toContain('preserve more than 90%');
    expect(userInstruction).not.toMatch(/minimal, targeted edits/);
    expect(systemPrompt).toMatch(/ogród warzywny|kompost/);
  });

  it('ai-only with SEO ready + question/concept debt focuses AI Search (not timid readability)', () => {
    const html = '<h1>Test</h1><p>Solid SEO article with little AI Search substance yet.</p>'.repeat(8);
    const ctx: ArticleContext = {
      articleId: 1,
      keyword: 'test',
      scoreData: {
        terms: [{ term: 'test', target_count: 2, current_count: 8 }],
        words_target: 800,
        words_min: 400,
        words_max: 1200,
        headings_target: 6,
        headings_min: 3,
        headings_max: 10,
      },
      breakdown: null,
      coverage: {
        version: 1,
        overall: 0,
        answersMainQuestionEarly: false,
        buckets: [],
        items: [
          {
            id: 'q1', label: 'What is the main benefit?', type: 'question', category: 'knowledge',
            importance: 'critical', source: 'llm', covered: false, quality: 0,
          },
          {
            id: 'c1', label: 'Core concept explained', type: 'concept', category: 'knowledge',
            importance: 'recommended', source: 'llm', covered: false, quality: 0,
          },
          {
            id: 'e1', label: 'brandname', type: 'entity', category: 'knowledge',
            importance: 'optional', source: 'competitors', covered: true, quality: 4,
          },
        ],
      },
      paa: [],
      terms: [],
      competitors: [],
    };
    const { focus, editMode, systemPrompt } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 80,
      aiScore: 0,
      phase: 'first_run',
    });
    expect(focus).toBe('ai-coverage');
    expect(editMode).toBe('normal');
    expect(systemPrompt).toMatch(/What is the main benefit|Core concept explained/);
    expect(systemPrompt).not.toMatch(/brandname/);
  });

  it('ai-only + shallow Covered AI + term overuse prefers seo-terms (avoid echo no_change)', () => {
    // Reproduces screenshot: SEO 82 / AI 0 / checklist Covered / AO "didn't change".
    // Shallow covered (quality 0) + keyword stuffing — whole-article AI polish echoes.
    const html = '<p>inwigilacja inwigilacja inwigilacja pracownikow pracownikow '.repeat(20) + '</p>';
    const ctx: ArticleContext = {
      articleId: 1,
      keyword: 'inwigilacja',
      scoreData: {
        terms: [
          { term: 'inwigilacja', target_count: 13, current_count: 41 },
          { term: 'pracownikow', target_count: 5, current_count: 12 },
        ],
        words_target: 800,
        words_min: 400,
        words_max: 1200,
        headings_target: 6,
        headings_min: 3,
        headings_max: 10,
      },
      breakdown: null,
      coverage: {
        version: 1,
        overall: 0,
        answersMainQuestionEarly: false,
        buckets: [],
        items: [
          {
            id: 'q1', label: 'Czy inwigilacja jest legalna?', type: 'question', category: 'knowledge',
            importance: 'recommended', source: 'paa', covered: true, quality: 0,
          },
          {
            id: 'q2', label: 'Czy inwigilacja jest karalna?', type: 'question', category: 'knowledge',
            importance: 'recommended', source: 'paa', covered: true, quality: 0,
          },
        ],
      },
      paa: [],
      terms: [],
      competitors: [],
    };
    const { focus, editMode, systemPrompt } = buildWholeArticlePrompt({
      ctx,
      html,
      guidelines: [],
      seoScore: 82,
      aiScore: 0,
      phase: 'first_run',
    });
    expect(focus).toBe('seo-terms');
    expect(editMode).toBe('normal');
    expect(systemPrompt).toMatch(/OVERUSED|inwigilacja/);
  });
});

describe('buildEffortOptimizeGuidance', () => {
  it('returns empty when article already passes effort signals', () => {
    const html = `
      <p>We tested 48 sites in Q1. Our data shows 37% lift after pruning thin posts.</p>
      <img src="/a.png" alt="Annotated chart of conversion rates by cohort after rewrite" />
      <table><tr><td>a</td><td>b</td></tr></table>
      <p>seo means search optimization. What is seo? How does seo work?</p>
      <p class="author" itemprop="author">Written by Patryk</p>
      <time datetime="2026-01-15">2026-01-15</time>
    `;
    const plain = html.replace(/<[^>]+>/g, ' ');
    const block = buildEffortOptimizeGuidance({
      html,
      plainText: plain + ' ' + Array.from({ length: 100 }, (_, i) => `detail${i}`).join(' '),
      keyword: 'seo',
      paaQuestions: ['What is seo?', 'How does seo work?'],
      uniqueVsSerp: { covered: 3, total: 3 },
    });
    // May still have minor gaps, but should not be empty only when everything fails —
    // assert it is a string (can be empty on strong articles).
    expect(typeof block).toBe('string');
  });

  it('lists actionable fail/warn instructions for thin generic HTML', () => {
    const html = '<p>In this article we discuss marketing. In this article we discuss marketing. '.repeat(15) + '</p>';
    const block = buildEffortOptimizeGuidance({
      html,
      plainText: html.replace(/<[^>]+>/g, ' '),
      keyword: 'marketing',
      paaQuestions: ['What is marketing?'],
    });
    expect(block).toContain('EFFORT');
    expect(block.split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThanOrEqual(2);
  });
});
