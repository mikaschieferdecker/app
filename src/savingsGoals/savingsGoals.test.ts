import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { MS_PER_DAY } from '../time.js';
import { createAddiction } from '../repositories/addictions.js';
import { startCleanPeriod } from '../repositories/cleanPeriods.js';
import { createSavingsGoal } from '../repositories/savings.js';
import { buildSavingsView, dailySavingRate } from './savingsGoals.js';

const T0 = '2026-05-10T00:00:00.000Z';
const minus = (ms: number) => new Date(Date.parse(T0) - ms).toISOString();

function freshDb(): DB {
  return openDb();
}

describe('buildSavingsView', () => {
  it('computes total saved, daily rate and per-goal progress', () => {
    const db = freshDb();
    const a = createAddiction(db, {
      type: 'drugs',
      baselineAmount: 10,
      baselinePeriod: 'day',
      createdAt: minus(6 * MS_PER_DAY),
    });
    startCleanPeriod(db, a.id, minus(6 * MS_PER_DAY)); // 6 days clean -> 60 saved
    const reached = createSavingsGoal(db, { title: 'Kino', targetAmount: 50, createdAt: T0 });
    const open = createSavingsGoal(db, { title: 'Trip', targetAmount: 100, createdAt: T0 });

    const view = buildSavingsView(db, T0);
    expect(view.totalSaved).toBeCloseTo(60);
    expect(view.dailyRate).toBeCloseTo(10);

    const kino = view.goals.find((g) => g.goal.id === reached.id)!;
    expect(kino.reached).toBe(true);
    expect(kino.fraction).toBe(1);
    expect(kino.daysToGo).toBe(0);
    expect(kino.goal.achieved_at).not.toBeNull(); // stamped once

    const trip = view.goals.find((g) => g.goal.id === open.id)!;
    expect(trip.reached).toBe(false);
    expect(trip.fraction).toBeCloseTo(0.6);
    expect(trip.daysToGo).toBe(4); // ceil((100-60)/10)
  });

  it('reports no daily rate (and null daysToGo) without a baseline', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'gambling', createdAt: minus(3 * MS_PER_DAY) });
    startCleanPeriod(db, a.id, minus(3 * MS_PER_DAY));
    createSavingsGoal(db, { title: 'Ziel', targetAmount: 200, createdAt: T0 });

    const view = buildSavingsView(db, T0);
    expect(view.dailyRate).toBe(0);
    expect(view.totalSaved).toBe(0);
    expect(view.goals[0]!.daysToGo).toBeNull();
    expect(view.goals[0]!.reached).toBe(false);
  });

  it('dailySavingRate sums across addictions', () => {
    const db = freshDb();
    createAddiction(db, { type: 'alcohol', baselineAmount: 70, baselinePeriod: 'week', createdAt: T0 }); // 10/day
    createAddiction(db, { type: 'drugs', baselineAmount: 5, baselinePeriod: 'day', createdAt: T0 }); // 5/day
    expect(dailySavingRate(db)).toBeCloseTo(15);
  });
});
