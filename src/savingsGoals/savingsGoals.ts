import type { DB } from '../db.js';
import { nowIso } from '../time.js';
import { listAddictions } from '../repositories/addictions.js';
import {
  evaluateSavingsGoals,
  perDayCost,
  totalMoneySaved,
  type GoalProgress,
} from '../repositories/savings.js';

export interface SavingsGoalProgress extends GoalProgress {
  /** Whole days until the goal is reached at the current rate; 0 if reached, null if no rate. */
  daysToGo: number | null;
}

export interface SavingsView {
  totalSaved: number;
  /** Combined daily saving rate across all addictions with a baseline. */
  dailyRate: number;
  goals: SavingsGoalProgress[];
}

/** Sum of per-day baseline costs across all addictions that have one configured. */
export function dailySavingRate(db: DB): number {
  return listAddictions(db).reduce((sum, a) => sum + (perDayCost(a) ?? 0), 0);
}

/**
 * View-model for the savings-goals screen. Reuses the tested savings repository:
 * `evaluateSavingsGoals` computes each goal's progress and stamps `achieved_at`
 * exactly once when a goal is met. Adds an estimated time-to-go per goal from the
 * current daily rate. Time is injected via `asOf` for deterministic tests.
 */
export function buildSavingsView(db: DB, asOf: string = nowIso()): SavingsView {
  const dailyRate = dailySavingRate(db);
  const goals: SavingsGoalProgress[] = evaluateSavingsGoals(db, asOf).map((g) => ({
    ...g,
    daysToGo: estimateDaysToGo(g, dailyRate),
  }));
  return { totalSaved: totalMoneySaved(db, asOf), dailyRate, goals };
}

function estimateDaysToGo(goal: GoalProgress, dailyRate: number): number | null {
  if (goal.reached) return 0;
  if (dailyRate <= 0) return null;
  const remaining = goal.goal.target_amount - goal.saved;
  return Math.ceil(remaining / dailyRate);
}
