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
   tableChecked = true;
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
