/**
 * Golden Set — cuckolding / zespół prowokowanej zdrady
 * MUST improve on-intent definition/Q; MUST NOT commercial drift.
 *
 * P1.3 regression: AO must do the intended class of work (body SEO first),
 * not “FAQ wall → AI score ↑ → Article optimized”.
 */
import { buildIntentProfile, textHitsForbidden } from '../../../lib/ao/intentProfile';
import { filterCandidatesByIntent } from '../../../lib/ao/intentGuard';
import { makeCandidate } from '../../../lib/ao/editCandidate';
import { buildPrecisionEditPlan } from '../../../lib/ao/editPlan';
import { runEditSafetyGate } from '../../../lib/ao/editSafetyGate';
import { DEFAULT_EDIT_BUDGET } from '../../../lib/ao/editBudget';
import { selectFaqQuestions, validateFaqHtmlStructure } from '../../../lib/aoFaqSection';
import { chooseStrategyFromDiagnosis } from '../../../lib/ao/optimizationPolicy';
import { resolveAoWorkOutcome, aoOutcomeUserMessage } from '../../../lib/ao/aoRunOutcome';
import { selectSectionTarget } from '../../../lib/ao/sectionTargeting';
import { buildArticleSectionDiffEvents } from '../../../lib/optimizeSectionEvents';
import type { CriticalContentMap } from '../../../lib/ao/criticalContentMap';
import type { Section } from '../../../lib/articleSections';

const ARTICLE = {
  keyword: 'cuckolding',
  title: 'Cuckolding — co to jest?',
  headings: [
    'Czym jest cuckolding',
    'Różnica między cuckoldingiem a zdradą',
    'Psychologiczne aspekty',
  ],
  plainText:
    'Cuckolding to konsensualna praktyka seksualna, w której partnerzy świadomie włączają element cudzołóstwa fantazji. '
    + 'Nie jest to tożsame z zdradą bez zgody. Artykuł omawia definicję, komunikację w związku i granice.',
};

const MUST_NOT_GAPS = [
  'Jak wynająć detektywa do sprawdzenia żony',
  'Tester wierności — agencja detektywistyczna',
  'Private investigator for cheating spouse',
  'Loyalty test service pricing',
];

const MUST_GAPS = [
  'Czym jest cuckolding?',
  'Czym różni się cuckolding od zdrady?',
];

describe('Golden: cuckolding MUST NOT commercial drift', () => {
  const profile = buildIntentProfile({
    keyword: ARTICLE.keyword,
    title: ARTICLE.title,
    headings: ARTICLE.headings,
    plainText: ARTICLE.plainText,
    paaQuestions: MUST_GAPS,
  });

  it('profile marks psychology domain and forbids detective terms', () => {
    expect(profile.sensitiveDomain).toBe('psychology');
    expect(textHitsForbidden('detektyw prywatny', profile)).toBe(true);
  });

  it('Guard#1 drops all commercial drift candidates', () => {
    const cands = [
      ...MUST_GAPS.map((g, i) =>
        makeCandidate({ id: `must-${i}`, source: 'paa', targetGap: g, priority: 'recommended', intentFit: 0.7 }),
      ),
      ...MUST_NOT_GAPS.map((g, i) =>
        makeCandidate({ id: `drift-${i}`, source: 'ai_coverage', targetGap: g, priority: 'critical', intentFit: 0.9 }),
      ),
    ];
    const filtered = filterCandidatesByIntent(cands, profile);
    expect(filtered.every((c) => c.id.startsWith('must-'))).toBe(true);
    expect(filtered.some((c) => c.id.startsWith('drift-'))).toBe(false);
  });

  it('planner never opens new_h2 for term/entity gaps', () => {
    const term = makeCandidate({
      id: 'seo-1',
      source: 'seo_term',
      targetGap: 'Naturally include "cuckolding"',
      priority: 'recommended',
      intentFit: 0.6,
    });
    const plan = buildPrecisionEditPlan({
      candidates: filterCandidatesByIntent([term], profile),
      profile,
      defaultSectionId: 's0',
    });
    for (const step of plan.steps) {
      expect(step.action).not.toBe('add_faq');
      expect(step.forbiddenChanges).toContain('new_h2');
      expect(step.forbiddenChanges).toContain('new_topic');
    }
  });

  it('SafetyGate rejects detective content injected into section', () => {
    const before =
      '<h2>Czym jest cuckolding</h2><p>Cuckolding to konsensualna praktyka seksualna w związku partnerskim.</p>';
    const after =
      '<h2>Czym jest cuckolding</h2><p>Cuckolding to konsensualna praktyka. '
      + 'Jeśli podejrzewasz zdradę, wynajmij detektywa lub testera wierności.</p>';
    const result = runEditSafetyGate({
      beforeHtml: before,
      afterHtml: after,
      budget: DEFAULT_EDIT_BUDGET,
      profile,
      stepId: 'golden-drift',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['FORBIDDEN_TOPIC', 'TOPIC_DRIFT']).toContain(result.rejectReason);
    }
  });

  it('FAQ gate keeps on-intent Q and drops detective Q', () => {
    const selected = selectFaqQuestions({
      questions: [
        { id: 'd1', label: MUST_NOT_GAPS[0] },
        { id: 'ok1', label: MUST_GAPS[0] },
        { id: 'ok2', label: MUST_GAPS[1] },
      ],
      profile,
      articlePlainText: ARTICLE.plainText,
    });
    expect(selected.map((q) => q.id)).not.toContain('d1');
    expect(selected.some((q) => q.id.startsWith('ok'))).toBe(true);
  });
});

