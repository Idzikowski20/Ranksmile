import { topicsNeedLocalization } from '../../lib/domainLanguagePrompts';

describe('topicsNeedLocalization', () => {
  it('flags English topic titles for Polish domains', () => {
    expect(topicsNeedLocalization(
      ['Harassment and Threats', 'Detective Services Warsaw', 'Cuckolding and Infidelity'],
      'pl',
    )).toBe(true);
  });

  it('accepts Polish topic titles', () => {
    expect(topicsNeedLocalization(
      ['Nękanie i groźby', 'Usługi detektywistyczne Warszawa'],
      'pl',
    )).toBe(false);
  });
});
