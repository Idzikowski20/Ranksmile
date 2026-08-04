import { shouldSkipFreshGenerate } from '../../lib/generateResume';

describe('shouldSkipFreshGenerate', () => {
  const realHtml = `<h1>Title</h1><p>${'Lorem ipsum dolor sit amet. '.repeat(8)}</p>`;

  it('polls in-flight jobs', () => {
    expect(shouldSkipFreshGenerate({ jobStatus: 'running' })).toBe('poll');
    expect(shouldSkipFreshGenerate({ jobStatus: 'queued' })).toBe('poll');
  });

  it('finishes only when done AND article has usable HTML', () => {
    expect(shouldSkipFreshGenerate({ jobStatus: 'done', articleHtml: realHtml })).toBe('finish');
  });

  it('starts fresh when done but article is empty (stale empty generate)', () => {
    expect(shouldSkipFreshGenerate({ jobStatus: 'done', articleHtml: '' })).toBe('fresh');
    expect(shouldSkipFreshGenerate({ jobStatus: 'done', articleHtml: '<h1>ghhg</h1><p>/</p>' })).toBe('fresh');
  });

  it('starts fresh on failed or missing job', () => {
    expect(shouldSkipFreshGenerate({ jobStatus: 'failed' })).toBe('fresh');
    expect(shouldSkipFreshGenerate({})).toBe('fresh');
  });
});
