/** Generic DB row shape returned by Sequelize raw queries. */
export type DbRow = Record<string, unknown>;

export type SqlReplacements = unknown[];

/** Sequelize raw-query metadata — rowCount / affectedRows varies by dialect. */
export type QueryMeta = { affectedRows?: number; changes?: number; rowCount?: number };

export function queryAffected(meta: unknown): number {
   if (typeof meta === 'number' && Number.isFinite(meta)) return Math.max(0, meta);
   if (meta && typeof meta === 'object') {
      const m = meta as QueryMeta;
      const n = m.affectedRows ?? m.changes ?? m.rowCount;
      return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
   }
   return 0;
}
