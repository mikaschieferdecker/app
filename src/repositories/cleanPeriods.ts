import type { DB } from '../db.js';
import type { CleanPeriod } from '../types.js';
import { MS_PER_DAY, nowIso, toMillis } from '../time.js';

/**
 * Opens a new clean period for an addiction.
 *
 * A relapse is the only thing that should end a period, so it is an error to
 * open a second period while one is still running — close the current one via
 * {@link recordRelapse} first (or use its `startNew` option).
 */
export function startCleanPeriod(
  db: DB,
  addictionId: number,
  startedAt: string = nowIso(),
): CleanPeriod {
  const open = getCurrentPeriod(db, addictionId);
  if (open) {
    throw new Error(
      `Addiction ${addictionId} already has an open clean period (id ${open.id}).`,
    );
  }
  const info = db
    .prepare(
      `INSERT INTO clean_periods (addiction_id, started_at, ended_at, end_reason, created_at)
       VALUES (?, ?, NULL, NULL, ?)`,
    )
    .run(addictionId, startedAt, nowIso());
  return db
    .prepare('SELECT * FROM clean_periods WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as CleanPeriod;
}

/** The currently-running (unended) period for an addiction, or null. */
export function getCurrentPeriod(db: DB, addictionId: number): CleanPeriod | null {
  const row = db
    .prepare(
      `SELECT * FROM clean_periods
        WHERE addiction_id = ? AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1`,
    )
    .get(addictionId) as CleanPeriod | undefined;
  return row ?? null;
}

/** All periods for an addiction, oldest first. */
export function listCleanPeriods(db: DB, addictionId: number): CleanPeriod[] {
  return db
    .prepare(
      'SELECT * FROM clean_periods WHERE addiction_id = ? ORDER BY started_at ASC, id ASC',
    )
    .all(addictionId) as CleanPeriod[];
}

export interface RecordRelapseOptions {
  /** When the relapse occurred. Defaults to now. */
  at?: string;
  /**
   * Immediately open a fresh clean period starting at `at`. Useful when the app
   * treats a relapse as "reset and keep going". Defaults to false.
   */
  startNew?: boolean;
}

/**
 * Ends the current clean period with reason 'relapse'.
 * Returns the period that was closed, or null if none was open.
 */
export function recordRelapse(
  db: DB,
  addictionId: number,
  options: RecordRelapseOptions = {},
): CleanPeriod | null {
  const at = options.at ?? nowIso();
  const open = getCurrentPeriod(db, addictionId);
  if (!open) return null;
  if (toMillis(at) < toMillis(open.started_at)) {
    throw new Error('Relapse time cannot be before the period started.');
  }
  db.prepare(
    `UPDATE clean_periods SET ended_at = ?, end_reason = 'relapse' WHERE id = ?`,
  ).run(at, open.id);
  if (options.startNew) startCleanPeriod(db, addictionId, at);
  return db
    .prepare('SELECT * FROM clean_periods WHERE id = ?')
    .get(open.id) as CleanPeriod;
}

/** Duration of a single period in ms, measuring an open period up to `asOf`. */
export function periodDurationMs(period: CleanPeriod, asOf: string = nowIso()): number {
  const end = period.ended_at ? toMillis(period.ended_at) : toMillis(asOf);
  return Math.max(0, end - toMillis(period.started_at));
}

export interface StreakStats {
  /** True while a clean period is currently running. */
  isClean: boolean;
  /** Start of the current period, or null when not clean. */
  currentStartedAt: string | null;
  /** Length of the current period in ms (0 when not clean). */
  currentMs: number;
  /** Whole days of the current streak. */
  currentDays: number;
  /** Longest period ever (including the current one), in ms. */
  longestMs: number;
  /** Whole days of the longest streak. */
  longestDays: number;
  /** Number of relapses (ended periods) recorded. */
  relapseCount: number;
}

/**
 * Computes streak statistics for an addiction — derived entirely from
 * `clean_periods`, never from a stored counter.
 */
export function streakStats(
  db: DB,
  addictionId: number,
  asOf: string = nowIso(),
): StreakStats {
  const periods = listCleanPeriods(db, addictionId);
  const current = periods.find((p) => p.ended_at === null) ?? null;

  const currentMs = current ? periodDurationMs(current, asOf) : 0;
  const longestMs = periods.reduce(
    (max, p) => Math.max(max, periodDurationMs(p, asOf)),
    0,
  );

  return {
    isClean: current !== null,
    currentStartedAt: current?.started_at ?? null,
    currentMs,
    currentDays: Math.floor(currentMs / MS_PER_DAY),
    longestMs,
    longestDays: Math.floor(longestMs / MS_PER_DAY),
    relapseCount: periods.filter((p) => p.ended_at !== null).length,
  };
}
