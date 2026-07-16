import {
   aiExtractabilityScore,
   buildEffortChecklist,
   computePortfolioPruning,
   computeTopicalCohesion,
   earlyAnswerScore,
   heuristicContentEffort,
   keywordStuffingScore,
   thinOriginalityScore,
   titleQueryScore,
} from '../../lib/contentEffort';
import { collectScoreSlots, computeContentScoreBreakdown, type ScoreData } from '../../lib/contentScore';

const baseScoreData = (): ScoreData => ({
   terms: [{ term: 'seo', target_count: 2 }],
   words_target: 500,
   words_min: 300,
   words_max: 800,
   headings_target: 5,
   headings_min: 3,
   headings_max: 8,
   paa_questions: ['What is seo?', 'How does seo work?'],
});

describe('contentEffort — stuffing', () => {
   it('penalizes extreme keyword density', () => {
      const kw = 'pozycjonowanie stron';
      const natural = [
         'Pozycjonowanie stron pomaga firmom zdobywać klientów z wyszukiwarki.',
         ...Array.from({ length: 40 }, (_, i) => `Akapit ${i} o marketingu treści, UX i analityce bez powtórzeń frazy kluczowej.`),
      ].join(' ');
      const stuffed = `${kw} ${kw} ${kw} `.repeat(40)
         + Array.from({ length: 20 }, (_, i) => `wypełniacz ${i}`).join(' ');
      const a = keywordStuffingScore(natural, kw);
      const b = keywordStuffingScore(stuffed, kw);
      expect(a.earned).toBeGreaterThan(b.earned);
      expect(b.earned).toBeLessThanOrEqual(2);
      expect(a.earned).toBeGreaterThanOrEqual(5);
   });
});

describe('contentEffort — early answer', () => {
   it('rewards keyword + answer in the lead / first HTML budget', () => {
      const kw = 'content effort';
      const goodHtml = `<article><p>${'Content effort measures how hard a page is to replicate. '.repeat(8)}</p></article>`;
      const lateHtml = `<nav>${'<a href="#">x</a>'.repeat(40)}</nav><p>${'filler '.repeat(200)} content effort finally appears.</p>`;
      const good = earlyAnswerScore(goodHtml, goodHtml.replace(/<[^>]+>/g, ' '), kw);
      const late = earlyAnswerScore(lateHtml, lateHtml.replace(/<[^>]+>/g, ' '), kw);
      expect(good.earned).toBeGreaterThanOrEqual(6);
      expect(good.earned).toBeGreaterThan(late.earned);
   });
});

describe('contentEffort — title query', () => {
   it('rewards early keyword without hard 50–60 char ranking', () => {
      const short = titleQueryScore('<title>SEO guide for startups in 2026</title>', 'SEO guide');
      const late = titleQueryScore('<title>Everything you need to know about the market — SEO guide</title>', 'SEO guide');
      expect(short).not.toBeNull();
      expect(late).not.toBeNull();
      expect((short as number)).toBeGreaterThanOrEqual(late as number);
      // Soft length: very long titles still get keyword points
      const long = titleQueryScore(`<title>${'SEO guide — '} ${'x'.repeat(100)}</title>`, 'SEO guide');
      expect(long).toBeGreaterThanOrEqual(3);
   });
});

describe('contentEffort — thin originality', () => {
   it('scores thin/generic text lower than diverse long text', () => {
      const thin = thinOriginalityScore('In this article we discuss things. In this article we discuss things. '.repeat(5));
      const rich = thinOriginalityScore(
         'We tested 120 client sites in Q1. Our survey (n=48) showed 37% lift after pruning thin posts. '
         + 'First-person notes from the audit: tables of crawl errors, custom diagrams, and unique case data. '
         + Array.from({ length: 80 }, (_, i) => `detail${i} unique`).join(' '),
      );
      expect(rich.earned).toBeGreaterThan(thin.earned);
   });
});

