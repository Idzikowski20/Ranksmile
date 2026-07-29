/**
 * Golden Set — cuckolding / zespół prowokowanej zdrady
 * MUST improve on-intent definition/Q; MUST NOT commercial drift.
 */
import { buildIntentProfile, textHitsForbidden } from '../../../lib/ao/intentProfile';
import { filterCandidatesByIntent } from '../../../lib/ao/intentGuard';
import { makeCandidate } from '../../../lib/ao/editCandidate';
import { buildPrecisionEditPlan } from '../../../lib/ao/editPlan';
import { runEditSafetyGate } from '../../../lib/ao/editSafetyGate';
import { DEFAULT_EDIT_BUDGET } from '../../../lib/ao/editBudget';
import { selectFaqQuestions } from '../../../lib/aoFaqSection';

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
