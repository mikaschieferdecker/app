import type { DB } from '../db.js';
import type { AddictionType, CravingLog } from '../types.js';
import { MS_PER_DAY, nowIso, toMillis } from '../time.js';
import { listAddictions } from '../repositories/addictions.js';
import { listCleanPeriods, streakStats } from '../repositories/cleanPeriods.js';
import { listCravings } from '../repositories/cravings.js';
import { ADDICTION_LABELS } from '../home/content.js';
import {
  TIME_BUCKETS,
  TIME_BUCKET_LABELS,
  TIME_BUCKET_PHRASES,
  type TimeBucket,
} from './content.js';

export interface PeriodSummary {
  startedAt: string;
  endedAt: string | null;
  days: number;
  ongoing: boolean;
}

export interface StreakHistory {
  addictionId: number;
  type: AddictionType;
  label: string;
  currentDays: number;
  longestDays: number;
  relapseCount: number;
  periods: PeriodSummary[];
}

export interface BucketCount {
  key: string;
  label: string;
  total: number;
  survived: number;
}

export interface PatternItem {
  key: string;
  total: number;
  survived: number;
}

export interface CravingPatterns {
  total: number;
  survived: number;
  /** Share resisted, 0..1, or null with no data. */
  survivalRate: number | null;
  byTimeOfDay: BucketCount[];
  byWeekday: BucketCount[];
  byEmotion: PatternItem[];
  byLocation: PatternItem[];
}

export interface WeeklyPoint {
  /** ISO date of the window start (7-day window ending at the next point). */
  weekStart: string;
  total: number;
  survived: number;
}

export interface RelapsePoint {
  addictionId: number;
  type: AddictionType;
  label: string;
  at: string;
}

export interface StatsView {
  addictions: StreakHistory[];
  patterns: CravingPatterns;
  weekly: WeeklyPoint[];
  relapses: RelapsePoint[];
  /** A gentle, plain-language observation, or null when there's too little data. */
  insight: string | null;
}

export function timeBucketOf(iso: string): TimeBucket {
  const hour = new Date(toMillis(iso)).getUTCHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** Monday-first weekday index (0 = Mon .. 6 = Sun). */
function weekdayIndex(iso: string): number {
  const dow = new Date(toMillis(iso)).getUTCDay(); // 0 = Sun
  return (dow + 6) % 7;
}

function tally(items: PatternItem[], key: string | null, survived: boolean): void {
  if (!key) return;
  let entry = items.find((i) => i.key === key);
  if (!entry) {
    entry = { key, total: 0, survived: 0 };
    items.push(entry);
  }
  entry.total += 1;
  if (survived) entry.survived += 1;
}

function buildPatterns(cravings: CravingLog[]): CravingPatterns {
  const byTime: BucketCount[] = TIME_BUCKETS.map((b) => ({
    key: b,
    label: TIME_BUCKET_LABELS[b],
    total: 0,
    survived: 0,
  }));
  const byWeekday: BucketCount[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((l) => ({
    key: l,
    label: l,
    total: 0,
    survived: 0,
  }));
  const byEmotion: PatternItem[] = [];
  const byLocation: PatternItem[] = [];

  let survived = 0;
  for (const c of cravings) {
    const won = c.survived === 1;
    if (won) survived += 1;

    const tb = byTime.find((x) => x.key === timeBucketOf(c.occurred_at))!;
    tb.total += 1;
    if (won) tb.survived += 1;

    const wd = byWeekday[weekdayIndex(c.occurred_at)]!;
    wd.total += 1;
    if (won) wd.survived += 1;

    tally(byEmotion, c.emotion, won);
    tally(byLocation, c.location, won);
  }

  const bySize = (a: PatternItem, b: PatternItem): number =>
    b.total - a.total || a.key.localeCompare(b.key);

  return {
    total: cravings.length,
    survived,
    survivalRate: cravings.length === 0 ? null : survived / cravings.length,
    byTimeOfDay: byTime,
    byWeekday,
    byEmotion: byEmotion.sort(bySize),
    byLocation: byLocation.sort(bySize),
  };
}

function buildWeekly(cravings: CravingLog[], asOf: string, weeks: number): WeeklyPoint[] {
  const asOfMs = toMillis(asOf);
  const points: WeeklyPoint[] = [];
  // Oldest window first, so a chart reads left-to-right.
  for (let i = weeks - 1; i >= 0; i--) {
    const start = asOfMs - (i + 1) * 7 * MS_PER_DAY;
    points.push({ weekStart: new Date(start).toISOString(), total: 0, survived: 0 });
  }
  for (const c of cravings) {
    const idx = Math.floor((asOfMs - toMillis(c.occurred_at)) / (7 * MS_PER_DAY));
    if (idx < 0 || idx >= weeks) continue;
    const point = points[weeks - 1 - idx]!;
    point.total += 1;
    if (c.survived === 1) point.survived += 1;
  }
  return points;
}

function buildInsight(patterns: CravingPatterns): string | null {
  if (patterns.total < 3) return null;
  const topTime = patterns.byTimeOfDay
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total)[0];
  if (!topTime) return null;
  const phrase = TIME_BUCKET_PHRASES[topTime.key as TimeBucket];
  const topEmotion = patterns.byEmotion[0];
  const topLocation = patterns.byLocation[0];

  let tail = '';
  if (topEmotion && topEmotion.total >= 2) {
    tail = ` – oft, wenn du „${topEmotion.key}“ fühlst`;
  } else if (topLocation && topLocation.total >= 2) {
    tail = ` – oft ${topLocation.key.toLowerCase()}`;
  }
  return `Deine Cravings häufen sich ${phrase}${tail}.`;
}

/**
 * Builds the progress / statistics view: clean-time history per addiction,
 * craving patterns (time of day, weekday, emotion, location), a weekly craving
 * trend, relapses as data points, and a gentle plain-language insight.
 *
 * Time is injected via `asOf` for deterministic tests. Time-of-day and weekday
 * are bucketed in UTC (the app stores no timezone).
 */
export function buildStats(db: DB, asOf: string = nowIso(), weeks = 6): StatsView {
  const cravings = listCravings(db, { until: asOf });

  const addictions: StreakHistory[] = [];
  const relapses: RelapsePoint[] = [];

  for (const a of listAddictions(db)) {
    const stats = streakStats(db, a.id, asOf);
    const periods = listCleanPeriods(db, a.id).map((p) => {
      const end = p.ended_at ? toMillis(p.ended_at) : toMillis(asOf);
      return {
        startedAt: p.started_at,
        endedAt: p.ended_at,
        days: Math.floor(Math.max(0, end - toMillis(p.started_at)) / MS_PER_DAY),
        ongoing: p.ended_at === null,
      };
    });
    addictions.push({
      addictionId: a.id,
      type: a.type,
      label: ADDICTION_LABELS[a.type],
      currentDays: stats.currentDays,
      longestDays: stats.longestDays,
      relapseCount: stats.relapseCount,
      periods,
    });
    for (const p of listCleanPeriods(db, a.id)) {
      if (p.ended_at && p.end_reason === 'relapse') {
        relapses.push({ addictionId: a.id, type: a.type, label: ADDICTION_LABELS[a.type], at: p.ended_at });
      }
    }
  }

  relapses.sort((x, y) => toMillis(x.at) - toMillis(y.at));
  const patterns = buildPatterns(cravings);

  return {
    addictions,
    patterns,
    weekly: buildWeekly(cravings, asOf, weeks),
    relapses,
    insight: buildInsight(patterns),
  };
}
