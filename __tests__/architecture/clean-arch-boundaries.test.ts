/** @jest-environment node */
import { extractSpecifiers, findLayerViolations } from '../../lib/arch/scanLayerImports';

describe('extractSpecifiers (ts.preProcessFile)', () => {
  it('extracts esm, type-only, dynamic and require specifiers', () => {
    const src = `
      import a from 'stripe';
      import type { B } from '../../domain/billing/invoice';
      export { C } from './x';
      const d = require('sequelize');
      const e = import('../../../lib/stripe');
    `;
    expect(extractSpecifiers(src).sort()).toEqual(
      ['../../domain/billing/invoice', '../../../lib/stripe', './x', 'sequelize', 'stripe'].sort(),
    );
  });
});

describe('clean-architecture dependency rule', () => {
  it('src/core/domain and src/core/application import no forbidden layer', () => {
    expect(findLayerViolations(process.cwd())).toEqual([]);
  });
});
