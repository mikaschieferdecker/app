import type { DB } from '../db.js';
import type { CravingLog } from '../types.js';
import { MS_PER_DAY, nowIso, toMillis, type Clock } from '../time.js';
import { cravingStats, listCravings, logCraving } from '../repositories/cravings.js';

export interface QuickCravingInput {
  addictionId?: number | null;
  /** When it happened. Defaults to now from the injected clock. */
  occurredAt?: string;
  location?: string | null;
  emotion?: string | null;
  intensity?: number | null; // 1..10
  trigger?: string | null;
  /** Did the user resist? Defaults to true (a logged-and-survived craving). */
  survived?: boolean;
}

/**
 * Logs a craving from the standalone quick-log screen — i.e. not from the panic
 * flow, so came_from_panic = 0. Defaults are chosen for a sub-20-second entry:
 * occurred just now, and survived unless stated otherwise.
 */
export function quickLogCraving(
  db: DB,
  input: QuickCravingInput = {},
  clock: Clock = nowIso,
): CravingLog {
  return logCraving(db, {
    addictionId: input.addictionId ?? null,
    occurredAt: input.occurredAt ?? clock(),
    location: input.location ?? null,
    emotion: input.emotion ?? null,
    intensity: input.intensity ?? null,
    trigger: input.trigger ?? null,
    survived: input.survived ?? true,
    cameFromPanic: false,
  });
}

export interface CravingLogView {
  recent: CravingLog[];
  totalAllTime: number;
  survivedAllTime: number;
  weekTotal: number;
  weekWins: number;
}

/**
 * View-model for the craving-log screen: the most recent entries plus a small
 * this-week summary. Time is injected via `asOf` for deterministic tests.
 */
export function buildCravingLogView(
  db: DB,
  asOf: string = nowIso(),
  limit = 10,
): CravingLogView {
  const weekAgo = new Date(toMillis(asOf) - 7 * MS_PER_DAY).toISOString();
  const week = listCravings(db, { since: weekAgo, until: asOf });
  const stats = cravingStats(db);
  return {
    recent: listCravings(db, { until: asOf, limit }),
    totalAllTime: stats.total,
    survivedAllTime: stats.survived,
    weekTotal: week.length,
    weekWins: week.filter((c) => c.survived === 1).length,
  };
}
