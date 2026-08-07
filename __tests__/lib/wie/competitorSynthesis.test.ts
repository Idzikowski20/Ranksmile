import {
  formatCompetitorSynthesisForPrompt,
  heuristicCompetitorSynthesis,
  parseCompetitorSynthesis,
} from '../../../lib/wie/competitorSynthesis';
import { evaluateRxQualityGate } from '../../../lib/wie/rxQualityGate';
import { buildHeuristicReaderBrief, formatReaderBriefForPrompt } from '../../../lib/wie/readerBrief';
import { buildPrecisionEditPlan, buildPrecisionStepPrompt } from '../../../lib/ao/editPlan';
import { makeCandidate } from '../../../lib/ao/editCandidate';
import { buildIntentProfile } from '../../../lib/ao/intentProfile';

describe('WIE competitorSynthesis', () => {
  it('parses valid synthesis and rejects empty', () => {
    expect(parseCompetitorSynthesis(null)).toBeNull();
    expect(parseCompetitorSynthesis({ critical: [], important: [], examples: [] })).toBeNull();
    const ok = parseCompetitorSynthesis({
      critical: ['Explain art. 191'],
      important: ['Do not pay'],
      optional: [],
      opening_style: { problem_first: true, emotion: 'high' },
      section_patterns: ['problem', 'solution'],
      expert_claims: ['W praktyce sprawcy wracają'],
      storytelling: [],
      examples: ['Messenger', 'Bitcoin'],
      cta: { tone: 'soft' },
      faq: {},
      information_gain: ['Repeat demands are common'],
    });
    expect(ok).not.toBeNull();
    expect(ok?.critical[0]).toContain('191');
    expect(ok?.examples).toContain('Messenger');
  });

  it('heuristic synthesis from corpus prefers problem-first for fear keywords', () => {
    const s = heuristicCompetitorSynthesis({
      keyword: 'szantaż co robić',
      corpusTexts: [
        'Padłeś ofiarą szantażu? Nie płać. Sprawcy na Messenger często wracają po kolejne pieniądze. Zgłoś sprawę na policję.',
        'W praktyce Bitcoin bywa środkiem płatności. Zabezpiecz dowody i nie dogaduj się ze sprawcą.',
      ],
    });
    expect(s.opening_style.problem_first).toBe(true);
    expect(s.examples.length).toBeGreaterThan(0);
    const block = formatCompetitorSynthesisForPrompt(s);
    expect(block).toContain('COMPETITOR SYNTHESIS');
    expect(block.length).toBeLessThanOrEqual(1000);
  });

  /**
   * This fallback is the planner's floor whenever the synthesis LLM is unreachable, and
   * the Plan Validator refuses a blueprint under five claims. Capping `critical` at four
   * made that gate unreachable by construction: every fallback run 422'd on
   * "targetClaims below minimum 5" no matter how rich the corpus was.
   */
  it('yields enough claims for the five-claim plan gate', () => {
    const corpus = Array.from(
      { length: 12 },
      (_, i) => `Uslugi detektywistyczne w wariancie ${i} kosztuja okolo ${(i + 1) * 100} zlotych netto.`,
    ).join(' ');

    const s = heuristicCompetitorSynthesis({ keyword: 'detektyw', corpusTexts: [corpus] });

    expect(s.critical.length).toBeGreaterThanOrEqual(5);
  });

  /** Information gain used to be `expert.slice(0, 2)`, so no expert phrasing meant none. */
  it('derives information gain from figures, not from expert phrasing', () => {
    const corpus = 'Audyt zajmuje zwykle 14 dni roboczych od podpisania umowy. '
      + 'Raport obejmuje ponad 40 sprawdzanych czynnikow technicznych na stronie. '
      + 'Klient otrzymuje liste rekomendacji uporzadkowana wedlug priorytetu wdrozenia.';

    const s = heuristicCompetitorSynthesis({ keyword: 'audyt seo', corpusTexts: [corpus] });

    expect(s.expert_claims).toHaveLength(0);
    expect(s.information_gain.length).toBeGreaterThan(0);
  });

  it('does not promote cookie banners to critical insights', () => {
    const s = heuristicCompetitorSynthesis({
      keyword: 'detektyw',
      corpusTexts: [
        'This website uses cookies to improve your experience on our site. '
        + 'Wszelkie prawa zastrzeżone przez właściciela serwisu internetowego. '
        + 'Detektyw prowadzi obserwacje oraz ustala miejsce pobytu osób zaginionych.',
      ],
    });

    expect(s.critical.join(' ')).not.toMatch(/cookies|prawa zastrzeżone/i);
    expect(s.critical.join(' ')).toMatch(/Detektyw prowadzi obserwacje/);
  });
});

