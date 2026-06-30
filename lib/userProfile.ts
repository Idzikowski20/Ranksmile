import db from '../database/database';

export type UserProfile = { name: string | null; avatarUrl: string | null; productUpdates: boolean };
type Row = Record<string, any>;

const NOW = 'CURRENT_TIMESTAMP';
let tableChecked = false;

async function select(sql: string, replacements: any[]): Promise<Row[]> {
   const [rows] = await db.query(sql, { replacements }) as [Row[], unknown];
   return rows;
}

/** Per-user editable profile (display name + custom avatar). Idempotent. */
async function ensureTable(): Promise<void> {
   if (tableChecked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
         user_id    TEXT PRIMARY KEY,
         name       TEXT,
         avatar_url TEXT,
         notify_product_updates INTEGER DEFAULT 0,
         updated_at TIMESTAMP DEFAULT ${NOW}
      )
   `);
   // Idempotent add for tables created before this column existed.
   try { await db.query('ALTER TABLE user_profiles ADD COLUMN notify_product_updates INTEGER DEFAULT 0'); } catch { /* already exists */ }
   tableChecked = true;
}

export async function readProfile(userId: string): Promise<UserProfile> {
   await ensureTable();
   const rows = await select('SELECT name, avatar_url, notify_product_updates FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
   const r = rows[0] || {};
   return { name: r.name ?? null, avatarUrl: r.avatar_url ?? null, productUpdates: !!r.notify_product_updates };
}

export async function writeProfile(userId: string, patch: { name?: string; avatarUrl?: string; productUpdates?: boolean }): Promise<UserProfile> {
   await ensureTable();
   const existing = await select('SELECT user_id FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
   if (!existing.length) {
      try { await db.query('INSERT INTO user_profiles (user_id) VALUES (?)', { replacements: [userId] }); } catch { /* possible race — fall through to UPDATE */ }
   }
   const sets: string[] = [];
   const vals: any[] = [];
   if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
   if (patch.avatarUrl !== undefined) { sets.push('avatar_url = ?'); vals.push(patch.avatarUrl); }
   if (patch.productUpdates !== undefined) { sets.push('notify_product_updates = ?'); vals.push(patch.productUpdates ? 1 : 0); }
   if (sets.length) {
      sets.push(`updated_at = ${NOW}`);
      await db.query(`UPDATE user_profiles SET ${sets.join(', ')} WHERE user_id = ?`, { replacements: [...vals, userId] });
   }
   return readProfile(userId);
}
