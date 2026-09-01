/** @jest-environment node */
import { extractSpecifiers, findLayerViolations } from '../../lib/arch/scanLayerImports';
import { LAYER_RULES } from '../../lib/arch/layerRules';

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
  it('src/core/domain, application and shared import no forbidden layer', () => {
    expect(findLayerViolations(process.cwd())).toEqual([]);
  });
});

// Positive coverage: the zero-violation assertion above passes even if a forbid
// regex has a typo or a layer entry was dropped. These assert each rule actually
// REJECTS the specifiers it must, and ACCEPTS the ones it must, so a broken pattern
// fails CI instead of silently disabling enforcement.
describe('LAYER_RULES enforce dependency direction', () => {
  const ruleFor = (label: string) => {
    const rule = LAYER_RULES.find((r) => r.label === label);
    if (!rule) throw new Error(`no rule for ${label}`);
    return rule;
  };
  const forbids = (label: string, spec: string) => ruleFor(label).forbid.some((re) => re.test(spec));

  it('domain rejects vendors, outer layers, lib and application (inverted dep)', () => {
    expect(forbids('domain', 'stripe')).toBe(true);
    expect(forbids('domain', '../../infrastructure/billing/x')).toBe(true);
    expect(forbids('domain', '@/lib/orgBilling')).toBe(true);
    expect(forbids('domain', '../../application/billing/listOrgBillingInvoices')).toBe(true);
  });

  it('domain accepts its own layer and shared', () => {
    expect(forbids('domain', './blockedDomains')).toBe(false);
    expect(forbids('domain', '../gsc/week')).toBe(false);
    expect(forbids('domain', '@/src/core/shared/money')).toBe(false);
  });

  it('application accepts domain + shared but rejects lib/vendors/outer', () => {
    expect(forbids('application', '@/src/core/domain/billing/invoice')).toBe(false);
    expect(forbids('application', '@/src/core/shared/money')).toBe(false);
    expect(forbids('application', 'sequelize')).toBe(true);
    expect(forbids('application', '@/lib/stripe')).toBe(true);
    expect(forbids('application', '../../infrastructure/x')).toBe(true);
  });

  it('shared is a leaf: rejects domain, application, lib and vendors', () => {
    expect(forbids('shared', '@/src/core/domain/billing/invoice')).toBe(true);
    expect(forbids('shared', '../application/x')).toBe(true);
    expect(forbids('shared', '@/lib/stripe')).toBe(true);
    expect(forbids('shared', 'stripe')).toBe(true);
    expect(forbids('shared', './language')).toBe(false);
  });
});
