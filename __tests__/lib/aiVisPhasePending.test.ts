/** @jest-environment node */
/**
 * Whether a follow-on phase is still worth polling. The marker is the real signal; the
 * other two branches exist so rows written before the markers — or by the inline fallback,
 * which never runs these phases — cannot leave the UI polling every five seconds forever.
 */
import { phaseState } from '@/pages/api/ai-visibility/[slug]/scan-status';

const justNow = () => new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe('phaseState', () => {
   it('is done once the phase wrote its marker', () => {
      expect(phaseState('2026-09-03T06:00:00Z', false, justNow())).toEqual({ done: true, pending: false });
   });

   it('is pending for a fresh scan with no marker and nothing proven', () => {
      expect(phaseState(null, false, justNow())).toEqual({ done: false, pending: true });
   });

   it('accepts counts as proof for rows written before the markers existed', () => {
      expect(phaseState(null, true, hoursAgo(50))).toEqual({ done: true, pending: false });
   });

   it('keeps polling while the phase is still writing, however old the scan is', () => {
      // Reading 176 pages runs far longer than any scan-relative window. Keyed off the
      // scan's finish time this went to pending:false mid-phase, the interval returned
      // false, and the UI only updated on a manual reload.
      expect(phaseState(null, false, hoursAgo(2), justNow()))
         .toEqual({ done: false, pending: true });
      // Minutes of silence is still alive; the grace window is five.
      expect(phaseState(null, false, hoursAgo(2), new Date(Date.now() - 60_000)).pending).toBe(true);
   });

   it('gives up on a phase that has written nothing for the grace period', () => {
      expect(phaseState(null, false, hoursAgo(2), hoursAgo(1)))
         .toEqual({ done: false, pending: false });
   });

   it('stops calling a long-finished scan busy, even with nothing to go on', () => {
      // Nobody is coming to write the marker: the phases take minutes, not hours. It stops
      // being polled, but it must NOT claim to be done — a green tick on a phase that never
      // ran is what this split exists to prevent.
      expect(phaseState(null, false, hoursAgo(3))).toEqual({ done: false, pending: false });
   });

   it('keeps polling a scan whose finish time is unknown', () => {
      expect(phaseState(null, false, null)).toEqual({ done: false, pending: true });
      expect(phaseState(null, false, 'not-a-date')).toEqual({ done: false, pending: true });
   });

   it('reads a timezone-less database timestamp as UTC', () => {
      // SQLite's CURRENT_TIMESTAMP has no zone; parsed as local time it can land hours off,
      // flipping the cutoff either way depending on where the process runs.
      const utcNoZone = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
      expect(phaseState(null, false, utcNoZone).pending).toBe(false); // 3h old → past the window

      const recentNoZone = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace('T', ' ');
      expect(phaseState(null, false, recentNoZone).pending).toBe(true); // a minute old → still live
   });

   it('accepts a Date, which is what node-pg returns for a timestamp column', () => {
      // The column is typed as string, but Postgres hands back a Date — calling string
      // methods on it threw and turned every completed scan-status request into a 500.
      expect(phaseState(null, false, new Date(Date.now() - 3 * 3600_000)).pending).toBe(false);
      expect(phaseState(null, false, new Date()).pending).toBe(true);
      expect(phaseState(new Date(), false, new Date()).done).toBe(true);
   });
});
