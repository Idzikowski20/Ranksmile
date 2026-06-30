jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([[], {}]) } }));
import { compactText } from '../../lib/optimizeLog';

describe('compactText', () => {
  it('keeps short text whole and reports its length', () => {
    expect(compactText('hello')).toEqual({ excerpt: 'hello', length: 5 });
  });
  it('truncates long text to max but reports the full length', () => {
    const long = 'x'.repeat(5000);
    const r = compactText(long, 2000);
    expect(r.excerpt.length).toBe(2000);
    expect(r.length).toBe(5000);
  });
  it('handles null/undefined', () => {
    expect(compactText(null)).toEqual({ excerpt: '', length: 0 });
    expect(compactText(undefined)).toEqual({ excerpt: '', length: 0 });
  });
});