describe('WIE rxQualityGate', () => {
  it('vetoes editor placeholders', () => {
    const r = evaluateRxQualityGate({
      afterHtml: '<p>[Editor: dodaj 2-3 autorytatywne odnośniki]</p>',
      action: 'expand_section',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('placeholder');
  });

  it('vetoes definition-heavy practical section without examples', () => {
    const body = Array.from({ length: 90 }, () => 'słowo').join(' ');
    const html = `<p>Definicja szantażu oznacza to zmuszanie kogoś. ${body}</p>`;
    const r = evaluateRxQualityGate({
      afterHtml: html,
      action: 'expand_section',
      synthesis: {
        critical: ['x'],
        important: [],
        optional: [],
        opening_style: {},
        section_patterns: [],
        expert_claims: [],
        storytelling: [],
        examples: ['Messenger'],
        cta: {},
        faq: {},
        information_gain: [],
      },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts practical section with concrete example', () => {
    const body = Array.from({ length: 90 }, () => 'słowo').join(' ');
    const html = `<p>Na przykład ktoś pisze na Messenger i żąda Bitcoin. ${body}</p>`;
    const r = evaluateRxQualityGate({
      afterHtml: html,
      action: 'expand_section',
      synthesis: {
        critical: ['x'],
        important: [],
        optional: [],
        opening_style: {},
        section_patterns: [],
        expert_claims: [],
        storytelling: [],
        examples: ['Messenger'],
        cta: {},
        faq: {},
        information_gain: [],
      },
    });
    expect(r.ok).toBe(true);
  });
});

describe('WIE prompt inject', () => {
  it('includes synthesis and reader blocks in precision prompt', () => {
    const profile = buildIntentProfile({
      keyword: 'szantaż',
      title: 'Szantaż',
      headings: ['Co robić'],
      plainText: 'Szantaż to przestępstwo.',
      paaQuestions: ['Co zrobić gdy ktoś szantażuje?'],
    });
    const plan = buildPrecisionEditPlan({
      candidates: [
        makeCandidate({
          id: '1',
          source: 'ai_coverage',
          targetGap: 'Jak reagować na szantaż',
          priority: 'recommended',
          intentFit: 0.9,
          targetSectionId: 's1',
        }),
      ],
      profile,
      defaultSectionId: 's1',
    });
    const step = plan.steps[0];
    const brief = buildHeuristicReaderBrief({ keyword: 'szantaż co robić', paa: ['Co robić?'] });
    expect(brief.emotion).toBe('high');
    expect(formatReaderBriefForPrompt(brief)).toContain('READER:');

    const synth = heuristicCompetitorSynthesis({
      keyword: 'szantaż',
      corpusTexts: ['Ofiara nie powinna płacić. Messenger i Bitcoin są typowe. W praktyce sprawcy wracają.'],
    });
    const prompt = buildPrecisionStepPrompt(step, '<h2>Test</h2><p>Treść.</p>', {
      synthesis: synth,
      readerBrief: brief,
    });
    expect(prompt).toContain('COMPETITOR SYNTHESIS');
    expect(prompt).toContain('READER:');
    expect(prompt).toContain('VOICE:');
  });
});
