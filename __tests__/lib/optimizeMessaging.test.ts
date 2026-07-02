import { sectionStatusLabel, sectionResultLabel } from '../../lib/optimizeMessaging';
import type { StepFocus, EditMode } from '../../lib/optimizationPlanner';

describe('sectionStatusLabel', () => {
  it('returns expanding message when mode is expand, regardless of focus', () => {
    expect(sectionStatusLabel({ focus: 'seo-terms', mode: 'expand' })).toBe('Expanding thin content…');
    expect(sectionStatusLabel({ focus: 'readability', mode: 'expand' })).toBe('Expanding thin content…');
    expect(sectionStatusLabel({ focus: undefined, mode: 'expand' })).toBe('Expanding thin content…');
  });

  it('returns expanding message when focus is expand', () => {
    expect(sectionStatusLabel({ focus: 'expand' })).toBe('Expanding thin content…');
    expect(sectionStatusLabel({ focus: 'expand', mode: 'normal' })).toBe('Expanding thin content…');
  });

  it('returns authority message for ai-coverage focus with matching reason', () => {
    expect(sectionStatusLabel({ focus: 'ai-coverage', reason: 'missing authority signals' }))
      .toBe('Strengthening factual authority…');
    expect(sectionStatusLabel({ focus: 'ai-coverage', reason: 'needs fact-check' }))
      .toBe('Strengthening factual authority…');
    expect(sectionStatusLabel({ focus: 'ai-coverage', reason: 'add citation' }))
      .toBe('Strengthening factual authority…');
    expect(sectionStatusLabel({ focus: 'ai-coverage', reason: 'cite the source' }))
      .toBe('Strengthening factual authority…');
  });

  it('returns generic AI readiness message for ai-coverage focus without matching reason', () => {
    expect(sectionStatusLabel({ focus: 'ai-coverage', reason: 'improve clarity' }))
      .toBe('Improving AI answer readiness…');
    expect(sectionStatusLabel({ focus: 'ai-coverage' })).toBe('Improving AI answer readiness…');
  });

  it('returns seo-terms message', () => {
    expect(sectionStatusLabel({ focus: 'seo-terms' })).toBe('Improving SEO coverage…');
  });

  it('returns readability message', () => {
    expect(sectionStatusLabel({ focus: 'readability' })).toBe('Improving readability…');
  });

  it('returns skip message', () => {
    expect(sectionStatusLabel({ focus: 'skip' })).toBe('Already optimized.');
  });

  it('falls back to generic optimizing message when focus is missing', () => {
    expect(sectionStatusLabel({})).toBe('Optimizing section…');
    expect(sectionStatusLabel({ focus: undefined })).toBe('Optimizing section…');
  });
});

describe('sectionResultLabel', () => {
  it('returns expanded message when mode is expand', () => {
    expect(sectionResultLabel({ focus: 'seo-terms', mode: 'expand' })).toBe('Expanded thin content');
    expect(sectionResultLabel({ focus: undefined, mode: 'expand' })).toBe('Expanded thin content');
  });

  it('returns authority refinement message for ai-coverage with matching reason', () => {
    expect(sectionResultLabel({ focus: 'ai-coverage', reason: 'missing authority signals' }))
      .not.toBe('Improved AI Search coverage');
    expect(sectionResultLabel({ focus: 'ai-coverage', reason: 'add citation' }))
      .not.toBe('Improved AI Search coverage');
  });

  it('returns generic AI coverage message for ai-coverage without matching reason', () => {
    expect(sectionResultLabel({ focus: 'ai-coverage', reason: 'improve clarity' }))
      .toBe('Improved AI Search coverage');
    expect(sectionResultLabel({ focus: 'ai-coverage' })).toBe('Improved AI Search coverage');
  });

  it('returns seo-terms coverage message', () => {
    expect(sectionResultLabel({ focus: 'seo-terms' })).toBe('Added missing coverage');
  });

  it('returns readability message', () => {
    expect(sectionResultLabel({ focus: 'readability' })).toBe('Improved readability');
  });

  it('falls back to generic improved message', () => {
    expect(sectionResultLabel({})).toBe('Improved section');
    expect(sectionResultLabel({ focus: 'skip' })).toBe('Improved section');
  });

  it('never contains forbidden substrings for non-expand inputs (honest labeling guard)', () => {
    const forbidden = ['Rewrote', 'Generated', 'Expanded'];
    const focuses: (StepFocus | undefined)[] = ['seo-terms', 'ai-coverage', 'readability', 'skip', 'expand', undefined];
    const modes: (EditMode | undefined)[] = ['less', 'normal', undefined];
    const reasons = [undefined, 'missing authority signals', 'add citation', 'improve clarity', 'random reason'];

    for (const focus of focuses) {
      for (const mode of modes) {
        for (const reason of reasons) {
          const label = sectionResultLabel({ focus, mode, reason });
          for (const word of forbidden) {
            expect(label).not.toContain(word);
          }
        }
      }
    }
  });
});
