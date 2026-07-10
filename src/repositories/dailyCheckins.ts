import type { DB } from '../db.js';
import type { DailyCheckin } from '../types.js';
import { nowIso, toDateString, type Clock } from '../time.js';

export interface CheckinInput {
  /** Calendar day 'YYYY-MM-DD'. Defaults to today from the injected clock. */
  date?: string;
  /** 1..5, or null to leave unset. */
  mood?: number | null;
  note?: string | null;
}

/**
 * Records (or updates) the check-in for a day. There is at most one row per
 * calendar day: re-checking in the same day overwrites mood/note rather than
 * creating a duplicate.
 */
export function recordCheckin(
  db: DB,
  input: CheckinInput = {},
  clock: Clock = nowIso,
): DailyCheckin {
  if (input.mood != null && (input.mood < 1 || input.mood > 5)) {
    throw new Error('mood must be between 1 and 5');
  }
  const now = clock();
  const date = input.date ?? toDateString(now);
  db.prepare(
    `INSERT INTO daily_checkins (checkin_date, mood, note, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(checkin_date)
       DO UPDATE SET mood = excluded.mood, note = excluded.note`,
  ).run(date, input.mood ?? null, input.note ?? null, now);
  return getCheckin(db, date)!;
}

export function getCheckin(db: DB, date: string): DailyCheckin | null {
  const row = db
    .prepare('SELECT * FROM daily_checkins WHERE checkin_date = ?')
    .get(date) as DailyCheckin | undefined;
  return row ?? null;
}

/** The check-in for today (per the injected clock), or null. */
export function getTodayCheckin(db: DB, clock: Clock = nowIso): DailyCheckin | null {
  return getCheckin(db, toDateString(clock()));
}

export function hasCheckedInToday(db: DB, clock: Clock = nowIso): boolean {
  return getTodayCheckin(db, clock) !== null;
}

export interface ListCheckinsFilter {
  /** Inclusive lower bound on checkin_date. */
  since?: string;
  /** Inclusive upper bound on checkin_date. */
  until?: string;
  limit?: number;
}

/** Lists check-ins, most recent day first. */
export function listCheckins(db: DB, filter: ListCheckinsFilter = {}): DailyCheckin[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.since !== undefined) {
    clauses.push('checkin_date >= ?');
    params.push(filter.since);
  }
  if (filter.until !== undefined) {
    clauses.push('checkin_date <= ?');
    params.push(filter.until);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = filter.limit !== undefined ? 'LIMIT ?' : '';
  if (filter.limit !== undefined) params.push(filter.limit);
  return db
    .prepare(`SELECT * FROM daily_checkins ${where} ORDER BY checkin_date DESC ${limit}`)
    .all(...params) as DailyCheckin[];
}
