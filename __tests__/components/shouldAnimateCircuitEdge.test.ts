import { shouldAnimateCircuitEdge } from '../../components/ranksmile/AnalysisCircuitBoard';

describe('shouldAnimateCircuitEdge', () => {
  it('skips inactive branches (e.g. AI Search idle while SERP runs)', () => {
    expect(shouldAnimateCircuitEdge('active', 'inactive')).toBe(false);
    expect(shouldAnimateCircuitEdge('inactive', 'processing')).toBe(false);
  });

  it('pulses only when a node on the edge is processing', () => {
    expect(shouldAnimateCircuitEdge('active', 'processing')).toBe(true);
    expect(shouldAnimateCircuitEdge('processing', 'inactive')).toBe(false);
    expect(shouldAnimateCircuitEdge('active', 'active')).toBe(false);
  });

  it('stops pulse on completed paths while another branch runs', () => {
    // SERP done + AI processing → SERP→Score both active → no pulse
    expect(shouldAnimateCircuitEdge('active', 'active')).toBe(false);
    // Article→AI while AI processing
    expect(shouldAnimateCircuitEdge('active', 'processing')).toBe(true);
  });
});
