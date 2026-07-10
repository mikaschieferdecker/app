import type { MilestoneKey } from './types.js';

/** A clock returning the current time as an ISO string. Injected for testability. */
export type Clock = () => string;

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Current time as an ISO-8601 UTC string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse an ISO timestamp to epoch milliseconds, throwing on invalid input. */
export function toMillis(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return ms;
}

/** The UTC calendar day ('YYYY-MM-DD') of an ISO timestamp. */
export function toDateString(iso: string = nowIso()): string {
  return new Date(toMillis(iso)).toISOString().slice(0, 10);
}

/**
 * Minimum elapsed duration (in ms) required to have reached each milestone.
 * Months are approximated as 30 days and a year as 365 days, matching how these
 * apps typically celebrate "1 month" / "1 year" clean.
 */
export const MILESTONE_THRESHOLDS_MS: Record<MilestoneKey, number> = {
  '24h': 24 * MS_PER_HOUR,
  '3d': 3 * MS_PER_DAY,
  '1w': 7 * MS_PER_DAY,
  '2w': 14 * MS_PER_DAY,
  '1m': 30 * MS_PER_DAY,
  '3m': 90 * MS_PER_DAY,
  '6m': 180 * MS_PER_DAY,
  '1y': 365 * MS_PER_DAY,
};
