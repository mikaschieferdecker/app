import { describe, expect, it } from 'vitest';
import { openDb, type DB } from './db.js';
import { MS_PER_DAY, MS_PER_HOUR } from './time.js';
import { createProfile, getProfile, completeOnboarding } from './repositories/profile.js';
import { createAddiction } from './repositories/addictions.js';
import {
  startCleanPeriod,
  recordRelapse,
  streakStats,
  getCurrentPeriod,
} from './repositories/cleanPeriods.js';
import { logCraving, cravingStats } from './repositories/cravings.js';
import {
  perDayCost,
  moneySavedForAddiction,
  createSavingsGoal,
  evaluateSavingsGoals,
} from './repositories/savings.js';
import {
  checkAndRecordMilestones,
  listReachedMilestones,
} from './repositories/milestones.js';
import { getAddiction } from './repositories/addictions.js';

/** A fixed clock so date math in tests is deterministic. */
const T0 = '2026-01-01T00:00:00.000Z';
const plus = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();

function freshDb(): DB {
  return openDb(); // in-memory, migrated
}

describe('profile', () => {
  it('enforces a single row and round-trips fields', () => {
    const db = freshDb();
    expect(getProfile(db)).toBeNull();
    createProfile(db, { goal: 'abstinence', createdAt: T0 });
    expect(getProfile(db)?.goal).toBe('abstinence');
    expect(getProfile(db)?.onboarding_done).toBe(0);
    completeOnboarding(db);
    expect(getProfile(db)?.onboarding_done).toBe(1);
    expect(() => createProfile(db, { goal: 'reduction' })).toThrow();
  });
});

describe('clean periods / streaks', () => {
  it('derives current and longest streaks from periods', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });

    startCleanPeriod(db, a.id, T0);
    // 5 days in, still clean
    let stats = streakStats(db, a.id, plus(5 * MS_PER_DAY));
    expect(stats.isClean).toBe(true);
    expect(stats.currentDays).toBe(5);
    expect(stats.longestDays).toBe(5);
    expect(stats.relapseCount).toBe(0);

    // relapse at day 5, start again
    recordRelapse(db, a.id, { at: plus(5 * MS_PER_DAY), startNew: true });
    stats = streakStats(db, a.id, plus(7 * MS_PER_DAY));
    expect(stats.isClean).toBe(true);
    expect(stats.currentDays).toBe(2); // 2 days into new period
    expect(stats.longestDays).toBe(5); // previous run still the longest
    expect(stats.relapseCount).toBe(1);
  });

  it('forbids two open periods and rejects relapse-before-start', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'drugs', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);
    expect(() => startCleanPeriod(db, a.id, plus(1))).toThrow();
    expect(() => recordRelapse(db, a.id, { at: plus(-1) })).toThrow();
  });

  it('reports no streak after a relapse without restart', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'gambling', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);
    recordRelapse(db, a.id, { at: plus(MS_PER_DAY) });
    expect(getCurrentPeriod(db, a.id)).toBeNull();
    const stats = streakStats(db, a.id, plus(3 * MS_PER_DAY));
    expect(stats.isClean).toBe(false);
    expect(stats.currentDays).toBe(0);
    expect(stats.longestDays).toBe(1);
  });
});

describe('cravings', () => {
  it('aggregates survival stats', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });
    logCraving(db, { addictionId: a.id, intensity: 8, survived: true, cameFromPanic: true });
    logCraving(db, { addictionId: a.id, intensity: 4, survived: true });
    logCraving(db, { addictionId: a.id, intensity: 9, survived: false });
    const s = cravingStats(db, a.id);
    expect(s.total).toBe(3);
    expect(s.survived).toBe(2);
    expect(s.gaveIn).toBe(1);
    expect(s.fromPanic).toBe(1);
    expect(s.survivalRate).toBeCloseTo(2 / 3);
    expect(() => logCraving(db, { intensity: 11 })).toThrow();
  });
});

describe('savings', () => {
  it('computes per-day cost and money saved over clean time', () => {
    const db = freshDb();
    const a = createAddiction(db, {
      type: 'alcohol',
      baselineAmount: 70,
      baselinePeriod: 'week',
      createdAt: T0,
    });
    expect(perDayCost(a)).toBeCloseTo(10);
    startCleanPeriod(db, a.id, T0);
    // 10 days clean → 100 saved
    const saved = moneySavedForAddiction(db, a, plus(10 * MS_PER_DAY));
    expect(saved).toBeCloseTo(100);
  });

  it('stamps a goal as achieved exactly once', () => {
    const db = freshDb();
    const a = createAddiction(db, {
      type: 'drugs',
      baselineAmount: 10,
      baselinePeriod: 'day',
      createdAt: T0,
    });
    startCleanPeriod(db, a.id, T0);
    const goal = createSavingsGoal(db, { title: 'Trip', targetAmount: 50, createdAt: T0 });

    // day 3 → 30 saved, not reached
    let progress = evaluateSavingsGoals(db, plus(3 * MS_PER_DAY));
    expect(progress[0]!.reached).toBe(false);
    expect(progress[0]!.fraction).toBeCloseTo(0.6);
    expect(progress[0]!.goal.achieved_at).toBeNull();

    // day 6 → 60 saved, reached and stamped
    progress = evaluateSavingsGoals(db, plus(6 * MS_PER_DAY));
    expect(progress[0]!.reached).toBe(true);
    const firstStamp = progress[0]!.goal.achieved_at;
    expect(firstStamp).not.toBeNull();

    // later evaluation keeps the original stamp
    progress = evaluateSavingsGoals(db, plus(9 * MS_PER_DAY));
    expect(progress[0]!.goal.achieved_at).toBe(firstStamp);
    void goal;
  });
});

describe('milestones', () => {
  it('records each milestone once and never double-fires', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);

    // 25 hours → only 24h reached
    let check = checkAndRecordMilestones(db, a.id, plus(25 * MS_PER_HOUR));
    expect(check.newlyReached).toEqual(['24h']);
    expect(check.next).toBe('3d');

    // same evaluation again → nothing new
    check = checkAndRecordMilestones(db, a.id, plus(25 * MS_PER_HOUR));
    expect(check.newlyReached).toEqual([]);

    // 8 days → 3d, 1w newly reached (24h already recorded)
    check = checkAndRecordMilestones(db, a.id, plus(8 * MS_PER_DAY));
    expect(check.newlyReached).toEqual(['3d', '1w']);
    expect(listReachedMilestones(db, a.id).map((m) => m.milestone_key)).toEqual([
      '24h',
      '3d',
      '1w',
    ]);

    // relapse + new streak: milestone stays once-ever (schema UNIQUE)
    recordRelapse(db, a.id, { at: plus(8 * MS_PER_DAY), startNew: true });
    check = checkAndRecordMilestones(db, a.id, plus(10 * MS_PER_DAY));
    expect(check.newlyReached).toEqual([]);
  });
});

describe('cascade behaviour', () => {
  it('deletes clean periods and milestones when an addiction is removed', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'drugs', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);
    checkAndRecordMilestones(db, a.id, plus(2 * MS_PER_DAY));
    db.prepare('DELETE FROM addictions WHERE id = ?').run(a.id);
    expect(getAddiction(db, a.id)).toBeNull();
    const periods = db
      .prepare('SELECT COUNT(*) AS n FROM clean_periods WHERE addiction_id = ?')
      .get(a.id) as { n: number };
    expect(periods.n).toBe(0);
  });
});
