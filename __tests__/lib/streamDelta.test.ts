import { streamDelta } from '../../lib/streamDelta';

describe('streamDelta', () => {
  it('emits only what has not been sent', () => {
    expect(streamDelta(5, 'abcdefgh')).toEqual({ chunk: 'fgh', nextLength: 8 });
  });

  it('emits nothing when nothing changed', () => {
    expect(streamDelta(8, 'abcdefgh')).toEqual({ chunk: '', nextLength: 8 });
  });

  it('restarts when the stored text shrank (job restarted)', () => {
    expect(streamDelta(20, 'abc')).toEqual({ chunk: 'abc', nextLength: 3 });
  });

  it('handles an empty stream', () => {
    expect(streamDelta(0, '')).toEqual({ chunk: '', nextLength: 0 });
  });
});
