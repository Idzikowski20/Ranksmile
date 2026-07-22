/**
 * Persist calibration models (Feature Store vectors, no LLM ranking).
 */
import db from '../../database/database';
import type { CalibrationModel } from '../engines/calibration';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';

export async function ensureCalibrationTables(): Promise<void> {
  if (checked) return;
  await db
    .query(
      `CREATE TABLE IF NOT EXISTS calibration_models (
      id ${PK},
      workspace_id TEXT NOT NULL,
      weights_json ${JSON_T} NOT NULL,
      bias REAL NOT NULL,
      samples INTEGER DEFAULT 0,
      version INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    )
    .catch(() => undefined);
  await db
    .query(
      `CREATE INDEX IF NOT EXISTS idx_calibration_ws ON calibration_models (workspace_id, version)`,
    )
    .catch(() => undefined);
  checked = true;
}

export async function saveCalibrationModel(
  workspaceId: string,
  model: CalibrationModel,
): Promise<void> {
  await ensureCalibrationTables();
  await db.query(
    `INSERT INTO calibration_models (workspace_id, weights_json, bias, samples, version)
     VALUES (?, ?, ?, ?, ?)`,
    {
      replacements: [
        workspaceId,
        JSON.stringify(model.weights),
        model.bias,
        model.samples,
        model.version,
      ],
    },
  );
}

export async function loadLatestCalibration(
  workspaceId: string,
): Promise<CalibrationModel | null> {
  await ensureCalibrationTables();
  const [rows] = await db.query(
    `SELECT * FROM calibration_models WHERE workspace_id = ? ORDER BY version DESC LIMIT 1`,
    { replacements: [workspaceId] },
  );
  const r = (rows as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  const weights =
    typeof r.weights_json === 'string'
      ? (JSON.parse(r.weights_json) as number[])
      : (r.weights_json as number[]);
  return {
    weights: Array.isArray(weights) ? weights : [],
    bias: Number(r.bias ?? 50),
    samples: Number(r.samples ?? 0),
    version: Number(r.version ?? 0),
  };
}
