import { appendChunk, MAX_STREAM_CHARS } from '../../lib/streamText';

describe('appendChunk', () => {
  it('appends to an empty stream', () => {
    expect(appendChunk(null, '<h1>Title</h1>')).toBe('<h1>Title</h1>');
  });

  it('concatenates in arrival order', () => {
    expect(appendChunk('<h1>T</h1>', '<p>Body</p>')).toBe('<h1>T</h1><p>Body</p>');
  });

  it('caps runaway streams', () => {
    const long = 'x'.repeat(MAX_STREAM_CHARS - 5);
    expect(appendChunk(long, 'abcdefghij')).toHaveLength(MAX_STREAM_CHARS);
  });

  it('ignores an empty chunk', () => {
    expect(appendChunk('<p>a</p>', '')).toBe('<p>a</p>');
  });
});
