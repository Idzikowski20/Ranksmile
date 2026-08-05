import { compile } from '../../../lib/compiler/compile';
import { projectVisibility } from '../../../lib/projections/visibilityView';
import { runConstraints } from '../../../lib/ccm/constraintEngine';

const AT = '2026-08-03T14:00:00.000Z';

describe('visibility + constraints', () => {
  it('projectVisibility clusters facts under intents', () => {
    const { model } = compile({
      articleId: 'vis1',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Wojna hybrydowa\n\nRosja anektowała Krym w 2014 roku mimo oporu.',
      },
    });
    const vis = projectVisibility(model);
    expect(vis.atomicFactCount).toBeGreaterThanOrEqual(1);
    expect(vis.clusters.length).toBeGreaterThanOrEqual(1);
    expect(vis.completeness).toBeGreaterThanOrEqual(0);
    expect(vis.clusters.some((c) => /wojna hybrydowa/i.test(c.label))).toBe(true);
  });

  it('runConstraints passes dated compile without errors', () => {
    const { model } = compile({
      articleId: 'ce1',
      compiledAt: AT,
      source: {
        kind: 'plain',
        text: '# Temat\n\nRosja w 2014 zajęła Krym po inwazji.',
      },
    });
    const report = runConstraints(model);
    expect(report.errorCount).toBe(0);
  });

  it('compile notes include constraint counts when warnings', () => {
    const { model } = compile({
      articleId: 'ce2',
      compiledAt: AT,
      source: { kind: 'plain', text: '# T\n\nHi.' },
    });
    // short weak fact may produce fact_not_orphan warning before strip, or after strip none
    expect(model.compiler.notes.some((n) => n.startsWith('constraints_') || n.includes('skeleton'))).toBe(
      true,
    );
  });
});
