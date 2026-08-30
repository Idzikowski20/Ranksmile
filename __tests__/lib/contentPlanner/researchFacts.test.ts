import { getResearchedFacts } from '@/src/infrastructure/contentPlanner/researchFacts';
import { callSidecar, isSidecarConfigured } from '@/src/infrastructure/http/sidecar';

jest.mock('@/src/infrastructure/http/sidecar', () => ({
  callSidecar: jest.fn(),
  isSidecarConfigured: jest.fn(() => true),
}));

const mockCall = callSidecar as jest.MockedFunction<typeof callSidecar>;

describe('getResearchedFacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isSidecarConfigured as jest.Mock).mockReturnValue(true);
  });

  it('does not cache an empty harvest', async () => {
    const scoreData: Record<string, unknown> = {};
    mockCall.mockResolvedValueOnce({ claims: [], sources: [] });

    await getResearchedFacts({ keyword: 'szantaz', scoreData });

    expect(scoreData.researched_facts).toBeUndefined();
  });

  it('retries research when the stored harvest is empty', async () => {
    const scoreData: Record<string, unknown> = { researched_facts: { claims: [], sources: [] } };
    mockCall.mockResolvedValueOnce({ claims: ['X Ka 683/23'], sources: [{ url: 'https://sn.pl' }] });

    const out = await getResearchedFacts({ keyword: 'szantaz', scoreData });

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(out.claims).toEqual(['X Ka 683/23']);
    expect(scoreData.researched_facts).toEqual(out);
  });

  it('serves a non-empty harvest from the cache', async () => {
    const cached = { claims: ['already here'], sources: [] };
    const out = await getResearchedFacts({ keyword: 'szantaz', scoreData: { researched_facts: cached } });

    expect(mockCall).not.toHaveBeenCalled();
    expect(out).toBe(cached);
  });
});
