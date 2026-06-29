import { sseEvent, formatTokens } from '../../../lib/ai/sse';

describe('sseEvent', () => {
  it('formats an SSE frame with event + JSON data', () => {
    expect(sseEvent('step', { a: 1 })).toBe('event: step\ndata: {"a":1}\n\n');
  });
});

describe('formatTokens', () => {
  it('passes sub-1k counts through as integers', () => {
    expect(formatTokens(980)).toBe('980');
    expect(formatTokens(1)).toBe('1');
  });
  it('compacts thousands to "k"', () => {
    expect(formatTokens(12345)).toBe('12.3k');
    expect(formatTokens(60000)).toBe('60.0k');
  });
  it('returns "0" for zero / invalid', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(-5)).toBe('0');
    expect(formatTokens(NaN)).toBe('0');
  });
});
