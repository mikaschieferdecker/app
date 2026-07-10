import type { DB } from '../db.js';
import type { AddictionType, UserProfile } from '../types.js';
import { nowIso, toMillis } from '../time.js';
import { createAddiction } from '../repositories/addictions.js';
import { startCleanPeriod } from '../repositories/cleanPeriods.js';
import { createContact } from '../repositories/contacts.js';
import { completeOnboarding, createProfile, getProfile } from '../repositories/profile.js';
import {
  CANONICAL_ADDICTION_ORDER,
  needsSafetyStep,
  type Clock,
  type OnboardingDraft,
} from './types.js';

export interface OnboardingResult {
  profile: UserProfile;
  /** Ids of the addictions created, keyed by type. */
  addictionIds: Partial<Record<AddictionType, number>>;
}

/**
 * Validates a draft against the flow's rules. Throws with a user-facing German
 * message on the first problem. Runs before any write so the transaction only
 * ever executes on a complete, valid draft.
 */
export function validateOnboarding(draft: OnboardingDraft, clock: Clock = nowIso): void {
  if (draft.addictions.length === 0) {
    throw new Error('Bitte wähle mindestens eine Sucht aus.');
  }
  if (new Set(draft.addictions).size !== draft.addictions.length) {
    throw new Error('Eine Sucht wurde doppelt ausgewählt.');
  }
  if (needsSafetyStep(draft.addictions) && !draft.safetyAcknowledged) {
    throw new Error('Bitte bestätige zuerst den Sicherheitshinweis.');
  }
  if (!draft.startDate) {
    throw new Error('Bitte wähle ein Startdatum.');
  }
  if (toMillis(draft.startDate) > toMillis(clock())) {
    throw new Error('Das Startdatum darf nicht in der Zukunft liegen.');
  }
  if (!draft.goal) {
    throw new Error('Bitte wähle ein Ziel.');
  }
  for (const [type, base] of Object.entries(draft.baselines)) {
    if (!base) continue;
    if (!draft.addictions.includes(type as AddictionType)) {
      throw new Error(`Baseline für nicht gewählte Sucht: ${type}.`);
    }
    if (!(base.amount > 0)) {
      throw new Error('Der Baseline-Betrag muss größer als 0 sein.');
    }
  }
  draft.contacts.forEach((c, i) => {
    if (!c.name.trim()) {
      throw new Error(`Notfallkontakt ${i + 1} braucht einen Namen.`);
    }
  });
}

/**
 * Persists a completed onboarding draft in a single transaction, so an aborted
 * or failing onboarding never leaves half-written data.
 *
 * Order matters: addictions, clean periods and contacts are written first; the
 * profile is created with onboarding_done = 0 and flipped to 1 as the very last
 * statement. `onboarding_done` is therefore only set once everything else
 * succeeded.
 *
 * Time is taken from the injected `clock` (never a direct `now()`), matching the
 * data-access layer, so the whole flow stays deterministic in tests.
 */
export function commitOnboarding(
  db: DB,
  draft: OnboardingDraft,
  clock: Clock = nowIso,
): OnboardingResult {
  validateOnboarding(draft, clock);

  const run = db.transaction((): OnboardingResult => {
    const now = clock();
    const startDate = draft.startDate!;
    const addictionIds: Partial<Record<AddictionType, number>> = {};

    for (const type of CANONICAL_ADDICTION_ORDER) {
      if (!draft.addictions.includes(type)) continue;
      const base = draft.baselines[type];
      const addiction = createAddiction(db, {
        type,
        baselineAmount: base?.amount ?? null,
        baselinePeriod: base?.period ?? null,
        createdAt: now,
      });
      addictionIds[type] = addiction.id;
      startCleanPeriod(db, addiction.id, startDate);
    }

    draft.contacts.forEach((c, i) => {
      createContact(db, {
        name: c.name.trim(),
        phone: c.phone ?? null,
        relationship: c.relationship ?? null,
        sortOrder: i,
      });
    });

    createProfile(db, { goal: draft.goal!, onboardingDone: false, createdAt: now });
    // Final statement: mark onboarding complete.
    const profile = completeOnboarding(db);
    return { profile, addictionIds };
  });

  return run();
}

/** True once onboarding has been completed (the single profile row has done = 1). */
export function isOnboardingComplete(db: DB): boolean {
  return getProfile(db)?.onboarding_done === 1;
}
