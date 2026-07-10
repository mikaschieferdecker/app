import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { MS_PER_DAY, MS_PER_HOUR } from '../time.js';
import { createAddiction } from '../repositories/addictions.js';
import { startCleanPeriod, recordRelapse } from '../repositories/cleanPeriods.js';
import { logCraving } from '../repositories/cravings.js';
import { buildStats, timeBucketOf } from './stats.js';

// A Monday at 00:00 UTC keeps weekday math easy to reason about.
const T0 = '2026-06-01T00:00:00.000Z'; // Monday
const minus = (ms: number) => new Date(Date.parse(T0) - ms).toISOString();
const at = (dayOffset: number, hour: number) =>
  new Date(Date.parse(T0) - dayOffset * MS_PER_DAY + hour * MS_PER_HOUR).toISOString();

function freshDb(): DB {
  return openDb();
}

describe('timeBucketOf', () => {
  it('buckets by UTC hour', () => {
    expect(timeBucketOf('2026-06-01T03:00:00.000Z')).toBe('night');
    expect(timeBucketOf('2026-06-01T09:00:00.000Z')).toBe('morning');
    expect(timeBucketOf('2026-06-01T15:00:00.000Z')).toBe('afternoon');
    expect(timeBucketOf('2026-06-01T21:00:00.000Z')).toBe('evening');
  });
});

describe('buildStats — streak history & relapses', () => {
  it('summarises periods and surfaces relapses as data points', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: minus(40 * MS_PER_DAY) });
    // period 1: 10 days, then relapse
    startCleanPeriod(db, a.id, minus(40 * MS_PER_DAY));
    recordRelapse(db, a.id, { at: minus(30 * MS_PER_DAY), startNew: true });
    // period 2: ongoing, 30 days at asOf

    const stats = buildStats(db, T0);
    const hist = stats.addictions[0]!;
    expect(hist.relapseCount).toBe(1);
    expect(hist.longestDays).toBe(30);
    expect(hist.currentDays).toBe(30);
    expect(hist.periods).toHaveLength(2);
    expect(hist.periods[0]!.ongoing).toBe(false);
    expect(hist.periods[1]!.ongoing).toBe(true);

    expect(stats.relapses).toHaveLength(1);
    expect(stats.relapses[0]!.type).toBe('alcohol');
    expect(stats.relapses[0]!.at).toBe(minus(30 * MS_PER_DAY));
  });
});

describe('buildStats — patterns', () => {
  it('aggregates by time of day, emotion and survival', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'gambling', createdAt: minus(20 * MS_PER_DAY) });
    // three evening cravings (two survived), one morning (survived)
    logCraving(db, { addictionId: a.id, occurredAt: at(1, 21), emotion: 'Stress', survived: true });
    logCraving(db, { addictionId: a.id, occurredAt: at(2, 20), emotion: 'Stress', survived: true });
    logCraving(db, { addictionId: a.id, occurredAt: at(3, 19), emotion: 'Wut', survived: false });
    logCraving(db, { addictionId: a.id, occurredAt: at(4, 9), emotion: 'Langeweile', survived: true });

    const { patterns } = buildStats(db, T0);
    expect(patterns.total).toBe(4);
    expect(patterns.survived).toBe(3);
    expect(patterns.survivalRate).toBeCloseTo(0.75);

    const evening = patterns.byTimeOfDay.find((b) => b.key === 'evening')!;
    expect(evening.total).toBe(3);
    expect(evening.survived).toBe(2);

    expect(patterns.byEmotion[0]).toEqual({ key: 'Stress', total: 2, survived: 2 });
  });
});

describe('buildStats — weekly trend', () => {
  it('bins cravings into 7-day windows, oldest first', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'drugs', createdAt: minus(60 * MS_PER_DAY) });
    logCraving(db, { addictionId: a.id, occurredAt: minus(1 * MS_PER_DAY), survived: true }); // this week
    logCraving(db, { addictionId: a.id, occurredAt: minus(2 * MS_PER_DAY), survived: false }); // this week
    logCraving(db, { addictionId: a.id, occurredAt: minus(9 * MS_PER_DAY), survived: true }); // last week

    const { weekly } = buildStats(db, T0, 3);
    expect(weekly).toHaveLength(3);
    // most recent window is the last element
    expect(weekly[2]!.total).toBe(2);
    expect(weekly[2]!.survived).toBe(1);
    expect(weekly[1]!.total).toBe(1);
    expect(weekly[0]!.total).toBe(0);
  });
});

describe('buildStats — insight', () => {
  it('is null with too little data and a sentence once patterns emerge', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: minus(20 * MS_PER_DAY) });
    logCraving(db, { addictionId: a.id, occurredAt: at(1, 21), emotion: 'Stress', survived: true });
    expect(buildStats(db, T0).insight).toBeNull(); // < 3 cravings

    logCraving(db, { addictionId: a.id, occurredAt: at(2, 20), emotion: 'Stress', survived: true });
    logCraving(db, { addictionId: a.id, occurredAt: at(3, 22), emotion: 'Stress', survived: false });
    const insight = buildStats(db, T0).insight!;
    expect(insight).toContain('abends');
    expect(insight).toContain('Stress');
  });
});
