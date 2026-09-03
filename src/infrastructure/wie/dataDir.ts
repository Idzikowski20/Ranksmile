/**
 * Where the file-backed WIE stores live.
 *
 * Resolved per call, not once at import: `WIE_DATA_DIR` lets a test point the stores at a
 * directory of its own. They used to be module-level constants under process.cwd()/data,
 * so every Jest worker read and wrote the same JSON files in parallel — one suite's writes
 * landed in another's assertions, and __tests__/lib/wie/dnaRollback failed roughly one run
 * in four while passing in isolation.
 */
import path from 'path';

export const wieDataDir = (): string => process.env.WIE_DATA_DIR || path.join(process.cwd(), 'data');

export const wieDataPath = (...parts: string[]): string => path.join(wieDataDir(), ...parts);