describe('contentEffort — AI extractability', () => {
   it('rewards lists, descriptive alts, and findable PAA terms', () => {
      const html = `
         <p>SEO is a set of practices.</p>
         <ul><li>one</li><li>two</li><li>three</li></ul>
         <img src="/a.png" alt="Annotated diagram of crawl budget allocation" />
         <p>What is seo? How does seo work? Details follow with definitions.</p>
      `;
      const plain = html.replace(/<[^>]+>/g, ' ');
      const score = aiExtractabilityScore(html, plain, ['What is seo?', 'How does seo work?']);
      expect(score.earned).toBeGreaterThanOrEqual(5);
   });
});

describe('contentEffort — checklist + heuristic', () => {
   it('builds five effort signals', () => {
      const items = buildEffortChecklist({
         plainText: 'We found in our data that 42% improved. I tested this myself.',
         html: '<p>Lead answer here.</p><img alt="Custom chart of conversion rates by cohort" src="x.png" />',
         keyword: 'conversion rates',
         uniqueVsSerp: { covered: 3, total: 4 },
      });
      expect(items).toHaveLength(5);
      expect(items.map((i) => i.key)).toEqual([
         'original_data', 'custom_multimedia', 'info_gain', 'first_person', 'lead_completeness',
      ]);
      const h = heuristicContentEffort({
         plainText: items[0].detail,
         html: '',
         keyword: 'x',
      });
      expect(h.score).toBeGreaterThanOrEqual(0);
      expect(h.reasons.length).toBeLessThanOrEqual(3);
   });
});

describe('contentScore — effort slots in breakdown', () => {
   it('exposes stuffing, earlyAnswer, originality, aiExtract, datesAuthor in gaps', () => {
      const html = '<title>seo basics</title><h1>seo</h1><p>seo seo seo seo seo. '.repeat(30) + '</p>';
      const plain = html.replace(/<[^>]+>/g, ' ');
      const { slots } = computeContentScoreBreakdown(plain, 200, 2, baseScoreData(), 3, html, 'seo');
      const keys = slots.map((s) => s.key);
      expect(keys).toEqual(expect.arrayContaining([
         'stuffing', 'earlyAnswer', 'originality', 'aiExtract', 'datesAuthor',
      ]));
      const stuffing = slots.find((s) => s.key === 'stuffing');
      expect(stuffing && stuffing.missingPoints).toBeGreaterThan(0);
   });

   it('title slot hint avoids hard 50–60 char ranking copy', () => {
      const html = '<title>seo guide for teams</title><h1>seo</h1><p>seo is useful for teams building content.</p>';
      const slots = collectScoreSlots(html.replace(/<[^>]+>/g, ' '), 50, 1, baseScoreData(), 1, html, 'seo');
      const title = slots.find((s) => s.key === 'title');
      expect(title?.hint).not.toMatch(/50–60/);
      expect(title?.hint.toLowerCase()).toMatch(/start|near/);
   });
});

describe('contentEffort — topical cohesion', () => {
   it('tighter clusters → higher focus / lower radius', () => {
      const focused = computeTopicalCohesion([
         { ideas: [1, 2, 3, 4, 5, 6, 7, 8] },
         { ideas: [1] },
      ]);
      const diffuse = computeTopicalCohesion([
         { ideas: [1, 2] },
         { ideas: [1, 2] },
         { ideas: [1, 2] },
         { ideas: [1, 2] },
      ]);
      expect(focused.siteFocusScore).toBeGreaterThan(diffuse.siteFocusScore);
      expect(diffuse.siteRadius).toBeGreaterThan(focused.siteRadius);
   });
});

describe('contentEffort — portfolio pruning', () => {
   it('flags low-score zero-traffic pages as prune candidates', () => {
      const insight = computePortfolioPruning([
         { id: 1, title: 'Thin A', url: '/a', content_score: 20, clicks: 0, impressions: 10 },
         { id: 2, title: 'Good B', url: '/b', content_score: 85, clicks: 40, impressions: 900 },
         { id: 3, title: 'Mediocre C', url: '/c', content_score: 48, clicks: 0, impressions: 20 },
      ]);
      expect(insight.pruneCandidates.some((c) => c.id === 1 && c.severity === 'high')).toBe(true);
      expect(insight.pruneCandidates.some((c) => c.id === 2)).toBe(false);
   });
});
