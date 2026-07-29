import {
  makeScoreDelta,
  makeScoreDeltaSet,
  strictScoreGateRejectReason,
  isPromisingSeoContent,
  hasSeoContentRegression,
} from '../../../../lib/ao/aoScoreDelta';
import { buildCriticalContentMap, unitSemanticallyPresent } from '../../../../lib/ao/criticalContentMap';
import { buildIntentProfile } from '../../../../lib/ao/intentProfile';
import { selectSectionTarget } from '../../../../lib/ao/sectionTargeting';
import { splitSections } from '../../../../lib/articleSections';
import {
  runSemanticPreservationGate,
  runFinalScoreGate,
  runCandidateScoreGate,
} from '../../../../lib/ao/aoQualityGates';
import { makeCandidate } from '../../../../lib/ao/editCandidate';
import { htmlMatchesNormalized } from '../../../../lib/ao/aoBaseline';

const LEAD =
  '<p>Zespół prowokowanej zdrady (ang. cuckolding) to zaburzenie natury psychoseksualnej, które najczęściej dotyczy mężczyzn i polega na namawianiu partnerki do zdrady.</p>';
const BODY =
  '<h2>Przyczyny</h2><p>Fantazje seksualne i psychologia odgrywają kluczową rolę w zespole prowokowanej zdrady oraz cuckoldingu.</p>'
  + '<h2>Zdrada a usługi detektywistyczne</h2><p>Agencja detektywistyczna może pomóc w wykrywaniu zdrad.</p>';

describe('aoScoreDelta', () => {
  it('signed deltas never clamp with Math.max(0)', () => {
    const d = makeScoreDelta(69, 65);
    expect(d.delta).toBe(-4);
    expect(d.direction).toBe('down');
  });

  it('unavailable AI → SCORE_INCONCLUSIVE under strict', () => {
    const reason = strictScoreGateRejectReason(
      { seo: 70, content: 64, ai: 56 },
      { seo: 71, content: 65, ai: 56 },
      { aiAvailability: 'unavailable' },
    );
    expect(reason).toBe('SCORE_INCONCLUSIVE');
  });

  it('promising is deterministic SEO+Content >= working', () => {
    expect(isPromisingSeoContent(
      { seo: 69, content: 63, ai: 56 },
      { seo: 70, content: 64, ai: 50 },
    )).toBe(true);
    expect(isPromisingSeoContent(
      { seo: 69, content: 63, ai: 56 },
      { seo: 68, content: 64, ai: 58 },
    )).toBe(false);
  });

  it('sub-threshold -1 is not meaningful regression', () => {
    expect(hasSeoContentRegression(
      { seo: 69, content: 63, ai: 56 },
      { seo: 68, content: 63, ai: 56 },
    )).toBe(false);
  });
});

describe('CriticalContentMap + semantic gate', () => {
  const html = `${LEAD}${BODY}`;
  const profile = buildIntentProfile({
    keyword: 'zespół prowokowanej zdrady',
    title: 'Cuckolding',
    headings: ['Przyczyny', 'Zdrada a usługi detektywistyczne'],
    plainText: html.replace(/<[^>]+>/g, ' '),
  });
  const sections = splitSections(html);
  const map = buildCriticalContentMap({
    html,
    profile,
    sectionIds: sections.map((s) => s.id),
  });

  it('finds definition-bearing units (not only empty map)', () => {
    expect(map.definitions.length + map.directAnswers.length).toBeGreaterThan(0);
  });

  it('DESTRUCTIVE empty lead → DEFINITION or LEAD fail', () => {
    const after = `<p>x</p>${BODY}`;
    const gate = runSemanticPreservationGate({ beforeHtml: html, afterHtml: after, critical: map });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(['DEFINITION_REMOVED', 'LEAD_INTENT_LOST', 'PRIMARY_ENTITY_LOST', 'CRITICAL_CONTENT_REMOVED']).toContain(gate.reason);
    }
  });

  it('SAFE rewrite preserving meaning → PASS', () => {
    const rewritten =
      '<p>Cuckolding, czyli zespół prowokowanej zdrady, to zaburzenie natury psychoseksualnej dotyczące najczęściej mężczyzn, polegające na namawianiu partnerki do zdrady.</p>'
      + BODY;
    const gate = runSemanticPreservationGate({ beforeHtml: html, afterHtml: rewritten, critical: map });
    expect(gate.ok).toBe(true);
  });
});

describe('sectionTargeting', () => {
  it('does not default to intro when body matches better', () => {
    const html = `${LEAD}<h2>Przyczyny psychologiczne</h2><p>Potrzeba kontroli i niska samoocena w zespole prowokowanej zdrady.</p>`;
    const sections = splitSections(html);
    const profile = buildIntentProfile({
      keyword: 'zespół prowokowanej zdrady',
      plainText: html.replace(/<[^>]+>/g, ' '),
      headings: ['Przyczyny psychologiczne'],
    });
    const critical = buildCriticalContentMap({
      html,
      profile,
      sectionIds: sections.map((s) => s.id),
    });
    const candidate = makeCandidate({
      id: '1',
      source: 'ai_coverage',
      targetGap: 'psychologiczne przyczyny cuckoldingu i kontroli',
      priority: 'recommended',
      intentFit: 0.7,
    });
    const target = selectSectionTarget({ sections, candidate, critical });
    expect(target).not.toBeNull();
    if (target) {
      const intro = sections[0];
      // Prefer body when gap matches przyczyny
      expect(target.sectionId === intro.id ? target.score.confidence < 0.35 : true).toBe(true);
      if (sections.length > 1) {
        expect(target.sectionId).not.toBe(intro.id);
      }
    }
  });
});

describe('dual gates', () => {
  it('candidate TEMP vs WORKING accepts local improvement', () => {
    const r = runCandidateScoreGate({
      working: { seo: 70, content: 64, ai: 57 },
      temp: { seo: 71, content: 65, ai: 58 },
    });
    expect(r.ok).toBe(true);
  });

  it('final FINAL vs BASELINE rejects triple drop', () => {
    const r = runFinalScoreGate({
      baseline: { seo: 69, content: 63, ai: 56 },
      final: { seo: 65, content: 58, ai: 50 },
    });
    expect(r.ok).toBe(false);
  });

  it('rollback restores normalized HTML identity', () => {
    const a = '<p>Hello</p>\n<p>World</p>';
    const b = '<p>Hello</p><p>World</p>';
    expect(htmlMatchesNormalized(a, b)).toBe(true);
  });
});

describe('unitSemanticallyPresent', () => {
  it('detects rewritten definition', () => {
    const unit = {
      id: 'd0',
      sectionId: 's0',
      type: 'definition' as const,
      text: 'Zespół prowokowanej zdrady to zaburzenie natury psychoseksualnej dotyczące mężczyzn',
      importance: 'critical' as const,
      preservationMode: 'semantic' as const,
      score: 80,
    };
    const after = '<p>Cuckolding czyli zespół prowokowanej zdrady to zaburzenie natury psychoseksualnej dotyczące mężczyzn w związku.</p>';
    expect(unitSemanticallyPresent(unit, after)).toBe(true);
  });
});
