import type { DB } from '../db.js';
import type { CravingLog } from '../types.js';
import { nowIso } from '../time.js';

export interface LogCravingInput {
  addictionId?: number | null;
  occurredAt?: string;
  location?: string | null;
  emotion?: string | null;
  intensity?: number | null;
  trigger?: string | null;
  /** 1 = resisted (default), 0 = led to use. */
  survived?: boolean;
  /** Was this logged from the panic flow? */
  cameFromPanic?: boolean;
}

export function logCraving(db: DB, input: LogCravingInput = {}): CravingLog {
  if (input.intensity != null && (input.intensity < 1 || input.intensity > 10)) {
    throw new Error('intensity must be between 1 and 10');
  }
  const info = db
    .prepare(
      `INSERT INTO craving_logs
         (addiction_id, occurred_at, location, emotion, intensity, trigger, survived, came_from_panic, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.addictionId ?? null,
      input.occurredAt ?? nowIso(),
      input.location ?? null,
      input.emotion ?? null,
      input.intensity ?? null,
      input.trigger ?? null,
      input.survived === false ? 0 : 1,
      input.cameFromPanic ? 1 : 0,
      nowIso(),
    );
  return db
    .prepare('SELECT * FROM craving_logs WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as CravingLog;
}

export interface ListCravingsFilter {
  addictionId?: number;
  /** Inclusive lower bound (ISO) on occurred_at. */
  since?: string;
  /** Inclusive upper bound (ISO) on occurred_at. */
  until?: string;
  limit?: number;
}

/** Lists cravings newest first, with optional filtering. */
export function listCravings(db: DB, filter: ListCravingsFilter = {}): CravingLog[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.addictionId !== undefined) {
    clauses.push('addiction_id = ?');
    params.push(filter.addictionId);
  }
  if (filter.since !== undefined) {
    clauses.push('occurred_at >= ?');
    params.push(filter.since);
  }
  if (filter.until !== undefined) {
    clauses.push('occurred_at <= ?');
    params.push(filter.until);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = filter.limit !== undefined ? 'LIMIT ?' : '';
  if (filter.limit !== undefined) params.push(filter.limit);
  return db
    .prepare(
      `SELECT * FROM craving_logs ${where} ORDER BY occurred_at DESC, id DESC ${limit}`,
    )
    .all(...params) as CravingLog[];
}

export interface CravingStats {
  total: number;
  survived: number;
  gaveIn: number;
  /** Share of cravings resisted, 0..1. Null when there are no logs. */
  survivalRate: number | null;
  fromPanic: number;
}

/** Aggregate survival stats, optionally scoped to one addiction. */
export function cravingStats(db: DB, addictionId?: number): CravingStats {
  const where = addictionId !== undefined ? 'WHERE addiction_id = ?' : '';
  const params = addictionId !== undefined ? [addictionId] : [];
  const row = db
    .prepare(
      `SELECT
         COUNT(*)                                  AS total,
         COALESCE(SUM(survived), 0)                AS survived,
         COALESCE(SUM(came_from_panic), 0)         AS fromPanic
       FROM craving_logs ${where}`,
    )
    .get(...params) as { total: number; survived: number; fromPanic: number };
  return {
    total: row.total,
    survived: row.survived,
    gaveIn: row.total - row.survived,
    survivalRate: row.total === 0 ? null : row.survived / row.total,
    fromPanic: row.fromPanic,
  };
}
