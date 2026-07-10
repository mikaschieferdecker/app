import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { MS_PER_DAY } from '../time.js';
import { createProfile } from '../repositories/profile.js';
import { createAddiction } from '../repositories/addictions.js';
import { startCleanPeriod, recordRelapse } from '../repositories/cleanPeriods.js';
import { logCraving } from '../repositories/cravings.js';
import { createContact } from '../repositories/contacts.js';
import { createReason } from '../repositories/reasons.js';
import { checkAndRecordMilestones } from '../repositories/milestones.js';
import {
  recordCheckin,
  hasCheckedInToday,
  listCheckins,
} from '../repositories/dailyCheckins.js';
import { buildHome, computeNextMilestone } from './home.js';

const T0 = '2026-03-01T00:00:00.000Z';
const clock = () => T0;
const minus = (ms: number) => new Date(Date.parse(T0) - ms).toISOString();

function freshDb(): DB {
  return openDb();
}

describe('daily check-in', () => {
  it('keeps one row per day and updates on re-check-in', () => {
    const db = freshDb();
    expect(hasCheckedInToday(db, clock)).toBe(false);

    recordCheckin(db, { mood: 3 }, clock);
    recordCheckin(db, { mood: 5, note: 'besserer Tag' }, clock);

    const rows = listCheckins(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.mood).toBe(5);
    expect(rows[0]!.note).toBe('besserer Tag');
    expect(hasCheckedInToday(db, clock)).toBe(true);
  });

  it('rejects a mood outside 1..5', () => {
    const db = freshDb();
    expect(() => recordCheckin(db, { mood: 6 }, clock)).toThrow();
    expect(() => recordCheckin(db, { mood: 0 }, clock)).toThrow();
  });
});

describe('computeNextMilestone', () => {
  it('points at the next unreached threshold', () => {
    expect(computeNextMilestone(0)?.key).toBe('24h');
    expect(computeNextMilestone(10 * MS_PER_DAY)?.key).toBe('2w');
    expect(computeNextMilestone(10 * MS_PER_DAY)?.daysRemaining).toBe(4);
    expect(computeNextMilestone(400 * MS_PER_DAY)).toBeNull(); // past 1y
  });
});

describe('buildHome', () => {
  it('summarises a single clean addiction', () => {
    const db = freshDb();
    createProfile(db, { goal: 'abstinence', onboardingDone: true, createdAt: T0 });
    const a = createAddiction(db, {
      type: 'alcohol',
      baselineAmount: 70,
      baselinePeriod: 'week',
      createdAt: minus(10 * MS_PER_DAY),
    });
    startCleanPeriod(db, a.id, minus(10 * MS_PER_DAY));

    const home = buildHome(db, T0);
    expect(home.goal).toBe('abstinence');
    expect(home.hero?.currentDays).toBe(10);
    expect(home.hero?.isClean).toBe(true);
    expect(home.hero?.moneySaved).toBeCloseTo(100);
    expect(home.totalMoneySaved).toBeCloseTo(100);
    expect(home.hero?.nextMilestone?.key).toBe('2w');
    expect(home.hero?.nextMilestone?.daysRemaining).toBe(4);
    expect(home.hero?.reachedMilestones).toEqual([]); // nothing recorded yet

    // once milestones are recorded they show up on the card
    checkAndRecordMilestones(db, a.id, T0);
    expect(buildHome(db, T0).hero?.reachedMilestones).toEqual(['24h', '3d', '1w']);
  });

  it('counts craving wins this week and all time', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'gambling', createdAt: minus(30 * MS_PER_DAY) });
    startCleanPeriod(db, a.id, minus(30 * MS_PER_DAY));

    logCraving(db, { addictionId: a.id, occurredAt: minus(1 * MS_PER_DAY), survived: true });
    logCraving(db, { addictionId: a.id, occurredAt: minus(2 * MS_PER_DAY), survived: true });
    logCraving(db, { addictionId: a.id, occurredAt: minus(2 * MS_PER_DAY), survived: false });
    logCraving(db, { addictionId: a.id, occurredAt: minus(20 * MS_PER_DAY), survived: true }); // old

    const home = buildHome(db, T0);
    expect(home.cravingWinsThisWeek).toBe(2);
    expect(home.cravingWinsAllTime).toBe(3);
  });

  it('reflects the daily check-in and panic resources', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);
    createContact(db, { name: 'Sam' });
    createReason(db, { text: 'Für meine Tochter', createdAt: T0 });
    createReason(db, { text: 'Klarer Kopf', createdAt: T0 });

    let home = buildHome(db, T0);
    expect(home.checkin.checkedInToday).toBe(false);
    expect(home.panic).toEqual({ contactCount: 1, reasonCount: 2 });

    recordCheckin(db, { mood: 4 }, clock);
    home = buildHome(db, T0);
    expect(home.checkin.checkedInToday).toBe(true);
    expect(home.checkin.mood).toBe(4);
  });

  it('picks the longest current streak as the hero across addictions', () => {
    const db = freshDb();
    const alcohol = createAddiction(db, { type: 'alcohol', createdAt: minus(5 * MS_PER_DAY) });
    startCleanPeriod(db, alcohol.id, minus(5 * MS_PER_DAY));
    const gambling = createAddiction(db, { type: 'gambling', createdAt: minus(12 * MS_PER_DAY) });
    startCleanPeriod(db, gambling.id, minus(12 * MS_PER_DAY));

    const home = buildHome(db, T0);
    expect(home.cards).toHaveLength(2);
    expect(home.hero?.type).toBe('gambling');
    expect(home.hero?.currentDays).toBe(12);
  });

  it('shows a non-clean addiction as day 0 aiming at the first milestone', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'drugs', createdAt: minus(10 * MS_PER_DAY) });
    startCleanPeriod(db, a.id, minus(10 * MS_PER_DAY));
    recordRelapse(db, a.id, { at: minus(1 * MS_PER_DAY) }); // no restart

    const card = buildHome(db, T0).cards[0]!;
    expect(card.isClean).toBe(false);
    expect(card.currentDays).toBe(0);
    expect(card.relapseCount).toBe(1);
    expect(card.nextMilestone?.key).toBe('24h');
  });
});
