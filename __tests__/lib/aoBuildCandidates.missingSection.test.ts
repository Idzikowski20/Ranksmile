import { buildEditCandidates } from '@/src/infrastructure/ao/buildCandidates';
import type { ArticleIntentProfile } from '@/src/core/domain/optimize/intentProfile';

const profile = {
  intent: 'informational',
  forbiddenSubtopics: [],
} as unknown as ArticleIntentProfile;

const sections = [
  { id: 's1', html: '<h2>Czym jest szantaż</h2><p>Definicja i podstawy prawne szantażu.</p>' },
  { id: 's2', html: '<h2>FAQ</h2><p>Odpowiedzi.</p>' },
] as never;

it('proposes a new section for a shared competitor heading the article lacks', () => {
  const out = buildEditCandidates({
    profile,
    sections,
    strategy: 'enrichment',
    competitorHeadings: ['Ile kosztuje pomoc detektywa przy szantażu', 'Czym jest szantaż'],
  });
  const missing = out.filter((c) => c.source === 'missing_section');
  expect(missing).toHaveLength(1);
  expect(missing[0].suggestedAction).toBe('add_missing_section');
  expect(missing[0].targetGap).toContain('detektywa');
});

it('adds nothing in precision strategy — small fixes must not reshape the article', () => {
  const out = buildEditCandidates({
    profile,
    sections,
    strategy: 'precision',
    competitorHeadings: ['Ile kosztuje pomoc detektywa przy szantażu'],
  });
  expect(out.filter((c) => c.source === 'missing_section')).toHaveLength(0);
});
