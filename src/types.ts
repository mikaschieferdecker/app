// Domain types mirroring the SQLite schema in schema.sql.
// All timestamps are ISO-8601 strings (UTC).

export type Goal = 'abstinence' | 'reduction';
export type AddictionType = 'drugs' | 'gambling' | 'alcohol';
export type BaselinePeriod = 'day' | 'week' | 'month';
export type EndReason = 'relapse';

/** Milestone keys in ascending order of duration. */
export const MILESTONE_KEYS = [
  '24h',
  '3d',
  '1w',
  '2w',
  '1m',
  '3m',
  '6m',
  '1y',
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export interface UserProfile {
  id: 1;
  goal: Goal;
  created_at: string;
  onboarding_done: 0 | 1;
}

export interface Addiction {
  id: number;
  type: AddictionType;
  baseline_amount: number | null;
  baseline_period: BaselinePeriod | null;
  cost_per_unit: number | null;
  created_at: string;
}

export interface CleanPeriod {
  id: number;
  addiction_id: number;
  started_at: string;
  ended_at: string | null;
  end_reason: EndReason | null;
  created_at: string;
}

export interface CravingLog {
  id: number;
  addiction_id: number | null;
  occurred_at: string;
  location: string | null;
  emotion: string | null;
  intensity: number | null;
  trigger: string | null;
  survived: 0 | 1;
  came_from_panic: 0 | 1;
  created_at: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  phone: string | null;
  relationship: string | null;
  sort_order: number;
}

export interface Reason {
  id: number;
  text: string;
  sort_order: number;
  created_at: string;
}

export interface SavingsGoal {
  id: number;
  title: string;
  target_amount: number;
  achieved_at: string | null;
  created_at: string;
}

export interface MilestoneReached {
  id: number;
  clean_period_id: number;
  addiction_id: number | null;
  milestone_key: MilestoneKey;
  reached_at: string;
}

export interface DailyCheckin {
  id: number;
  checkin_date: string; // 'YYYY-MM-DD'
  mood: number | null; // 1..5
  note: string | null;
  created_at: string;
}
