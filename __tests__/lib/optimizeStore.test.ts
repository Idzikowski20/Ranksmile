import { optimizeStore } from '../../components/articles/optimizeStore';

describe('optimizeStore run control', () => {
  afterEach(() => {
    optimizeStore.clear();
  });

  it('beginRun returns a fresh abort signal', () => {
    const signal = optimizeStore.beginRun();
    expect(signal.aborted).toBe(false);
    expect(optimizeStore.getRunSignal()).toBe(signal);
  });

  it('cancelRun aborts the active signal', () => {
    const signal = optimizeStore.beginRun();
    optimizeStore.cancelRun();
    expect(signal.aborted).toBe(true);
    expect(optimizeStore.getRunSignal()).toBeUndefined();
  });

  it('beginRun aborts a previous run', () => {
    const first = optimizeStore.beginRun();
    const second = optimizeStore.beginRun();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });
});
