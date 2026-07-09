import type { DB } from '../db.js';
import type { Addiction, SavingsGoal } from '../types.js';
import { MS_PER_DAY, nowIso, toMillis } from '../time.js';
import { listAddictions } from './addictions.js';
import { listCleanPeriods, periodDurationMs } from './cleanPeriods.js';

const PERIOD_DAYS = { day: 1, week: 7, month: 30 } as const;

/**
 * The baseline cost per day for an addiction, or null when its baseline isn't
 * configured. Months are treated as 30 days to match the schema's period units.
 */
export function perDayCost(addiction: Addiction): number | null {
  if (addiction.baseline_amount == null || addiction.baseline_period == null) {
    return null;
  }
  return addiction.baseline_amount / PERIOD_DAYS[addiction.baseline_period];
}

/**
 * Total money saved for one addiction: its per-day cost multiplied by the total
 * number of clean days across all clean periods (open periods counted up to
 * `asOf`). Returns 0 when the baseline isn't configured.
 */
export function moneySavedForAddiction(
  db: DB,
  addiction: Addiction,
  asOf: string = nowIso(),
): number {
  const perDay = perDayCost(addiction);
  if (perDay == null) return 0;
  const totalMs = listCleanPeriods(db, addiction.id).reduce(
    (sum, p) => sum + periodDurationMs(p, asOf),
    0,
  );
  return perDay * (totalMs / MS_PER_DAY);
}

/** Money saved across every addiction with a configured baseline. */
export function totalMoneySaved(db: DB, asOf: string = nowIso()): number {
  return listAddictions(db).reduce(
    (sum, a) => sum + moneySavedForAddiction(db, a, asOf),
    0,
  );
}

export interface CreateGoalInput {
  title: string;
  targetAmount: number;
  createdAt?: string;
}

export function createSavingsGoal(db: DB, input: CreateGoalInput): SavingsGoal {
  if (input.targetAmount <= 0) throw new Error('targetAmount must be positive');
  const info = db
    .prepare(
      `INSERT INTO savings_goals (title, target_amount, achieved_at, created_at)
       VALUES (?, ?, NULL, ?)`,
    )
    .run(input.title, input.targetAmount, input.createdAt ?? nowIso());
  return db
    .prepare('SELECT * FROM savings_goals WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as SavingsGoal;
}

export function listSavingsGoals(db: DB): SavingsGoal[] {
  return db
    .prepare('SELECT * FROM savings_goals ORDER BY created_at ASC, id ASC')
    .all() as SavingsGoal[];
}

export function deleteSavingsGoal(db: DB, id: number): void {
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
}

export interface GoalProgress {
  goal: SavingsGoal;
  saved: number;
  /** Progress toward the target, clamped to 0..1. */
  fraction: number;
  reached: boolean;
}

/**
 * Progress for every goal given the current total savings. Goals that have just
 * crossed their target are stamped with `achieved_at` (once) so the UI can
 * celebrate exactly once; already-achieved goals keep their original stamp.
 */
export function evaluateSavingsGoals(db: DB, asOf: string = nowIso()): GoalProgress[] {
  const saved = totalMoneySaved(db, asOf);
  const stamp = db.prepare(
    'UPDATE savings_goals SET achieved_at = ? WHERE id = ? AND achieved_at IS NULL',
  );
  return listSavingsGoals(db).map((goal) => {
    const reached = saved >= goal.target_amount;
    let achievedAt = goal.achieved_at;
    if (reached && achievedAt == null) {
      const at = toMillis(asOf) >= 0 ? asOf : nowIso();
      stamp.run(at, goal.id);
      achievedAt = at;
    }
    return {
      goal: { ...goal, achieved_at: achievedAt },
      saved,
      fraction: Math.min(1, saved / goal.target_amount),
      reached,
    };
  });
}
