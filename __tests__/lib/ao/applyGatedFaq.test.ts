import { applyGatedFaqMerge } from '../../../lib/ao/applyGatedFaq';
import { buildCriticalContentMap } from '../../../lib/ao/criticalContentMap';
import { buildIntentProfile } from '../../../lib/ao/intentProfile';
import { countWordsFromHtml } from '../../../lib/ao/aoBaseline';
import type { AoScores } from '../../../lib/ao/aoScoreDelta';

const BODY =
  '<p>Zespół prowokowanej zdrady (ang. cuckolding) to zaburzenie natury psychoseksualnej.</p>'
  + '<h2>Przyczyny</h2><p>Fantazje seksualne i psychologia odgrywają kluczową rolę w cuckoldingu.</p>';

const FAQ_OK =
  '<h2>Najczęściej zadawane pytania</h2>'
  + '<h3>Czy cuckold to coś złego?</h3><p>Nie ma jednej odpowiedzi; ważne są zgoda i kontekst emocjonalny.</p>';

function scores(seo: number, content: number, ai: number): AoScores {
  return { seo, content, ai };
}

describe('applyGatedFaqMerge', () => {
  const profile = buildIntentProfile({
    keyword: 'cuckolding',
    title: 'Cuckolding',
    headings: ['Przyczyny'],
    plainText: BODY.replace(/<[^>]+>/g, ' '),
  });
  const critical = buildCriticalContentMap({
    html: BODY,
    profile,
    sectionIds: ['s0', 's1'],
  });
  const baseline = scores(69, 63, 56);
  const working = scores(69, 63, 56);
  const wordCount = countWordsFromHtml(BODY);

  it('rejects FAQ that meaningfully regresses SEO vs working', () => {
    const r = applyGatedFaqMerge({
      originalHtml: BODY,
      workingHtml: BODY,
      faqHtml: FAQ_OK,
      baselineScores: baseline,
      workingScores: working,
      baselineWordCount: wordCount,
      critical,
      scoreHtml: () => ({
        scores: scores(60, 63, 70),
        aiAvailability: 'available',
      }),
    });
    expect(r.accepted).toBe(false);
    expect(r.rolledBack).toBe(false);
    expect(r.html).toBe(BODY);
    expect(r.reason).toBe('SEO_REGRESSION');
  });

  it('full rollback to original when final gate fails after FAQ', () => {
    const improvedWorking =
      `${BODY}<p>Extra safe paragraph about cuckolding psychology.</p>`;
    let calls = 0;
    const r = applyGatedFaqMerge({
      originalHtml: BODY,
      workingHtml: improvedWorking,
      faqHtml: FAQ_OK,
      baselineScores: baseline,
      workingScores: scores(71, 65, 58),
      baselineWordCount: wordCount,
      critical,
      scoreHtml: () => {
        calls += 1;
        // Candidate path (calls 1–2): non-regressive vs working
        if (calls <= 2) {
          return { scores: scores(72, 66, 60), aiAvailability: 'available' };
        }
        // Final re-score: meaningful AI drop vs baseline 56
        return { scores: scores(72, 66, 50), aiAvailability: 'available' };
      },
    });
    expect(r.rolledBack).toBe(true);
    expect(r.accepted).toBe(false);
    expect(r.html).toBe(BODY);
    expect(r.scores).toEqual(baseline);
  });

  it('accepts FAQ when candidate + final gates pass', () => {
    const r = applyGatedFaqMerge({
      originalHtml: BODY,
      workingHtml: BODY,
      faqHtml: FAQ_OK,
      baselineScores: baseline,
      workingScores: working,
      baselineWordCount: wordCount,
      critical,
      scoreHtml: () => ({
        scores: scores(70, 64, 60),
        aiAvailability: 'available',
      }),
    });
    expect(r.accepted).toBe(true);
    expect(r.rolledBack).toBe(false);
    expect(r.html).toContain('Najczęściej zadawane pytania');
    expect(r.scores.ai).toBe(60);
    expect(r.deltas.ai.delta).toBe(4);
  });

  it('unavailable AI on promising FAQ → reject (not accept as flat)', () => {
    const r = applyGatedFaqMerge({
      originalHtml: BODY,
      workingHtml: BODY,
      faqHtml: FAQ_OK,
      baselineScores: baseline,
      workingScores: working,
      baselineWordCount: wordCount,
      critical,
      scoreHtml: () => ({
        scores: scores(70, 64, 56),
        aiAvailability: 'unavailable',
      }),
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('SCORE_INCONCLUSIVE');
    expect(r.html).toBe(BODY);
  });
});
