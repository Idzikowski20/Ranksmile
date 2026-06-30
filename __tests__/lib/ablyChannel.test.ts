import { articleChannelName, ABLY_EVENTS } from '../../lib/ably/channel';

describe('ably channel helper', () => {
  it('builds a stable per-article channel name', () => {
    expect(articleChannelName(42)).toBe('article:42');
    expect(articleChannelName('42')).toBe('article:42');
  });

  it('exposes the three event names', () => {
    expect(ABLY_EVENTS).toEqual({ content: 'content', caret: 'caret', comment: 'comment' });
  });
});
