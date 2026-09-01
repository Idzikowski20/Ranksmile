/** Generic DB row shape returned by Sequelize raw queries. */
export type DbRow = Record<string, unknown>;

export type SqlReplacements = unknown[];

/** Sequelize raw-query metadata — rowCount / affectedRows varies by dialect. */
export type QueryMeta = { affectedRows?: number; changes?: number; rowCount?: number };

export function queryAffected(meta: unknown): number {
   if (meta && typeof meta === 'object') {
      const m = meta as QueryMeta;
      return m.affectedRows ?? m.changes ?? (typeof m.rowCount === 'number' ? m.rowCount : 0);
   }
   return 0;
}
