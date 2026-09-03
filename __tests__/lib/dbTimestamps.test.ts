/** @jest-environment node */
/**
 * Both database shapes, because getting this wrong is silent: a bare SQLite timestamp read
 * as local time shifts every comparison against Date.now() by the process offset — enough
 * to make a fresh single-flight claim look abandoned and pay for a second generation.
 */
import { parseDbTimestamp } from '@/src/infrastructure/db/timestamps';

describe('parseDbTimestamp', () => {
   it('reads SQLite text with no zone as UTC', () => {
      expect(parseDbTimestamp('2026-09-03 10:00:00')).toBe(Date.UTC(2026, 8, 3, 10, 0, 0));
   });

   it('accepts a Date, which is what node-pg returns', () => {
      const d = new Date('2026-09-03T10:00:00Z');
      expect(parseDbTimestamp(d)).toBe(d.getTime());
   });

   it('leaves an explicit offset alone', () => {
      expect(parseDbTimestamp('2026-09-03T10:00:00Z')).toBe(Date.UTC(2026, 8, 3, 10, 0, 0));
      expect(parseDbTimestamp('2026-09-03T12:00:00+02:00')).toBe(Date.UTC(2026, 8, 3, 10, 0, 0));
   });

   it('is NaN for nothing and for junk, so callers can branch on it', () => {
      expect(Number.isNaN(parseDbTimestamp(null))).toBe(true);
      expect(Number.isNaN(parseDbTimestamp(undefined))).toBe(true);
      expect(Number.isNaN(parseDbTimestamp(''))).toBe(true);
      expect(Number.isNaN(parseDbTimestamp(42))).toBe(true);
      expect(Number.isNaN(parseDbTimestamp('not a date'))).toBe(true);
   });
});
