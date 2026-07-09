import type { DB } from '../db.js';
import type { CleanPeriod, MilestoneKey, MilestoneReached } from '../types.js';
import { MILESTONE_KEYS } from '../types.js';
import { MILESTONE_THRESHOLDS_MS, nowIso } from '../time.js';
import { getCurrentPeriod, periodDurationMs } from './cleanPeriods.js';

/** All milestones ever recorded for an addiction (across every period), oldest first. */
export function listReachedMilestones(db: DB, addictionId: number): MilestoneReached[] {
  return db
    .prepare(
      'SELECT * FROM milestones_reached WHERE addiction_id = ? ORDER BY reached_at ASC, id ASC',
    )
    .all(addictionId) as MilestoneReached[];
}

/** Milestones recorded within a single clean period, in canonical order. */
export function listPeriodMilestones(db: DB, cleanPeriodId: number): MilestoneReached[] {
  return db
    .prepare(
      'SELECT * FROM milestones_reached WHERE clean_period_id = ? ORDER BY reached_at ASC, id ASC',
    )
    .all(cleanPeriodId) as MilestoneReached[];
}

export interface MilestoneCheck {
  /** Keys crossed for the first time *in the current period* — celebrate these once. */
  newlyReached: MilestoneKey[];
  /** All keys reached in the current period, in canonical order. */
  reached: MilestoneKey[];
  /** The next key not yet reached in this period, or null once all are done. */
  next: MilestoneKey | null;
}

/**
 * Evaluates the current clean period against the milestone thresholds and records
 * any newly-crossed ones, scoped to that period.
 *
 * Milestones are per clean period: after a relapse a new period begins with no
 * milestones, so the same key (e.g. '24h') can be reached and celebrated again.
 * Within one period the schema's UNIQUE(clean_period_id, milestone_key) keeps
 * this idempotent, so the celebration animation never double-fires.
 *
 * Returns an all-empty result when there is no running period (i.e. after a
 * relapse with no restart), since there is nothing to celebrate.
 */
export function checkAndRecordMilestones(
  db: DB,
  addictionId: number,
  asOf: string = nowIso(),
): MilestoneCheck {
  const period = getCurrentPeriod(db, addictionId);
  if (!period) return { newlyReached: [], reached: [], next: MILESTONE_KEYS[0] };

  const elapsedMs = periodDurationMs(period, asOf);
  const already = new Set(
    listPeriodMilestones(db, period.id).map((m) => m.milestone_key),
  );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO milestones_reached (clean_period_id, addiction_id, milestone_key, reached_at)
     VALUES (?, ?, ?, ?)`,
  );

  const newlyReached: MilestoneKey[] = [];
  for (const key of MILESTONE_KEYS) {
    if (elapsedMs < MILESTONE_THRESHOLDS_MS[key] || already.has(key)) continue;
    const info = insert.run(period.id, addictionId, key, asOf);
    if (info.changes > 0) newlyReached.push(key);
  }

  const reached = MILESTONE_KEYS.filter(
    (key) => already.has(key) || newlyReached.includes(key),
  );
  const next = MILESTONE_KEYS.find((key) => !reached.includes(key)) ?? null;

  return { newlyReached, reached, next };
}
