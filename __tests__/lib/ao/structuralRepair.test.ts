/**
 * Article-165 degraded run: three planned sections were gone, the route let the run
 * through, and the engine stopped at step 0 on "targets reached" (SEO 99 / AI 85)
 * before restoring a single section. Structure is repaired regardless of score.
 */
import { runPrecisionOptimizeV4 } from '@/src/infrastructure/ao/runPrecisionOptimize';
import type { ScoreData } from '@/src/infrastructure/articles/contentScore';

const sec = (h: string, body: string) => `<h2>${h}</h2><p>${body.repeat(12)}</p>`;
const html = [
  '<h1>Najemca nie płaci czynszu</h1><p>Gdy lokator przestaje płacić, właściciel ma kilka legalnych dróg. </p>',
  sec('Nieuczciwy najemca nie płaci czynszu — co może zrobić właściciel?', 'Właściciel dokumentuje zaległość i wzywa do zapłaty. '),
  sec('Wezwanie do zapłaty czynszu — co powinno zawierać', 'Wezwanie zawiera kwotę, termin i rachunek. '),
].join('\n');

describe('planned sections are restored even when scores already meet the targets', () => {
  it('runs the add_missing_section step instead of stopping on targets_reached', async () => {
    const prompts: string[] = [];
    const r = await runPrecisionOptimizeV4({
      runId: 't',
      html,
      ctx: null,
      scoreData: { terms: [] } as unknown as ScoreData,
      keyword: 'najemca nie płaci czynszu',
      plannedHeadings: [
        'Nieuczciwy najemca nie płaci czynszu — co może zrobić właściciel?',
        'Prawa właściciela mieszkania a niepłacący najemca — dozwolone działania',
        'Wezwanie do zapłaty czynszu — co powinno zawierać',
      ],
      targetSeo: 90,
      targetAi: 85,
      llmEdit: async (prompt) => {
        prompts.push(prompt);
        return {
          html: '<h2>Prawa właściciela mieszkania a niepłacący najemca — dozwolone działania</h2>'
            + `<p>${'Właściciel może wypowiedzieć umowę po pisemnym wezwaniu i dodatkowym terminie. '.repeat(6)}</p>`,
          tokens: 10,
        };
      },
      // Already at target from the first measurement.
      scoreHtml: (h) => ({
        scores: { seo: 99, ai: 85, content: 93 + (h.includes('dozwolone działania') ? 1 : 0) },
        aiAvailability: 'available',
      }),
    });
    expect(prompts.some((p) => p.includes('brand new section'))).toBe(true);
    expect(r.html).toContain('<h2>Prawa właściciela mieszkania a niepłacący najemca — dozwolone działania</h2>');
    expect((r.html.match(/<h2/g) || []).length).toBe(3);
  });
});
