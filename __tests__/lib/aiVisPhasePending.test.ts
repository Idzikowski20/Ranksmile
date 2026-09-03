/** @jest-environment node */
/**
 * Whether a follow-on phase is still worth polling. The marker is the real signal; the
 * other two branches exist so rows written before the markers — or by the inline fallback,
 * which never runs these phases — cannot leave the UI polling every five seconds forever.
 */
import { phasePending } from '@/pages/api/ai-visibility/[slug]/scan-status';

const justNow = () => new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe('phasePending', () => {
   it('is done once the phase wrote its marker', () => {
      expect(phasePending('2026-09-03T06:00:00Z', false, justNow())).toBe(false);
   });

   it('is pending for a fresh scan with no marker and nothing proven', () => {
      expect(phasePending(null, false, justNow())).toBe(true);
   });

   it('accepts counts as proof for rows written before the markers existed', () => {
      expect(phasePending(null, true, hoursAgo(50))).toBe(false);
   });

   it('stops calling a long-finished scan busy, even with nothing to go on', () => {
      // Nobody is coming to write the marker: the phases take minutes, not hours.
      expect(phasePending(null, false, hoursAgo(3))).toBe(false);
   });

   it('keeps polling a scan whose finish time is unknown', () => {
      expect(phasePending(null, false, null)).toBe(true);
      expect(phasePending(null, false, 'not-a-date')).toBe(true);
   });

   it('reads a timezone-less database timestamp as UTC', () => {
      // SQLite's CURRENT_TIMESTAMP has no zone; parsed as local time it can land hours off,
      // flipping the cutoff either way depending on where the process runs.
      const utcNoZone = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
      expect(phasePending(null, false, utcNoZone)).toBe(false); // 3h old → past the window

      const recentNoZone = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace('T', ' ');
      expect(phasePending(null, false, recentNoZone)).toBe(true); // a minute old → still live
   });
});
