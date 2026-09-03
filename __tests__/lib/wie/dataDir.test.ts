/** @jest-environment node */
/**
 * The linchpin of WIE store isolation: every store path resolves through this, per call,
 * so a test (via jest.setup) can point them at a directory of its own. Module-level
 * constants under the repo's data dir are what made parallel suites read each other's
 * writes — see the comment in dataDir.ts.
 */
import path from 'path';
import { wieDataDir, wieDataPath } from '@/src/infrastructure/wie/dataDir';

describe('wieDataDir', () => {
   const saved = process.env.WIE_DATA_DIR;
   afterEach(() => { process.env.WIE_DATA_DIR = saved; });

   it('honours WIE_DATA_DIR', () => {
      process.env.WIE_DATA_DIR = path.join('/tmp', 'wie-x');
      expect(wieDataDir()).toBe(path.join('/tmp', 'wie-x'));
      expect(wieDataPath('a.json')).toBe(path.join('/tmp', 'wie-x', 'a.json'));
   });

   it('falls back to the working directory when unset', () => {
      delete process.env.WIE_DATA_DIR;
      expect(wieDataDir()).toBe(path.join(process.cwd(), 'data'));
   });

   it('re-reads the variable on every call, so a store cannot latch a stale path', () => {
      process.env.WIE_DATA_DIR = '/tmp/one';
      const first = wieDataDir();
      process.env.WIE_DATA_DIR = '/tmp/two';
      expect(wieDataDir()).not.toBe(first);
   });

   it('is pointed at a per-test-file directory by jest.setup', () => {
      // Proves the isolation is actually in force for this run, not just available.
      expect(saved).toBeTruthy();
      expect(saved).toContain('ranksmile-wie-');
   });
});
