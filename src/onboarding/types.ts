import type { AddictionType, BaselinePeriod, Goal } from '../types.js';

// Re-exported for compatibility; the canonical definition lives in ../time.js.
export type { Clock } from '../time.js';

/** Ordered step identifiers. `safety` is conditional (see {@link orderedSteps}). */
export type OnboardingStepId =
  | 'welcome'
  | 'addictions'
  | 'safety'
  | 'startDate'
  | 'goal'
  | 'baseline'
  | 'contacts';

export interface BaselineDraft {
  amount: number;
  period: BaselinePeriod;
}

export interface ContactDraft {
  name: string;
  phone?: string;
  relationship?: string;
}

/** Mutable working state collected across the onboarding screens. */
export interface OnboardingDraft {
  /** Selected addictions (step 2). */
  addictions: AddictionType[];
  /** Conscious confirmation of the safety notice (step 3, when shown). */
  safetyAcknowledged: boolean;
  /** Clean/abstinent since — applied to every selected addiction (step 4). */
  startDate: string | null;
  /** Goal for the profile (step 5). */
  goal: Goal | null;
  /** Optional baseline spend per addiction, for savings (step 6). */
  baselines: Partial<Record<AddictionType, BaselineDraft>>;
  /** Optional emergency contacts (step 7). */
  contacts: ContactDraft[];
}

export function emptyDraft(): OnboardingDraft {
  return {
    addictions: [],
    safetyAcknowledged: false,
    startDate: null,
    goal: null,
    baselines: {},
    contacts: [],
  };
}

/** Addictions whose physical withdrawal can be dangerous → require the safety step. */
export const SAFETY_CRITICAL: readonly AddictionType[] = ['alcohol', 'drugs'];

export function needsSafetyStep(addictions: readonly AddictionType[]): boolean {
  return addictions.some((a) => SAFETY_CRITICAL.includes(a));
}

/** Canonical write order so results are deterministic regardless of selection order. */
export const CANONICAL_ADDICTION_ORDER: readonly AddictionType[] = [
  'alcohol',
  'drugs',
  'gambling',
];

/** The full step order, with `safety` filtered out when not applicable. */
export function orderedSteps(draft: OnboardingDraft): OnboardingStepId[] {
  const base: OnboardingStepId[] = [
    'welcome',
    'addictions',
    'safety',
    'startDate',
    'goal',
    'baseline',
    'contacts',
  ];
  return base.filter((s) => s !== 'safety' || needsSafetyStep(draft.addictions));
}
