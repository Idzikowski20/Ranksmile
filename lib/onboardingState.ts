/**
 * Per-user onboarding state (`user_onboarding`), shared by the survey endpoint and
 * by invitation acceptance so the two can never drift apart on how "done" is written.
 *
 * Deliberately narrow: accepting an invitation must not have to boot the whole
 * article schema just to record that the joiner skips the wizard.
 */
import db from '../database/database';

let tableChecked = false;

/**
 * Duck-typed rather than `instanceof UniqueConstraintError`: importing the error class
 * pulls the real `sequelize` package into every test that touches this module, and its
 * ESM-only `uuid` dependency fails to parse under Jest.
 */
function isDuplicateRow(err: unknown): boolean {
   if (typeof err !== 'object' || err === null) return false;
   const { name, original } = err as { name?: string; original?: { code?: string } };
   // SQLite reports the same collision through Sequelize's generic error wrapper.
   return name === 'SequelizeUniqueConstraintError' || original?.code === '23505';
}

/**
 * "This column already exists" across both dialects — Postgres 42701, SQLite's
 * "duplicate column name" message. Duck-typed for the same reason `isDuplicateRow` is:
 * importing Sequelize's error classes drags the real package into every Jest suite that
 * touches this module.
 *
 * Deliberately narrower than a bare `already exists`: that phrase also covers "relation
 * already exists" and friends, so a genuinely broken DDL would be swallowed as a
 * successful migration while `tableChecked` marks the schema ready.
 */
export function isDuplicateColumn(err: unknown): boolean {
   if (typeof err !== 'object' || err === null) return false;
   const { message, original } = err as { message?: string; original?: { code?: string; message?: string } };
   if (original?.code === '42701') return true;
   return /duplicate column/i.test(`${message ?? ''} ${original?.message ?? ''}`);
}

/** Creates only `user_onboarding`. Also called by `ensureArticlesTables` so there is one DDL. */
export async function ensureUserOnboardingTable(): Promise<void> {
   if (tableChecked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS user_onboarding (
         user_id    TEXT PRIMARY KEY,
         completed  INTEGER DEFAULT 0,
         answers    TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
   `);
   // When the post-onboarding page tour was last dismissed. Added after the table
   // shipped, so it arrives as a migration and re-runs on every cold start.
   //
   // Only "the column is already there" is swallowed: a bare catch would also hide a
   // read-only database or a dropped connection, and `tableChecked` is set right after,
   // so the column would never be retried and every later read of tour_seen_at would
   // fail at runtime instead of here.
   try {
      await db.query('ALTER TABLE user_onboarding ADD COLUMN tour_seen_at TIMESTAMP');
   } catch (err: unknown) {
      if (!isDuplicateColumn(err)) throw err;
   }
   tableChecked = true;
}

/**
 * Whether the user has finished (or skipped) the page tour. Server-side rather than
 * localStorage so the tour does not reappear on every new browser, and so clearing site
 * data cannot silently replay it.
 */
export async function isPageTourSeen(userId: string): Promise<boolean> {
   await ensureUserOnboardingTable();
   const [rows] = await db.query(
      'SELECT tour_seen_at FROM user_onboarding WHERE user_id = ?',
      { replacements: [userId] },
   ) as [Array<{ tour_seen_at: string | null }>, unknown];
   return rows.length > 0 && rows[0].tour_seen_at != null;
}

/**
 * Records that the tour is done. Same insert-then-recover shape as
 * `markOnboardingCompleted`: the user may have no row yet (tour finished before the
 * survey), and two tabs finishing at once must not collide on the primary key.
 */
export async function markPageTourSeen(userId: string): Promise<void> {
   await ensureUserOnboardingTable();
   try {
      await db.query(
         'INSERT INTO user_onboarding (user_id, tour_seen_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
         { replacements: [userId] },
      );
      return;
   } catch (err: unknown) {
      if (!isDuplicateRow(err)) throw err;
   }

   await db.query(
      'UPDATE user_onboarding SET tour_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      { replacements: [userId] },
   );
}

export async function isOnboardingCompleted(userId: string): Promise<boolean> {
   await ensureUserOnboardingTable();
   const [rows] = await db.query(
      'SELECT completed FROM user_onboarding WHERE user_id = ?',
      { replacements: [userId] },
   ) as [Array<{ completed: number | boolean }>, unknown];
   return rows.length > 0 && !!Number(rows[0].completed);
}

/**
 * Marks the wizard done for `userId`.
 *
 * Insert-then-recover rather than check-then-insert: two requests can land here at
 * once (an invitation accepted in two tabs), and the loser of a check-then-insert
 * race would fail on the `user_id` primary key instead of being idempotent.
 *
 * `answers` is only written when passed — invitation acceptance leaves a partially
 * filled survey untouched.
 */
export async function markOnboardingCompleted(userId: string, answers?: string | null): Promise<void> {
   await ensureUserOnboardingTable();
   const writesAnswers = answers !== undefined;

   try {
      await db.query(
         'INSERT INTO user_onboarding (user_id, completed, answers, updated_at) VALUES (?, 1, ?, CURRENT_TIMESTAMP)',
         { replacements: [userId, writesAnswers ? answers : null] },
      );
      return;
   } catch (err: unknown) {
      // Anything other than "this user already has a row" is a real failure.
      if (!isDuplicateRow(err)) throw err;
   }

   await db.query(
      writesAnswers
         ? 'UPDATE user_onboarding SET completed = 1, answers = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
         : 'UPDATE user_onboarding SET completed = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      { replacements: writesAnswers ? [answers, userId] : [userId] },
   );
}
