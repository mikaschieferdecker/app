import type { DB } from '../db.js';
import type { MilestoneKey, MilestoneReached } from '../types.js';
import { MILESTONE_KEYS } from '../types.js';
import { MILESTONE_THRESHOLDS_MS, nowIso } from '../time.js';
import { streakStats } from './cleanPeriods.js';

/** Milestones already recorded for an addiction, oldest first. */
export function listReachedMilestones(db: DB, addictionId: number): MilestoneReached[] {
  return db
    .prepare(
      'SELECT * FROM milestones_reached WHERE addiction_id = ? ORDER BY reached_at ASC, id ASC',
    )
    .all(addictionId) as MilestoneReached[];
}

export interface MilestoneCheck {
  /** Keys crossed for the first time on this call — celebrate these once. */
  newlyReached: MilestoneKey[];
  /** All keys ever reached for this addiction, in canonical order. */
  reached: MilestoneKey[];
  /** The next key not yet reached, or null once all are done. */
  next: MilestoneKey | null;
}

/**
 * Evaluates the current streak against the milestone thresholds and records any
 * newly-crossed ones. The schema's UNIQUE(addiction_id, milestone_key) makes
 * this idempotent — a milestone is recorded (and returned as "newly reached")
 * exactly once, so the celebration animation never double-fires.
 */
export function checkAndRecordMilestones(
  db: DB,
  addictionId: number,
  asOf: string = nowIso(),
): MilestoneCheck {
  const { currentMs } = streakStats(db, addictionId, asOf);
  const already = new Set(
    listReachedMilestones(db, addictionId).map((m) => m.milestone_key),
  );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO milestones_reached (addiction_id, milestone_key, reached_at)
     VALUES (?, ?, ?)`,
  );

  const newlyReached: MilestoneKey[] = [];
  for (const key of MILESTONE_KEYS) {
    if (currentMs < MILESTONE_THRESHOLDS_MS[key] || already.has(key)) continue;
    const info = insert.run(addictionId, key, asOf);
    if (info.changes > 0) newlyReached.push(key);
  }

  const reached = MILESTONE_KEYS.filter(
    (key) => already.has(key) || newlyReached.includes(key),
  );
  const next = MILESTONE_KEYS.find((key) => !reached.includes(key)) ?? null;

  return { newlyReached, reached, next };
}
