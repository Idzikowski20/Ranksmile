import { clearWizardState } from '../../lib/wizardState';

describe('clearWizardState', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports an unsuccessful API clear', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(clearWizardState('123')).resolves.toBe(false);
  });

  it('confirms a successful API clear', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    await expect(clearWizardState('123')).resolves.toBe(true);
  });
});
