import type { DB } from '../db.js';
import type { Goal, UserProfile } from '../types.js';
import { nowIso } from '../time.js';

/** Reads the single profile row, or null if onboarding hasn't created it yet. */
export function getProfile(db: DB): UserProfile | null {
  const row = db
    .prepare('SELECT * FROM user_profile WHERE id = 1')
    .get() as UserProfile | undefined;
  return row ?? null;
}

export interface CreateProfileInput {
  goal: Goal;
  onboardingDone?: boolean;
  createdAt?: string;
}

/**
 * Creates the single profile row (id is always 1). Throws if it already exists.
 * Use {@link updateProfile} to change it afterwards.
 */
export function createProfile(db: DB, input: CreateProfileInput): UserProfile {
  db.prepare(
    `INSERT INTO user_profile (id, goal, created_at, onboarding_done)
     VALUES (1, ?, ?, ?)`,
  ).run(input.goal, input.createdAt ?? nowIso(), input.onboardingDone ? 1 : 0);
  return getProfile(db)!;
}

export interface UpdateProfileInput {
  goal?: Goal;
  onboardingDone?: boolean;
}

/** Updates the profile in place. Only provided fields change. */
export function updateProfile(db: DB, input: UpdateProfileInput): UserProfile {
  const current = getProfile(db);
  if (!current) throw new Error('No profile exists yet; call createProfile first.');
  db.prepare(
    `UPDATE user_profile
        SET goal = ?, onboarding_done = ?
      WHERE id = 1`,
  ).run(
    input.goal ?? current.goal,
    input.onboardingDone === undefined
      ? current.onboarding_done
      : input.onboardingDone
        ? 1
        : 0,
  );
  return getProfile(db)!;
}

/** Convenience helper to mark onboarding complete. */
export function completeOnboarding(db: DB): UserProfile {
  return updateProfile(db, { onboardingDone: true });
}