/**
 * Failure mode: SEO 28 / AI 21 / Overall ~38 → deep_optimize (section path).
 * Assert class-of-work invariants, not merely “score went up”.
 */
describe('Golden: cuckolding AO class-of-work (P0/P1)', () => {
  const baseline = { seo: 28, ai: 21, content: 38 };

  it('routes very weak SEO+content article to deep_optimize', () => {
    const strategy = chooseStrategyFromDiagnosis({
      scores: baseline,
      structural: 'weak',
      intent: 'acceptable',
      highValueGaps: 4,
    });
    expect(strategy).toBe('deep_optimize');
  });

  it('SEO entity gap gets semantic body fallback (not silent skip)', () => {
    const sections: Section[] = [
      {
        id: 'sec_0',
        index: 0,
        headingText: 'Intro',
        html: '<p>Krótki wstęp o związkach i fantazjach.</p>',
      },
      {
        id: 'sec_1',
        index: 1,
        headingText: 'Czym jest cuckolding',
        html: '<h2>Czym jest cuckolding</h2><p>Cuckolding to konsensualna praktyka seksualna.</p>',
      },
    ];
    const critical: CriticalContentMap = {
      primaryTopic: 'cuckolding',
      primaryQuery: 'cuckolding co to znaczy',
      definitions: [],
      directAnswers: [],
      keyEntities: [],
      importantClaims: [],
      intentSections: [],
      commercialSections: [],
      protectedSectionIds: [],
    };
    const candidate = makeCandidate({
      id: 'seo-entity',
      source: 'seo_term',
      targetGap: 'Naturally include "cuckolding co to znaczy" once',
      priority: 'critical',
      intentFit: 0.6,
    });
    const target = selectSectionTarget({
      sections,
      candidate,
      critical,
      allowSeoEntityFallback: true,
    });
    expect(target).not.toBeNull();
    expect(target!.sectionId).toBe('sec_1');
  });

  it('FAQ residual skips questions already answered in body', () => {
    const selected = selectFaqQuestions({
      questions: [
        { id: 'dup', label: 'Czym jest cuckolding?' },
        { id: 'new', label: 'Jak rozmawiać o granicach w cuckoldingu?' },
      ],
      profile: buildIntentProfile({
        keyword: ARTICLE.keyword,
        title: ARTICLE.title,
        headings: ARTICLE.headings,
        plainText: ARTICLE.plainText,
        paaQuestions: MUST_GAPS,
      }),
      articlePlainText: ARTICLE.plainText,
    });
    expect(selected.map((q) => q.id)).not.toContain('dup');
  });

  it('hard-rejects FAQ wall-of-text; accepts structured H2/H3/P', () => {
    const wall =
      '<h2>Najczęściej zadawane pytania</h2><p>'
      + `${'Cuckolding to praktyka. '.repeat(80)}</p>`;
    expect(validateFaqHtmlStructure(wall, { language: 'pl' }).ok).toBe(false);

    const structured =
      '<h2>Najczęściej zadawane pytania</h2>'
      + '<h3>Czym różni się cuckolding od zdrady?</h3>'
      + '<p>Cuckolding opiera się na świadomej zgodzie partnerów; zdrada to naruszenie zaufania bez zgody.</p>';
    const ok = validateFaqHtmlStructure(structured, { language: 'pl', expectedQuestionCount: 1 });
    expect(ok).toEqual({ ok: true, questionCount: 1 });
  });

  it('bodyAccepted=0 + FAQ + SEO gaps ⇒ faq_only, never fully_optimized', () => {
    const outcome = resolveAoWorkOutcome({
      bodyAccepted: 0,
      faqAccepted: true,
      seoEntityGapsBefore: 1,
      seoEntityGapsAfter: 1,
    });
    expect(outcome).toBe('faq_only');
    expect(outcome).not.toBe('fully_optimized');
    expect(aoOutcomeUserMessage(outcome)).toMatch(/incomplete|FAQ/i);
  });

  it('diff labels: body SEO edit ≠ global ai-coverage; FAQ stays ai-coverage', () => {
    const before =
      '<h2>Czym jest cuckolding</h2><p>Krótka definicja.</p>';
    const after =
      '<h2>Czym jest cuckolding</h2><p>Cuckolding co to znaczy: konsensualna praktyka w związku.</p>'
      + '<h2>Najczęściej zadawane pytania</h2>'
      + '<h3>Jak ustalać granice?</h3>'
      + '<p>Partnerzy ustalają zasady komunikacji i bezpieczne słowa przed eksperymentem.</p>';
    const events = buildArticleSectionDiffEvents(before, after);
    const bodyEv = events.find((e) => e.headingText.includes('Czym jest'));
    const faqEv = events.find((e) => /najczęściej zadawane/i.test(e.headingText + e.newHtml));
    expect(bodyEv?.changed).toBe(true);
    expect(bodyEv?.focus).toBe('seo-terms');
    expect(faqEv?.focus).toBe('ai-coverage');
  });
});
