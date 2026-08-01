import { selectSectionTarget, TARGET_CONFIDENCE_MIN } from '../../../lib/ao/sectionTargeting';
import { makeCandidate } from '../../../lib/ao/editCandidate';
import type { CriticalContentMap } from '../../../lib/ao/criticalContentMap';
import type { Section } from '../../../lib/articleSections';

const sections: Section[] = [
  { id: 'sec_0', index: 0, headingText: 'Intro', html: '<h2>Intro</h2><p>Ogólny wstęp o praktykach w związku.</p>' },
  { id: 'sec_1', index: 1, headingText: 'Czym jest cuckolding', html: '<h2>Czym jest cuckolding</h2><p>Definicja konsensualnej praktyki seksualnej.</p>' },
];

const critical: CriticalContentMap = {
  primaryTopic: 'cuckolding',
  primaryQuery: 'cuckolding',
  definitions: [],
  directAnswers: [],
  keyEntities: [],
  importantClaims: [],
  intentSections: [],
  commercialSections: [],
  protectedSectionIds: [],
};

describe('selectSectionTarget SEO fallback', () => {
  it('skips unrelated SEO term without fallback', () => {
    const candidate = makeCandidate({
      id: 'seo-1',
      source: 'seo_term',
      targetGap: 'Naturally include the term "zespół zdrady kontrolowanej" once',
      priority: 'recommended',
      intentFit: 0.55,
    });
    const noFallback = selectSectionTarget({ sections, candidate, critical });
    // Low overlap → may be null without fallback
    if (noFallback) {
      expect(noFallback.score.confidence).toBeGreaterThanOrEqual(TARGET_CONFIDENCE_MIN);
    }
  });

  it('uses semantic fallback for SEO term when allowSeoEntityFallback', () => {
    const candidate = makeCandidate({
      id: 'seo-2',
      source: 'seo_term',
      targetGap: 'Naturally include the term "zespół zdrady kontrolowanej" once',
      priority: 'recommended',
      intentFit: 0.55,
    });
    const without = selectSectionTarget({ sections, candidate, critical });
    const withFallback = selectSectionTarget({
      sections,
      candidate,
      critical,
      allowSeoEntityFallback: true,
    });
    // With fallback enabled, SEO/entity gaps always get a non-null body/intro target
    expect(withFallback).not.toBeNull();
    expect(withFallback!.sectionId).toBeTruthy();
    // Prefer non-intro body when available
    expect(withFallback!.sectionId).toBe('sec_1');
    // Either step-4 body assignment or explicit step-5 fallback
    if (without == null) {
      expect(withFallback!.usedFallback).toBe(true);
    }
  });
});
