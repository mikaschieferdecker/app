import type { DB } from '../db.js';
import type { AddictionType, BaselinePeriod, Goal } from '../types.js';
import { nowIso, toMillis } from '../time.js';
import {
  commitOnboarding,
  isOnboardingComplete,
  type OnboardingResult,
} from './commit.js';
import {
  emptyDraft,
  orderedSteps,
  needsSafetyStep,
  type BaselineDraft,
  type Clock,
  type ContactDraft,
  type OnboardingDraft,
  type OnboardingStepId,
} from './types.js';

export type AppRoute = 'onboarding' | 'home';

/** Where the app should start: onboarding until it's been completed, then home. */
export function resolveInitialRoute(db: DB): AppRoute {
  return isOnboardingComplete(db) ? 'home' : 'onboarding';
}

/**
 * Stateful driver for the onboarding screens. A UI binds one controller: it
 * reads `currentStep`/`steps` to render, calls the setters as the user fills a
 * screen, and uses `next()` / `back()` to navigate. The safety step appears only
 * when a safety-critical addiction is selected, and cannot be passed without an
 * explicit acknowledgement. `complete()` writes everything in one transaction.
 */
export class OnboardingController {
  readonly draft: OnboardingDraft;
  private cursor: OnboardingStepId = 'welcome';

  constructor(
    private readonly db: DB,
    private readonly clock: Clock = nowIso,
    draft: OnboardingDraft = emptyDraft(),
  ) {
    this.draft = draft;
  }

  /** The active step order for the current draft (safety filtered in/out). */
  get steps(): OnboardingStepId[] {
    return orderedSteps(this.draft);
  }

  get currentStep(): OnboardingStepId {
    return this.cursor;
  }

  get isFirstStep(): boolean {
    return this.steps[0] === this.cursor;
  }

  get isLastStep(): boolean {
    const order = this.steps;
    return order[order.length - 1] === this.cursor;
  }

  // --- setters (one per screen) -------------------------------------------

  setAddictions(addictions: AddictionType[]): void {
    // De-duplicate while preserving selection order.
    this.draft.addictions = [...new Set(addictions)];
    // Selecting away from a safety-critical addiction clears a now-moot ack.
    if (!needsSafetyStep(this.draft.addictions)) this.draft.safetyAcknowledged = false;
  }

  toggleAddiction(type: AddictionType): void {
    const has = this.draft.addictions.includes(type);
    this.setAddictions(
      has
        ? this.draft.addictions.filter((a) => a !== type)
        : [...this.draft.addictions, type],
    );
  }

  acknowledgeSafety(acknowledged = true): void {
    this.draft.safetyAcknowledged = acknowledged;
  }

  setStartDate(isoDate: string): void {
    this.draft.startDate = isoDate;
  }

  /** Convenience: default the start date to "now" from the injected clock. */
  useToday(): void {
    this.draft.startDate = this.clock();
  }

  setGoal(goal: Goal): void {
    this.draft.goal = goal;
  }

  setBaseline(type: AddictionType, amount: number, period: BaselinePeriod): void {
    this.draft.baselines[type] = { amount, period } satisfies BaselineDraft;
  }

  clearBaseline(type: AddictionType): void {
    delete this.draft.baselines[type];
  }

  setContacts(contacts: ContactDraft[]): void {
    this.draft.contacts = contacts;
  }

  // --- navigation ----------------------------------------------------------

  /**
   * Validation error for a step, or null when it may be left. Optional steps
   * (baseline, contacts) always pass; the safety step requires acknowledgement.
   */
  validateStep(step: OnboardingStepId = this.cursor): string | null {
    switch (step) {
      case 'welcome':
        return null;
      case 'addictions':
        return this.draft.addictions.length > 0
          ? null
          : 'Bitte wähle mindestens eine Sucht aus.';
      case 'safety':
        return this.draft.safetyAcknowledged
          ? null
          : 'Bitte bestätige den Sicherheitshinweis, um fortzufahren.';
      case 'startDate':
        if (!this.draft.startDate) return 'Bitte wähle ein Startdatum.';
        return toMillis(this.draft.startDate) > toMillis(this.clock())
          ? 'Das Startdatum darf nicht in der Zukunft liegen.'
          : null;
      case 'goal':
        return this.draft.goal ? null : 'Bitte wähle ein Ziel.';
      case 'baseline':
      case 'contacts':
        return null; // optional
    }
  }

  canAdvance(): boolean {
    return this.validateStep() === null;
  }

  /** Advance to the next step. Throws the validation message if the step isn't valid. */
  next(): void {
    const error = this.validateStep();
    if (error) throw new Error(error);
    const order = this.steps;
    const i = order.indexOf(this.cursor);
    const nextStep = order[i + 1];
    if (nextStep) this.cursor = nextStep; // no-op on the last step; call complete()
  }

  /** Go back one step (no-op on the first step). */
  back(): void {
    const order = this.steps;
    const i = order.indexOf(this.cursor);
    const prevStep = i > 0 ? order[i - 1] : undefined;
    if (prevStep) this.cursor = prevStep;
  }

  /**
   * Finish onboarding: validates the whole draft and commits it in one
   * transaction, setting onboarding_done = 1 as the last write.
   */
  complete(): OnboardingResult {
    return commitOnboarding(this.db, this.draft, this.clock);
  }
}
