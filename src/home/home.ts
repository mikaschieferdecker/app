import type { DB } from '../db.js';
import type { Addiction, AddictionType, Goal, MilestoneKey } from '../types.js';
import { MILESTONE_KEYS } from '../types.js';
import { MILESTONE_THRESHOLDS_MS, MS_PER_DAY, nowIso, toDateString, toMillis } from '../time.js';
import { listAddictions } from '../repositories/addictions.js';
import { getCurrentPeriod, streakStats } from '../repositories/cleanPeriods.js';
import { moneySavedForAddiction } from '../repositories/savings.js';
import { listPeriodMilestones } from '../repositories/milestones.js';
import { cravingStats, listCravings } from '../repositories/cravings.js';
import { listContacts } from '../repositories/contacts.js';
import { listReasons } from '../repositories/reasons.js';
import { getProfile } from '../repositories/profile.js';
import { getCheckin } from '../repositories/dailyCheckins.js';
import { ADDICTION_LABELS, MILESTONE_LABELS } from './content.js';

export interface NextMilestone {
  key: MilestoneKey;
  label: string;
  /** Days of clean time required to reach it. */
  atDays: number;
  /** Whole days still to go from the current streak. */
  daysRemaining: number;
}

export interface HomeAddictionCard {
  addictionId: number;
  type: AddictionType;
  label: string;
  isClean: boolean;
  currentDays: number;
  currentStreakStartedAt: string | null;
  longestDays: number;
  relapseCount: number;
  moneySaved: number;
  /** Next milestone to aim for, or null once all are reached. */
  nextMilestone: NextMilestone | null;
  /** Milestone keys already reached in the current period. */
  reachedMilestones: MilestoneKey[];
}

export interface HomeView {
  goal: Goal | null;
  cards: HomeAddictionCard[];
  /** The addiction with the longest current streak — the dashboard's hero. */
  hero: HomeAddictionCard | null;
  totalMoneySaved: number;
  cravingWinsThisWeek: number;
  cravingWinsAllTime: number;
  checkin: { checkedInToday: boolean; date: string; mood: number | null };
  panic: { contactCount: number; reasonCount: number };
}

/** The next unreached milestone for a given amount of elapsed clean time. */
export function computeNextMilestone(currentMs: number): NextMilestone | null {
  for (const key of MILESTONE_KEYS) {
    const threshold = MILESTONE_THRESHOLDS_MS[key];
    if (currentMs < threshold) {
      return {
        key,
        label: MILESTONE_LABELS[key],
        atDays: Math.round(threshold / MS_PER_DAY),
        daysRemaining: Math.ceil((threshold - currentMs) / MS_PER_DAY),
      };
    }
  }
  return null;
}

function buildCard(db: DB, addiction: Addiction, asOf: string): HomeAddictionCard {
  const stats = streakStats(db, addiction.id, asOf);
  const period = getCurrentPeriod(db, addiction.id);
  const reached = period
    ? listPeriodMilestones(db, period.id).map((m) => m.milestone_key)
    : [];
  return {
    addictionId: addiction.id,
    type: addiction.type,
    label: ADDICTION_LABELS[addiction.type],
    isClean: stats.isClean,
    currentDays: stats.currentDays,
    currentStreakStartedAt: stats.currentStartedAt,
    longestDays: stats.longestDays,
    relapseCount: stats.relapseCount,
    moneySaved: moneySavedForAddiction(db, addiction, asOf),
    nextMilestone: computeNextMilestone(stats.currentMs),
    reachedMilestones: reached,
  };
}

/**
 * Assembles everything the home dashboard renders, derived from the tested
 * repositories. Time comes from the injected `asOf` (default now) so the view
 * is deterministic in tests.
 */
export function buildHome(db: DB, asOf: string = nowIso()): HomeView {
  const profile = getProfile(db);
  const cards = listAddictions(db).map((a) => buildCard(db, a, asOf));

  const hero =
    cards.length === 0
      ? null
      : cards.reduce((best, c) => (c.currentDays > best.currentDays ? c : best));

  const weekAgo = new Date(toMillis(asOf) - 7 * MS_PER_DAY).toISOString();
  const cravingWinsThisWeek = listCravings(db, { since: weekAgo, until: asOf }).filter(
    (c) => c.survived === 1,
  ).length;

  const checkin = getCheckin(db, toDateString(asOf));

  return {
    goal: profile?.goal ?? null,
    cards,
    hero,
    totalMoneySaved: cards.reduce((sum, c) => sum + c.moneySaved, 0),
    cravingWinsThisWeek,
    cravingWinsAllTime: cravingStats(db).survived,
    checkin: {
      checkedInToday: checkin !== null,
      date: toDateString(asOf),
      mood: checkin?.mood ?? null,
    },
    panic: {
      contactCount: listContacts(db).length,
      reasonCount: listReasons(db).length,
    },
  };
}
