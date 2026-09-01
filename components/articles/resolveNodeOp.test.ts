import { resolveNodeOp } from './resolveNodeOp';

describe('resolveNodeOp', () => {
  it('replaces the node when the chosen side has HTML', () => {
    expect(resolveNodeOp('<p>new section</p>')).toBe('insert');
  });

  it('deletes the node when the chosen side is empty — accept a deletion / undo an addition', () => {
    expect(resolveNodeOp('')).toBe('delete');
  });
});
