import { queryAffected } from '@/src/core/shared/types/db';

describe('queryAffected', () => {
  it('accepts a numeric Sequelize update count', () => {
    expect(queryAffected(1)).toBe(1);
    expect(queryAffected(0)).toBe(0);
  });

  it('reads dialect metadata objects', () => {
    expect(queryAffected({ rowCount: 2 })).toBe(2);
    expect(queryAffected({ affectedRows: 3 })).toBe(3);
    expect(queryAffected({ changes: 1 })).toBe(1);
  });

  it('returns 0 for missing or invalid metadata', () => {
    expect(queryAffected(undefined)).toBe(0);
    expect(queryAffected(null)).toBe(0);
    expect(queryAffected({})).toBe(0);
    expect(queryAffected('1')).toBe(0);
  });
});
